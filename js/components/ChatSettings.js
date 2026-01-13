import { ref, onMounted, computed, watch } from 'vue';
import ChatHeader from './ChatHeader.js';
import WbTreeItem from './WbTreeItem.js';
import { generateAvatar, store } from '../store.js'; 

export default {
    components: { ChatHeader, WbTreeItem },
    props: ['session'], 
    emits: ['close', 'update-session', 'clear-history'],
    template: `
        <div class="app-window" style="height: 100%; display: flex; flex-direction: column; background: #f2f4f6;" v-show="!isWbSelectorOpen && !isMemoryEditorOpen && !isStickerManagerOpen">
            <chat-header name="详细设置" :show-avatar="false" @back="$emit('close')"></chat-header>
            
            <div style="flex: 1; overflow-y: auto; padding: 20px;">
                <!-- 1. 形象设置 -->
                <div class="section-card">
                    <div class="section-header">角色形象</div>
                    <div style="display: flex; justify-content: space-around; padding: 10px 0;">
                        <div class="role-column">
                            <div class="avatar-wrapper" @click="triggerUpload('aiAvatar')">
                                <div class="role-avatar" :style="{ backgroundImage: 'url(' + (localSettings.avatar || defaultAiAvatar) + ')' }"></div>
                                <div class="edit-badge"><i class="ri-camera-fill"></i></div>
                            </div>
                            <span class="role-label">Char</span>
                            <input type="file" ref="aiAvatarInput" accept="image/*" style="display:none" @change="handleFile($event, 'aiAvatar')">
                        </div>
                        <div class="vs-divider"></div>
                        <div class="role-column">
                            <div class="avatar-wrapper" @click="triggerUpload('userAvatar')">
                                <div class="role-avatar" :style="{ backgroundImage: 'url(' + (localSettings.settings.userAvatar || defaultUserAvatar) + ')' }"></div>
                                <div class="edit-badge"><i class="ri-camera-fill"></i></div>
                            </div>
                            <span class="role-label">User</span>
                            <input type="file" ref="userAvatarInput" accept="image/*" style="display:none" @change="handleFile($event, 'userAvatar')">
                        </div>
                    </div>
                    <div style="display: flex; gap: 15px; margin-top: 15px;">
                        <div class="form-group" style="flex:1">
                            <label class="mini-label">Char 昵称</label>
                            <input type="text" v-model="localSettings.name" class="glass-input-sm">
                        </div>
                        <div class="form-group" style="flex:1">
                            <label class="mini-label">User 昵称</label>
                            <input type="text" v-model="localSettings.settings.userName" class="glass-input-sm">
                        </div>
                    </div>
                </div>

                <!-- 2. 世界书 & 记忆 & 表情 -->
                <div class="wb-entry-card" @click="isWbSelectorOpen = true">
                    <div style="display: flex; align-items: center;">
                        <div class="wb-entry-icon"><i class="ri-book-read-line"></i></div>
                        <div>
                            <div style="font-weight: 600; font-size: 15px;">世界书挂载</div>
                            <div style="font-size: 12px; color: #888; margin-top: 2px;">已选择 {{ activeIds.length }} 项规则</div>
                        </div>
                    </div>
                    <i class="ri-arrow-right-s-line" style="color: #ccc; font-size: 24px;"></i>
                </div>

                <div class="wb-entry-card" @click="isMemoryEditorOpen = true">
                    <div style="display: flex; align-items: center;">
                        <div class="wb-entry-icon" style="background: #e0f7fa; color: #00897b;"><i class="ri-brain-line"></i></div>
                        <div>
                            <div style="font-weight: 600; font-size: 15px;">记忆工作台</div>
                            <div style="font-size: 12px; color: #888; margin-top: 2px;">设定记忆权重与自动总结</div>
                        </div>
                    </div>
                    <i class="ri-arrow-right-s-line" style="color: #ccc; font-size: 24px;"></i>
                </div>

                <div class="wb-entry-card" @click="openStickerManager">
                    <div style="display: flex; align-items: center;">
                        <div class="wb-entry-icon" style="background: #fff3e0; color: #ff9800;"><i class="ri-emotion-line"></i></div>
                        <div>
                            <div style="font-weight: 600; font-size: 15px;">表情包管理</div>
                            <div style="font-size: 12px; color: #888; margin-top: 2px;">共 {{ store.stickers.length }} 个项目</div>
                        </div>
                    </div>
                    <i class="ri-arrow-right-s-line" style="color: #ccc; font-size: 24px;"></i>
                </div>

                <!-- 3. 聊天模式 -->
                <div class="section-card">
                    <div class="section-header">回复模式</div>
                    
                    <div class="switch-row" style="background:transparent; padding:0; margin:0;">
                        <div style="flex:1;">
                            <span style="font-size:14px; font-weight:600;">长文/小说模式</span>
                            <div style="font-size:11px; color:#888; margin-top:2px;">开启后不再拆分气泡</div>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" v-model="localSettings.settings.enableLongText">
                            <span class="slider"></span>
                        </label>
                    </div>

                    <!-- [新增] 翻译开关 -->
                    <div class="switch-row" style="background:transparent; padding:0; margin:10px 0 0 0;">
                        <div style="flex:1;">
                            <span style="font-size:14px; font-weight:600;">点击显示翻译</span>
                            <div style="font-size:11px; color:#888; margin-top:2px;">双语模式，点击气泡查看翻译</div>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" v-model="localSettings.settings.enableTranslation">
                            <span class="slider"></span>
                        </label>
                    </div>

                    <!-- 展开的高级设置 -->
                    <div v-if="localSettings.settings.enableLongText" class="advanced-mode-panel">
                        <div class="form-group">
                            <label class="mini-label">文风约束 (Style)</label>
                            <textarea 
                                v-model="localSettings.settings.novelStyle" 
                                class="glass-textarea" 
                                style="height: 60px; font-size: 13px;" 
                                placeholder="例如：侧重心理描写，辞藻华丽，第三人称..."
                            ></textarea>
                        </div>

                        <div class="form-group" style="margin-bottom: 20px;">
                            <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                                <label class="mini-label">目标篇幅</label>
                                <span style="font-size:11px; font-weight:600; color:#333;">{{ lengthLabel }}</span>
                            </div>
                            <input 
                                type="range" 
                                class="styled-range" 
                                v-model.number="localSettings.settings.novelLength" 
                                min="0" max="3" step="1"
                                :style="sliderStyle"
                            >
                            <div style="display:flex; justify-content:space-between; font-size:10px; color:#999; margin-top:6px;">
                                <span>短</span><span>适中</span><span>长</span><span>超长</span>
                            </div>
                        </div>
                        
                         <div class="form-group" style="margin-bottom: 0;">
                            <label class="mini-label">叙事视角 (POV)</label>
                            <div class="segment-control">
                                <div class="segment-item" :class="{ active: !localSettings.settings.novelPov || localSettings.settings.novelPov === 'char' }" @click="localSettings.settings.novelPov = 'char'">Char主视角</div>
                                <div class="segment-item" :class="{ active: localSettings.settings.novelPov === 'third' }" @click="localSettings.settings.novelPov = 'third'">上帝视角</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 4. 场景 & 剧本 -->
                <div class="section-card">
                    <div class="section-header">聊天背景</div>
                    <div class="bg-uploader" @click="triggerUpload('bg')" :style="{ backgroundImage: localSettings.settings.background ? 'url(' + localSettings.settings.background + ')' : 'none' }">
                        <div class="bg-placeholder" v-if="!localSettings.settings.background"><i class="ri-image-add-line"></i><span>点击上传背景图</span></div>
                        <i v-else class="ri-edit-circle-fill bg-edit-icon"></i>
                    </div>
                    <input type="file" ref="bgInput" accept="image/*" style="display:none" @change="handleFile($event, 'bg')">
                    <button @click="removeBackground" :disabled="!localSettings.settings.background" :style="{ width: '100%', marginTop: '10px', padding: '12px', borderRadius: '12px', border: 'none', fontWeight: '600', fontSize: '13px', cursor: localSettings.settings.background ? 'pointer' : 'not-allowed', background: localSettings.settings.background ? 'rgba(255,59,48,0.1)' : '#f0f0f0', color: localSettings.settings.background ? '#ff3b30' : '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }"><i class="ri-delete-bin-line"></i> {{ localSettings.settings.background ? '移除当前背景' : '暂无背景图片' }}</button>
                </div>

                <div class="section-card">
                    <div class="section-header">剧本设定</div>
                    <div class="form-group"><label class="mini-label">Char 人设</label><textarea v-model="localSettings.settings.systemPrompt" class="glass-textarea" placeholder="例如：你是一个严厉的数学老师..."></textarea></div>
                    <div class="form-group" style="margin-top: 15px;"><label class="mini-label">User 人设</label><textarea v-model="localSettings.settings.userPersona" class="glass-textarea" placeholder="例如：我是一个经常考零分的学生..."></textarea></div>
                </div>

                <!-- CSS 预览 -->
                <div class="section-card">
                    <div class="section-header">自定义 CSS</div>
                    <div class="css-preview-box" :style="{ backgroundImage: localSettings.settings.background ? 'url(' + localSettings.settings.background + ')' : 'none', minHeight: '120px', padding: '15px', border: '1px solid #eee', borderRadius: '16px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundSize: 'cover', backgroundPosition: 'center' }">
                        <div v-html="previewStyleTag"></div>
                        <div class="msg-row ai" style="display:flex; align-items:flex-end; gap:8px;">
                            <div class="msg-avatar" :style="{ width:'36px', height:'36px', borderRadius:'50%', background:'#ddd', flexShrink:0, backgroundImage: 'url(' + (localSettings.avatar || defaultAiAvatar) + ')' }"></div>
                            <div class="bubble" style="background:#fff; padding:10px 14px; border-radius:18px; border-bottom-left-radius:4px; max-width:75%; font-size:14px;">Char 预览</div>
                        </div>
                        <div class="msg-row me" style="display:flex; justify-content:flex-end; align-items:flex-end; gap:8px;">
                            <div class="bubble" style="background:#4a4a4a; color:#fff; padding:10px 14px; border-radius:18px; border-bottom-right-radius:4px; max-width:75%; font-size:14px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">User 预览</div>
                            <div class="msg-avatar" :style="{ width:'36px', height:'36px', borderRadius:'50%', background:'#ddd', flexShrink:0, backgroundImage: 'url(' + (localSettings.settings.userAvatar || defaultUserAvatar) + ')' }"></div>
                        </div>
                    </div>
                    <textarea v-model="localSettings.settings.customCss" class="glass-textarea code-font" style="height: 120px; font-family: monospace; font-size: 12px; margin-top: 10px;" placeholder="/* 输入 CSS 实时预览 */"></textarea>
                </div>

                <div style="height: 20px;"></div>
                <button class="save-btn-lg" @click="handleSave">保存所有修改</button>
                <div style="margin-top: 20px; text-align: center;"><button class="danger-btn" @click="showClearModal = true"><i class="ri-delete-bin-line"></i> 清空聊天记录</button></div>
                <div style="height: 40px;"></div>
            </div>
            
            <div v-if="showClearModal" class="center-modal-overlay" @click="showClearModal = false" style="z-index: 500;"><div class="center-modal-box" @click.stop><h3 style="text-align: center; font-size: 16px;">确认清空?</h3><p style="text-align: center; font-size: 13px; color: #666; margin-bottom: 10px;">当前会话的所有聊天记录将被永久删除。</p><div style="display: flex; gap: 10px; width: 100%;"><button class="api-save-btn" style="margin:0; flex:1; padding:12px; background:rgba(0,0,0,0.05); color:#666;" @click="showClearModal = false">取消</button><button class="api-delete-btn" style="margin:0; flex:1; padding:12px;" @click="confirmClear">清空</button></div></div></div>
        </div>

        <!-- 二级页面：世界书选择 -->
        <div class="wb-selector-page" v-if="isWbSelectorOpen">
            <chat-header name="选择世界书" :show-avatar="false" @back="isWbSelectorOpen = false"><template #right><span style="color: #007aff; font-weight: 600; font-size: 14px; cursor: pointer;" @click="isWbSelectorOpen = false">完成</span></template></chat-header>
            <div style="padding: 15px 20px 0 20px;"><div class="search-bar"><i class="ri-search-line" style="color:#999;"></i><input type="text" v-model="searchQuery" placeholder="搜索规则或文件夹..." class="search-input"></div></div>
            <div style="flex: 1; overflow-y: auto; padding: 20px;"><div v-if="filteredTree.length === 0" style="text-align:center; color:#999; font-size:12px; margin-top: 50px;">没有找到匹配的内容</div><div class="wb-tree"><wb-tree-item v-for="node in filteredTree" :key="node.id" :node="node" :selected-ids="activeIds" @toggle-book="toggleBook" @toggle-folder="toggleFolder"></wb-tree-item></div></div>
        </div>

        <!-- 二级页面：记忆工作台 -->
        <div class="wb-selector-page" v-if="isMemoryEditorOpen">
            <chat-header name="记忆工作台" :show-avatar="false" @back="isMemoryEditorOpen = false"><template #right><span style="color: #007aff; font-weight: 600; font-size: 14px; cursor: pointer;" @click="isMemoryEditorOpen = false">完成</span></template></chat-header>
            <div style="flex: 1; overflow-y: auto; padding: 20px;">
                <div class="section-card"><div class="section-header" style="color:#ffb020;">长期记忆 (Long Term)</div><div style="font-size:12px; color:#666; margin-bottom:10px;">【核心事实】永久生效，权重最高。</div><textarea v-model="localSettings.settings.longTermMemory" class="glass-textarea" style="height: 150px;" placeholder="在此处输入永久设定..."></textarea></div>
                <div class="section-card"><div class="section-header" style="color:#007aff;">短期记忆 (Short Term)</div><div style="font-size:12px; color:#666; margin-bottom:10px;">【即时状态】记录最近发生的事件流，随对话更新。</div><div style="display: flex; gap: 10px; margin-bottom: 10px;"><div class="form-group" style="flex:1; margin:0;"><label class="mini-label">自动总结阈值 (消息数)</label><input type="number" v-model.number="localSettings.settings.summaryThreshold" class="glass-input-sm" placeholder="0 为关闭"></div></div><div class="form-group"><label class="mini-label">总结提示词 (Prompt)</label><input type="text" v-model="localSettings.settings.summaryPrompt" class="glass-input-sm" placeholder="默认：请简要总结上述对话..."></div><button @click="handleAutoSummary" :disabled="isSummarizing" style="width:100%; padding:12px; margin: 10px 0; border-radius:12px; border:none; background:#007aff; color:#fff; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;"><i :class="isSummarizing ? 'ri-loader-4-line' : 'ri-magic-line'" :style="{ animation: isSummarizing ? 'spin 1s linear infinite' : '' }"></i>{{ isSummarizing ? '正在读取最近记录并总结...' : '立即手动总结' }}</button><div class="form-group"><label class="mini-label">记忆内容 (可编辑)</label><textarea v-model="localSettings.settings.shortTermMemory" class="glass-textarea" style="height: 150px;" placeholder="在此处输入摘要..."></textarea></div></div>
            </div>
        </div>

        <!-- 二级页面：表情包管理 -->
        <div class="wb-selector-page" v-if="isStickerManagerOpen">
            <!-- (保持表情包管理代码不变) -->
            <chat-header :name="currentFolderName" :show-avatar="false" @back="goBackFolder">
                <template #right>
                    <span v-if="isMultiSelect" style="color: #333; font-weight: 600; font-size: 14px; cursor: pointer; margin-right: 15px;" @click="toggleSelectAll">
                        {{ isAllSelected ? '取消全选' : '全选' }}
                    </span>
                    <span v-if="!isMultiSelect" style="color: #333; font-weight: 600; font-size: 14px; cursor: pointer;" @click="startMultiSelect">管理</span>
                    <span v-else style="color: #007aff; font-weight: 600; font-size: 14px; cursor: pointer;" @click="cancelMultiSelect">完成</span>
                </template>
            </chat-header>

            <div style="padding: 10px 20px 0 20px; display: flex;">
                <div class="sticker-crumb">
                    <span class="crumb-item" :class="{ active: folderStack.length === 0 }" @click="goToRoot">全部</span>
                    <template v-for="(folder, idx) in folderStack" :key="idx">
                        <span class="crumb-sep">/</span>
                        <span class="crumb-item" :class="{ active: idx === folderStack.length - 1 }">{{ folder.name }}</span>
                    </template>
                </div>
            </div>

            <div v-if="!isMultiSelect" style="padding: 0 20px; font-size: 11px; color: #999; margin-bottom: 10px;">
                <i class="ri-information-line"></i> 点击图片启用/禁用 (彩色为启用，黑白为禁用)
            </div>

            <div style="flex: 1; overflow-y: auto; padding: 20px;">
                <div class="sticker-grid">
                    <div v-if="!isMultiSelect" class="sticker-grid-item add-btn" @click="showAddMenu = true">
                        <i class="ri-add-line"></i>
                        <span>添加</span>
                    </div>
                    <div v-for="(item, idx) in currentFolderList" :key="'f-'+idx">
                        <div v-if="item.type === 'folder'" 
                             class="sticker-grid-item folder" 
                             :class="{ selected: selectedItems.includes(item) }"
                             @click="handleItemClick(item)">
                            <i class="ri-folder-3-fill folder-icon"></i>
                            <span class="folder-name">{{ item.name }}</span>
                            <div v-if="isMultiSelect" class="sticker-select-overlay">
                                <div class="sticker-check"><i class="ri-check-line"></i></div>
                            </div>
                        </div>
                        <div v-else 
                             class="sticker-grid-item" 
                             :class="{ 'selected': selectedItems.includes(item), 'inactive': !isActiveSticker(item) }"
                             @click="handleItemClick(item)">
                            <img :src="item.url" class="sticker-img-preview">
                            <div class="sticker-name-tag">{{ item.name || '未命名' }}</div>
                            <div v-if="isMultiSelect" class="sticker-select-overlay">
                                <div class="sticker-check"><i class="ri-check-line"></i></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div v-if="isMultiSelect" class="sticker-action-bar">
                <div @click="triggerBatchActive(true)" style="display:flex; flex-direction:column; align-items:center; cursor:pointer; color: #4cd964;">
                    <i class="ri-check-double-line" style="font-size:24px;"></i>
                    <span style="font-size:10px;">AI启用</span>
                </div>
                <div @click="triggerBatchActive(false)" style="display:flex; flex-direction:column; align-items:center; cursor:pointer; color: #ff9500;">
                    <i class="ri-close-circle-line" style="font-size:24px;"></i>
                    <span style="font-size:10px;">AI禁用</span>
                </div>
                <div style="width:1px; height:20px; background:rgba(255,255,255,0.2);"></div>
                <div @click="triggerBatchMove" style="display:flex; flex-direction:column; align-items:center; cursor:pointer;">
                    <i class="ri-folder-transfer-line" style="font-size:24px;"></i>
                    <span style="font-size:10px;">移动</span>
                </div>
                <div @click="triggerBatchDelete" style="display:flex; flex-direction:column; align-items:center; cursor:pointer; color:#ff3b30;">
                    <i class="ri-delete-bin-line" style="font-size:24px;"></i>
                    <span style="font-size:10px;">删除</span>
                </div>
            </div>

            <div v-if="showAddMenu" class="center-modal-overlay" @click="showAddMenu = false" style="z-index: 600;">
                <div class="center-modal-box" @click.stop>
                    <h3 style="text-align: center; font-size: 16px; margin-bottom: 10px;">添加内容</h3>
                    <button class="api-add-btn" @click="openUploadModal('local')"><i class="ri-image-add-line"></i> 单张添加</button>
                    <button class="api-add-btn" @click="openUploadModal('batch')" style="margin-top:10px;"><i class="ri-links-line"></i> 批量链接导入</button>
                    <button class="api-add-btn" @click="openCreateFolder" style="margin-top:10px;"><i class="ri-folder-add-line"></i> 新建文件夹</button>
                </div>
            </div>
        </div>

        <!-- 上传/导入/新建文件夹/移动 弹窗 -->
        <div v-if="showUploadModal" class="center-modal-overlay" @click="showUploadModal = false" style="z-index: 610;">
             <div class="center-modal-box" @click.stop>
                <h3 style="text-align: center; font-size: 16px; margin-bottom: 15px;">
                    {{ uploadMode === 'batch' ? '批量导入链接' : '添加表情' }}
                </h3>
                <div v-if="uploadMode === 'local'">
                    <div class="segment-control" style="margin-bottom: 15px;">
                        <div class="segment-item" :class="{ active: localSubMode === 'file' }" @click="localSubMode = 'file'">本地文件</div>
                        <div class="segment-item" :class="{ active: localSubMode === 'url' }" @click="localSubMode = 'url'">网络链接</div>
                    </div>
                    <div v-if="localSubMode === 'file'" class="bg-uploader" style="height: 100px; margin-bottom: 10px;" @click="stickerFileInput.click()">
                        <div class="bg-placeholder" v-if="!tempStickerUrl"><i class="ri-upload-cloud-line"></i><span>点击选择图片</span></div>
                        <div v-else class="bg-placeholder" :style="{ backgroundImage: 'url(' + tempStickerUrl + ')', backgroundSize: 'contain', backgroundRepeat: 'no-repeat' }"></div>
                    </div>
                    <input type="file" ref="stickerFileInput" accept="image/*" style="display:none" @change="handleStickerFile">
                    <input v-if="localSubMode === 'url'" v-model="tempStickerUrl" class="glass-input" placeholder="输入图片 URL" style="margin-bottom: 10px;">
                    <input v-model="tempStickerName" class="glass-input" placeholder="表情名称 (必填，方便AI理解)" style="margin-bottom: 10px;">
                </div>
                <div v-if="uploadMode === 'batch'">
                    <textarea v-model="batchUrls" class="batch-textarea" placeholder="格式：名称:链接 (支持中文冒号)&#10;例如：开心猫:https://example.com/cat.jpg"></textarea>
                    <div style="font-size:10px; color:#999; margin-bottom:10px;">请严格遵守 名称:链接 格式，以便 AI 识别。</div>
                </div>
                <div style="display: flex; gap: 10px; width: 100%;">
                    <button class="api-delete-btn" style="margin:0; flex:1; padding:12px; background:rgba(0,0,0,0.05); color:#666;" @click="showUploadModal = false">取消</button>
                    <button class="api-save-btn" style="margin:0; flex:1; padding:12px;" @click="confirmUpload">确定</button>
                </div>
            </div>
        </div>

        <div v-if="showFolderModal" class="center-modal-overlay" @click="showFolderModal = false" style="z-index: 610;">
            <div class="center-modal-box" @click.stop>
                <h3 style="text-align: center; font-size: 16px;">新建文件夹</h3>
                <input v-model="newFolderName" class="glass-input" placeholder="文件夹名称" style="margin: 15px 0;" @keyup.enter="confirmCreateFolder">
                <div style="display: flex; gap: 10px; width: 100%;">
                    <button class="api-delete-btn" style="margin:0; flex:1; padding:12px; background:rgba(0,0,0,0.05); color:#666;" @click="showFolderModal = false">取消</button>
                    <button class="api-save-btn" style="margin:0; flex:1; padding:12px;" @click="confirmCreateFolder">创建</button>
                </div>
            </div>
        </div>

        <div v-if="showMoveModal" class="center-modal-overlay" @click="showMoveModal = false" style="z-index: 620;">
            <div class="center-modal-box" @click.stop>
                <h3 style="text-align: center; font-size: 16px;">移动到...</h3>
                <div style="max-height: 200px; overflow-y: auto; margin: 15px 0; border: 1px solid #eee; border-radius: 12px;">
                    <div class="menu-item" @click="executeMove(null)" style="border-bottom: 1px solid #f5f5f5;">
                        <i class="ri-home-line"></i> 全部
                    </div>
                    <div v-for="f in store.stickers.filter(i => i.type === 'folder' && !selectedItems.includes(i))" :key="f.id" class="menu-item" @click="executeMove(f)">
                        <i class="ri-folder-line"></i> {{ f.name }}
                    </div>
                </div>
                <button class="api-delete-btn" style="width:100%; padding:12px; background:rgba(0,0,0,0.05); color:#666;" @click="showMoveModal = false">取消</button>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        const localSettings = ref(JSON.parse(JSON.stringify(props.session)));
        if (!localSettings.value.settings.activeStickerIds) {
            localSettings.value.settings.activeStickerIds = [];
        }
        // [新增] 翻译设置默认值
        if (localSettings.value.settings.enableTranslation === undefined) {
            localSettings.value.settings.enableTranslation = false;
        }

        const defaultAiAvatar = computed(() => generateAvatar(localSettings.value.name, 'assistant'));
        const defaultUserAvatar = computed(() => generateAvatar(localSettings.value.settings.userName, 'user'));
        
        const aiAvatarInput = ref(null);
        const userAvatarInput = ref(null);
        const bgInput = ref(null);
        const isWbSelectorOpen = ref(false);
        const isMemoryEditorOpen = ref(false);
        const isSummarizing = ref(false);
        const searchQuery = ref('');
        const fullTree = ref([]);
        const activeIds = ref(localSettings.value.settings.activeWorldbooks || []);
        const showClearModal = ref(false);
        
        const isStickerManagerOpen = ref(false);
        const folderStack = ref([]); 
        const isMultiSelect = ref(false);
        const selectedItems = ref([]);
        const showAddMenu = ref(false);
        const showUploadModal = ref(false);
        const uploadMode = ref('local'); 
        const localSubMode = ref('file'); 
        const tempStickerUrl = ref('');
        const tempStickerName = ref('');
        const batchUrls = ref('');
        const stickerFileInput = ref(null);
        const showFolderModal = ref(false);
        const newFolderName = ref('');
        const showMoveModal = ref(false);

        const currentFolderList = computed(() => {
            if (folderStack.value.length === 0) return store.stickers;
            return folderStack.value[folderStack.value.length - 1].children;
        });

        const currentFolderName = computed(() => {
            if (folderStack.value.length === 0) return '表情包管理';
            return folderStack.value[folderStack.value.length - 1].name;
        });

        const isAllSelected = computed(() => {
            return currentFolderList.value.length > 0 && selectedItems.value.length === currentFolderList.value.length;
        });

        const openStickerManager = () => { isStickerManagerOpen.value = true; folderStack.value = []; isMultiSelect.value = false; };
        const goBackFolder = () => {
            if (folderStack.value.length > 0) folderStack.value.pop();
            else isStickerManagerOpen.value = false;
        };
        const goToRoot = () => { folderStack.value = []; };

        const handleItemClick = (item) => {
            if (isMultiSelect.value) {
                const idx = selectedItems.value.indexOf(item);
                if (idx > -1) selectedItems.value.splice(idx, 1);
                else selectedItems.value.push(item);
            } else {
                if (item.type === 'folder') {
                    folderStack.value.push(item);
                } else {
                    toggleActiveSticker(item);
                }
            }
        };

        const toggleActiveSticker = (item) => {
            const activeList = localSettings.value.settings.activeStickerIds;
            const key = item.url;
            const idx = activeList.indexOf(key);
            if (idx > -1) activeList.splice(idx, 1);
            else activeList.push(key);
        };

        const isActiveSticker = (item) => {
            return localSettings.value.settings.activeStickerIds.includes(item.url);
        };

        const startMultiSelect = () => { isMultiSelect.value = true; selectedItems.value = []; };
        const cancelMultiSelect = () => { isMultiSelect.value = false; selectedItems.value = []; };
        
        const toggleSelectAll = () => {
            if (isAllSelected.value) {
                selectedItems.value = [];
            } else {
                selectedItems.value = [...currentFolderList.value];
            }
        };

        const getAllImageUrlsInItem = (item) => {
            if (item.type === 'image') return [item.url];
            if (item.type === 'folder' && item.children) {
                return item.children.flatMap(getAllImageUrlsInItem);
            }
            return [];
        };

        const triggerBatchActive = (enable) => {
            const activeList = localSettings.value.settings.activeStickerIds;
            selectedItems.value.forEach(item => {
                const urls = getAllImageUrlsInItem(item);
                urls.forEach(url => {
                    const idx = activeList.indexOf(url);
                    if (enable) {
                        if (idx === -1) activeList.push(url);
                    } else {
                        if (idx > -1) activeList.splice(idx, 1);
                    }
                });
            });
            cancelMultiSelect();
        };

        const openUploadModal = (mode) => {
            uploadMode.value = mode; showUploadModal.value = true; showAddMenu.value = false;
            tempStickerUrl.value = ''; tempStickerName.value = ''; batchUrls.value = '';
        };
        const handleStickerFile = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => { tempStickerUrl.value = evt.target.result; };
            reader.readAsDataURL(file);
        };
        const confirmUpload = () => {
            const list = currentFolderList.value;
            if (uploadMode.value === 'local') {
                if (!tempStickerUrl.value) { alert("请上传图片或输入链接"); return; }
                if (!tempStickerName.value.trim()) { alert("请输入表情包名称"); return; }
                list.push({ type: 'image', url: tempStickerUrl.value, name: tempStickerName.value.trim() });
            } else {
                const lines = batchUrls.value.split('\n');
                let addedCount = 0;
                lines.forEach(line => {
                    let cleanLine = line.trim();
                    if (!cleanLine) return;
                    let sepIndex = cleanLine.indexOf('：');
                    if (sepIndex === -1) sepIndex = cleanLine.indexOf(':');

                    if (sepIndex > 0) { 
                        const name = cleanLine.substring(0, sepIndex).trim();
                        const url = cleanLine.substring(sepIndex + 1).trim();
                        if (name && url) {
                            list.push({ type: 'image', url, name });
                            addedCount++;
                        }
                    }
                });
                if (addedCount === 0 && lines.length > 0 && lines[0].trim()) {
                    alert("格式错误，请使用：名称:链接");
                    return;
                }
            }
            showUploadModal.value = false;
        };

        const openCreateFolder = () => { showFolderModal.value = true; showAddMenu.value = false; newFolderName.value = ''; };
        const confirmCreateFolder = () => {
            if (!newFolderName.value.trim()) return;
            currentFolderList.value.unshift({
                type: 'folder',
                id: Date.now() + Math.random().toString(),
                name: newFolderName.value.trim(),
                children: []
            });
            showFolderModal.value = false;
        };

        const triggerBatchDelete = () => {
            if (confirm(`确定删除这 ${selectedItems.value.length} 项吗？`)) {
                const list = currentFolderList.value;
                selectedItems.value.forEach(item => {
                    const idx = list.indexOf(item);
                    if (idx > -1) list.splice(idx, 1);
                });
                cancelMultiSelect();
            }
        };
        const triggerBatchMove = () => {
            if (selectedItems.value.length === 0) return;
            showMoveModal.value = true;
        };
        const executeMove = (targetFolder) => {
            const targetList = targetFolder ? targetFolder.children : store.stickers;
            const sourceList = currentFolderList.value;
            if (selectedItems.value.includes(targetFolder)) { alert("不能移动到选中的文件夹内"); return; }
            selectedItems.value.forEach(item => {
                const idx = sourceList.indexOf(item);
                if (idx > -1) {
                    sourceList.splice(idx, 1);
                    targetList.push(item);
                }
            });
            showMoveModal.value = false;
            cancelMultiSelect();
        };

        const confirmClear = () => { emit('clear-history'); showClearModal.value = false; };
        const handleSave = () => {
            if (!localSettings.value.name || !localSettings.value.name.trim()) { alert("Char 昵称不能为空"); return; }
            if (!localSettings.value.settings.userName || !localSettings.value.settings.userName.trim()) { alert("User 昵称不能为空"); return; }
            localSettings.value.settings.aiName = localSettings.value.name;
            localSettings.value.settings.activeWorldbooks = activeIds.value;
            emit('update-session', localSettings.value);
            emit('close');
        };

        const previewStyleTag = computed(() => {
            if (!localSettings.value.settings.customCss) return '';
            return `<style>${localSettings.value.settings.customCss}</style>`;
        });
        const lengthLabel = computed(() => {
            const val = localSettings.value.settings.novelLength;
            if (val === 0) return '短小精悍';
            if (val === 1) return '适中 (默认)';
            if (val === 2) return '丰富详实';
            if (val === 3) return '超长篇幅';
            return '';
        });
        const sliderStyle = computed(() => {
            const val = localSettings.value.settings.novelLength || 0;
            const max = 3;
            const percent = (val / max) * 100;
            return {
                background: `linear-gradient(to right, #333 0%, #333 ${percent}%, #e0e0e0 ${percent}%, #e0e0e0 100%)`
            };
        });

        onMounted(() => {
            const allItems = JSON.parse(localStorage.getItem('ai_phone_worldbooks_v2') || '[]');
            const folderMap = {};
            allItems.filter(i => i.type === 'folder').forEach(f => folderMap[f.id] = { ...f, children: [] });
            const unclassified = { id: 'unclassified', type: 'folder', title: '未分类', children: [] };
            allItems.filter(i => i.type === 'book').forEach(book => {
                if (book.parentId && folderMap[book.parentId]) folderMap[book.parentId].children.push(book);
                else unclassified.children.push(book);
            });
            let result = [];
            Object.values(folderMap).forEach(f => result.push(f));
            if (unclassified.children.length > 0) result.push(unclassified);
            fullTree.value = result.filter(n => n.children.length > 0);
        });

        const filteredTree = computed(() => {
            if (!searchQuery.value.trim()) return fullTree.value;
            const query = searchQuery.value.toLowerCase();
            return fullTree.value.map(folder => {
                if (folder.title.toLowerCase().includes(query)) return folder;
                const matchingChildren = folder.children.filter(book => book.title.toLowerCase().includes(query));
                if (matchingChildren.length > 0) return { ...folder, children: matchingChildren, isOpen: true };
                return null;
            }).filter(Boolean);
        });

        const toggleBook = (id) => { const idx = activeIds.value.indexOf(id); if (idx > -1) activeIds.value.splice(idx, 1); else activeIds.value.push(id); };
        const toggleFolder = (folder) => {
            const getAllBookIds = (n) => { if (n.type === 'book') return [n.id]; return n.children.flatMap(getAllBookIds); };
            const childIds = getAllBookIds(folder);
            const allSelected = childIds.every(id => activeIds.value.includes(id));
            if (allSelected) activeIds.value = activeIds.value.filter(id => !childIds.includes(id));
            else childIds.forEach(id => { if (!activeIds.value.includes(id)) activeIds.value.push(id); });
        };

        const triggerUpload = (type) => { if (type === 'aiAvatar') aiAvatarInput.value.click(); else if (type === 'userAvatar') userAvatarInput.value.click(); else bgInput.value.click(); };
        const handleFile = (event, type) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                if (type === 'aiAvatar') localSettings.value.avatar = e.target.result;
                else if (type === 'userAvatar') localSettings.value.settings.userAvatar = e.target.result;
                else localSettings.value.settings.background = e.target.result;
            };
            reader.readAsDataURL(file);
        };
        const removeBackground = () => { localSettings.value.settings.background = ''; };

        const handleAutoSummary = async () => {
            const profiles = JSON.parse(localStorage.getItem('ai_phone_profiles') || '[]');
            const activeId = localStorage.getItem('ai_phone_active_id');
            const config = profiles.find(p => p.id == activeId);
            if (!config || !config.apiKey) { alert("请先在接口管理中配置 API Key"); return; }
            const recentMsgs = props.session.messages.slice(-50).map(m => `${m.role}: ${m.content}`).join('\n');
            if (!recentMsgs) { alert("暂无聊天记录，无法总结"); return; }
            isSummarizing.value = true;
            try {
                let baseUrl = config.baseUrl.replace(/\/$/, '');
                const response = await fetch(`${baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
                    body: JSON.stringify({
                        model: config.model || 'gpt-3.5-turbo',
                        messages: [{ role: 'system', content: 'You are a helpful assistant.' }, { role: 'user', content: `${localSettings.value.settings.summaryPrompt}\n\n【对话内容】\n${recentMsgs}` }],
                        temperature: 0.5, stream: false
                    })
                });
                if (!response.ok) throw new Error("API Request Failed");
                const data = await response.json();
                localSettings.value.settings.shortTermMemory = data.choices[0].message.content;
            } catch (e) { alert("总结失败: " + e.message); } finally { isSummarizing.value = false; }
        };

        return { 
            localSettings, defaultAiAvatar, defaultUserAvatar, handleSave, 
            triggerUpload, handleFile, aiAvatarInput, userAvatarInput, bgInput,
            activeIds, toggleBook, toggleFolder, isWbSelectorOpen, searchQuery, filteredTree, previewStyleTag,
            removeBackground, isMemoryEditorOpen, isSummarizing, handleAutoSummary, showClearModal, confirmClear,
            lengthLabel, sliderStyle, store,
            isStickerManagerOpen, openStickerManager, goBackFolder, goToRoot,
            currentFolderList, currentFolderName, folderStack,
            isMultiSelect, startMultiSelect, cancelMultiSelect, selectedItems, handleItemClick,
            showAddMenu, showUploadModal, uploadMode, localSubMode,
            tempStickerUrl, tempStickerName, batchUrls, stickerFileInput,
            openUploadModal, handleStickerFile, confirmUpload,
            showFolderModal, newFolderName, openCreateFolder, confirmCreateFolder,
            triggerBatchDelete, triggerBatchMove, showMoveModal, executeMove,
            toggleActiveSticker, isActiveSticker, isAllSelected, toggleSelectAll, triggerBatchActive
        };
    }
};
