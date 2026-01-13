import { ref, onMounted, nextTick, reactive, watch, computed } from 'vue';
import ChatHeader from './ChatHeader.js';
import MessageList from './MessageList.js';
import InputBar from './InputBar.js';
import ChatSettings from './ChatSettings.js';
import { generateAvatar, store } from '../store.js';

export default {
    components: { ChatHeader, MessageList, InputBar, ChatSettings },
    props: ['session'],
    emits: ['back', 'trigger-send', 'trigger-generate', 'update-session', 'delete-session'],
    template: `
        <chat-settings 
            v-if="isSettingOpen" 
            :session="session"
            @close="isSettingOpen = false"
            @update-session="handleSettingsUpdate"
            @clear-history="handleClearHistory"
        ></chat-settings>

        <div v-else class="app-window chat-room-container" :style="containerStyle" @click="closePopups">
            <div class="chat-abs-header">
                <chat-header :name="displayName" :status="displayStatus" @back="$emit('back')" @edit-status="openStatusModal">
                    <template #right>
                        <i class="ri-brain-line" style="font-size: 24px; cursor: pointer; color: #333; margin-right: 15px;" @click.stop="toggleOs"></i>
                        <i class="ri-settings-3-line" style="font-size: 24px; cursor: pointer; color: #333;" @click.stop="isSettingOpen = true"></i>
                    </template>
                </chat-header>
            </div>
            
            <div class="chat-abs-list" ref="scrollRef">
                <message-list 
                    :messages="session.messages" 
                    :user-avatar="userAvatarDisplay" 
                    :ai-avatar="aiAvatarDisplay" 
                    :is-multi-select="isMultiSelect" 
                    :selected-indices="selectedIndices" 
                    :session-name="session.name"
                    :user-name="session.settings.userName"
                    :enable-translation="session.settings.enableTranslation"
                    @show-context="openContextMenu" 
                    @toggle-select="toggleSelect" 
                    @view-recall="handleViewRecall"
                ></message-list>
            </div>

            <div class="chat-abs-footer">
                <input-bar 
                    v-if="!isMultiSelect" 
                    ref="inputBarRef" 
                    @send="handleSendOnly" 
                    @generate="handleGenerate" 
                    @regenerate="handleRegenerate" 
                    @open-photo-dialog="showPhotoDialog = true"
                    :disabled="session.isGenerating"
                ></input-bar>
                
                <div v-else class="glass-panel" style="height: 80px; display: flex; align-items: center; justify-content: space-between; padding: 0 30px; border-top: 1px solid rgba(255,255,255,0.5); background: rgba(245,245,245,0.98); backdrop-filter: blur(20px);">
                    <div @click="isMultiSelect = false; selectedIndices = []" style="display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer;">
                        <i class="ri-close-circle-fill" style="font-size:28px; color:#999;"></i>
                        <span style="font-size:11px; color: #666;">取消</span>
                    </div>
                    <div style="font-size: 14px; font-weight: 600; color: #333;">已选择 {{ selectedIndices.length }} 条</div>
                    <div @click="triggerBatchDelete" style="display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer;">
                        <i class="ri-delete-bin-fill" style="font-size:28px; color:#ff3b30;"></i>
                        <span style="font-size:11px; color:#ff3b30;">删除</span>
                    </div>
                </div>
            </div>

            <!-- 状态弹窗 -->
            <div v-if="showStatusModal" class="center-modal-overlay" @click="showStatusModal = false" style="z-index: 500;">
                <div class="center-modal-box" @click.stop>
                    <h3 style="text-align: center; font-size: 16px;">修改状态</h3>
                    <input v-model="tempStatusValue" class="glass-input" style="text-align: center;" @keyup.enter="saveStatus">
                    <div style="display: flex; gap: 10px; width: 100%;">
                        <button class="api-delete-btn" style="margin:0; flex:1; padding:12px; background:rgba(0,0,0,0.05); color:#666;" @click="showStatusModal = false">取消</button>
                        <button class="api-save-btn" style="margin:0; flex:1; padding:12px;" @click="saveStatus">确定</button>
                    </div>
                </div>
            </div>
            
            <!-- 拍照弹窗 -->
            <div v-if="showPhotoDialog" class="center-modal-overlay" @click="showPhotoDialog = false" style="z-index: 500;">
                <div class="center-modal-box" @click.stop>
                    <h3 style="text-align: center; font-size: 16px;">拍照描述</h3>
                    <p style="text-align: center; font-size: 12px; color: #999; margin-bottom: 10px;">发送一段文字，模拟发送了照片的效果。</p>
                    <input v-model="tempPhotoDesc" class="glass-input" style="text-align: center;" placeholder="例如：一只在晒太阳的猫" @keyup.enter="confirmFakePhoto">
                    <div style="display: flex; gap: 10px; width: 100%;">
                        <button class="api-delete-btn" style="margin:0; flex:1; padding:12px; background:rgba(0,0,0,0.05); color:#666;" @click="showPhotoDialog = false">取消</button>
                        <button class="api-save-btn" style="margin:0; flex:1; padding:12px;" @click="confirmFakePhoto">发送</button>
                    </div>
                </div>
            </div>

            <!-- 编辑消息/查看撤回 弹窗 -->
            <div v-if="showEditModal" class="center-modal-overlay" @click="showEditModal = false" style="z-index: 500;">
                <div class="center-modal-box" style="width: 90%; max-width: 400px;" @click.stop>
                    <h3 style="text-align: center; font-size: 16px; margin-bottom: 5px;">{{ isReadOnlyMode ? '已撤回的内容' : '编辑消息' }}</h3>
                    <div v-if="isReadOnlyMode" class="recall-view-box">{{ tempEditContent }}</div>
                    <textarea v-else v-model="tempEditContent" class="glass-textarea" style="height: 150px;"></textarea>
                    <div style="display: flex; gap: 10px; width: 100%; margin-top: 10px;">
                        <button v-if="isReadOnlyMode" class="api-save-btn" style="margin:0; flex:1; padding:12px; background:#e5e5e5; color:#333;" @click="showEditModal = false">关闭</button>
                        <template v-else>
                            <button class="api-delete-btn" style="margin:0; flex:1; padding:12px; background:rgba(0,0,0,0.05); color:#666;" @click="showEditModal = false">取消</button>
                            <button class="api-save-btn" style="margin:0; flex:1; padding:12px;" @click="saveEditMessage">保存</button>
                        </template>
                    </div>
                </div>
            </div>

            <!-- 思维殿堂 (Mind Space) -->
            <div class="mind-overlay" v-if="showOs" @click.stop>
                <div class="mind-header">
                    <div class="mind-title">Mind Space</div>
                    <div class="mind-close-btn" @click="showOs = false">
                        <i class="ri-close-line" style="font-size: 24px;"></i>
                    </div>
                </div>

                <div class="mind-stream" ref="osScrollRef">
                    <div v-if="osHistory.length === 0" class="mind-empty">
                        <i class="ri-bubble-chart-line"></i>
                        <span>此处空空如也，暂无心声</span>
                    </div>

                    <div v-for="(item, idx) in osHistory" :key="idx" class="mind-card" :style="{ animationDelay: idx * 0.05 + 's' }">
                        <div class="mind-meta">
                            <div class="mind-avatar" :style="{ backgroundImage: 'url(' + (item.role === 'user' ? userAvatarDisplay : aiAvatarDisplay) + ')' }"></div>
                            <span class="mind-role">{{ item.role === 'user' ? 'Me' : 'Char' }}</span>
                        </div>
                        <div class="mind-actions">
                            <i class="ri-edit-line mind-action-btn" @click="editOs(item)"></i>
                            <i class="ri-delete-bin-line mind-action-btn del" @click="deleteOs(item)"></i>
                        </div>
                        <div v-if="editingOsIndex === item.originalIndex">
                            <textarea 
                                v-model="tempOsContent" 
                                class="mind-edit-area" 
                                ref="osEditInput"
                                @blur="saveOs(item.originalIndex)"
                                @keyup.enter.ctrl="saveOs(item.originalIndex)"
                            ></textarea>
                            <div style="font-size: 11px; color: #999; margin-top: 5px;">按 Ctrl+Enter 保存，或点击外部</div>
                        </div>
                        <div v-else class="mind-text">{{ item.os }}</div>
                    </div>
                </div>
            </div>

            <!-- 右键菜单 -->
            <div class="context-menu-overlay" v-if="contextMenu.visible" @click="closePopups">
                <div class="context-menu" :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }" @click.stop>
                    <div class="menu-item" @click="menuAction('copy')"><i class="ri-file-copy-line"></i> 复制</div>
                    <div class="menu-item" v-if="contextMenu.role !== 'system'" @click="menuAction('quote')"><i class="ri-chat-quote-line"></i> 引用</div>
                    <div class="menu-item" v-if="contextMenu.role !== 'system'" @click="menuAction('edit')"><i class="ri-edit-line"></i> 编辑</div>
                    <div class="menu-item" v-if="contextMenu.role === 'user'" @click="menuAction('recall')"><i class="ri-arrow-go-back-line"></i> 撤回</div>
                    <div class="menu-item" @click="menuAction('multi')"><i class="ri-checkbox-multiple-line"></i> 多选</div>
                    <div class="menu-item danger" @click="menuAction('delete')"><i class="ri-delete-bin-line"></i> 删除</div>
                </div>
            </div>

            <!-- 删除确认弹窗 -->
            <div v-if="showDeleteModal" class="center-modal-overlay" @click="showDeleteModal = false" style="z-index: 500;">
                <div class="center-modal-box" @click.stop>
                    <h3 style="text-align: center; font-size: 16px; color: #ff3b30;">确认删除?</h3>
                    <p style="text-align: center; font-size: 13px; color: #666; margin-bottom: 10px;">即将删除 {{ deleteTargetIndices.length }} 条消息。</p>
                    <div style="display: flex; gap: 10px; width: 100%;">
                        <button class="api-save-btn" style="margin:0; flex:1; padding:12px; background:rgba(0,0,0,0.05); color:#666;" @click="showDeleteModal = false">取消</button>
                        <button class="api-delete-btn" style="margin:0; flex:1; padding:12px;" @click="confirmDeleteAction">删除</button>
                    </div>
                </div>
            </div>

            <!-- Toast 提示 -->
            <transition name="fade">
                <div v-if="toastMsg" style="position: absolute; bottom: 100px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: #fff; padding: 10px 24px; border-radius: 24px; font-size: 14px; font-weight: 500; z-index: 3000; pointer-events: none; white-space: nowrap; backdrop-filter: blur(4px);">
                    {{ toastMsg }}
                </div>
            </transition>
        </div>
    `,
    setup(props, { emit }) {
        const isSettingOpen = ref(false);
        const containerStyle = ref({ background: '#f2f4f6', backgroundSize: 'cover', backgroundPosition: 'center' });
        const showOs = ref(false);
        const contextMenu = reactive({ visible: false, x: 0, y: 0, index: -1, role: '' });
        const isMultiSelect = ref(false);
        const selectedIndices = ref([]);
        const inputBarRef = ref(null);
        
        const showStatusModal = ref(false);
        const tempStatusValue = ref('');
        const showEditModal = ref(false);
        const tempEditContent = ref('');
        const editIndex = ref(-1);
        const isReadOnlyMode = ref(false);
        const showDeleteModal = ref(false);
        const deleteTargetIndices = ref([]);
        const showPhotoDialog = ref(false);
        const tempPhotoDesc = ref('');

        const toastMsg = ref('');

        const scrollRef = ref(null);
        const osScrollRef = ref(null);
        const editingOsIndex = ref(-1);
        const tempOsContent = ref('');
        const osEditInput = ref(null);

        const aiAvatarDisplay = computed(() => props.session.avatar || generateAvatar(props.session.name, 'assistant'));
        const userAvatarDisplay = computed(() => props.session.settings.userAvatar || generateAvatar(props.session.settings.userName, 'user'));

        const scrollToBottom = () => { if (scrollRef.value) scrollRef.value.scrollTop = scrollRef.value.scrollHeight; };
        
        watch(() => props.session.id, (newId) => { 
            nextTick(scrollToBottom); 
        }, { immediate: true });
        
        watch(() => props.session.settings.background, (newBg) => {
             containerStyle.value.backgroundImage = newBg ? `url(${newBg})` : 'none';
        }, { immediate: true });

        watch(() => props.session.messages.length, () => { nextTick(scrollToBottom); });

        const displayName = computed(() => props.session.isGenerating ? '对方正在输入...' : props.session.name);
        const displayStatus = computed(() => props.session.status || '在线');

        const osHistory = computed(() => {
            return props.session.messages
                .map((m, idx) => ({ ...m, originalIndex: idx }))
                .filter(m => (m.role === 'assistant' || m.role === 'user') && m.os)
                .reverse(); 
        });

        const handleSettingsUpdate = (updatedSession) => { emit('update-session', updatedSession); };
        const handleClearHistory = () => { props.session.messages = []; props.session.lastMessage = ''; emit('update-session', props.session); isSettingOpen.value = false; };
        
        const toggleOs = () => { showOs.value = !showOs.value; };
        
        const editOs = (item) => { 
            editingOsIndex.value = item.originalIndex; 
            tempOsContent.value = item.os; 
            nextTick(() => { if (osEditInput.value) osEditInput.value.focus(); });
        };
        const saveOs = (idx) => { 
            if (props.session.messages[idx]) { 
                props.session.messages[idx].os = tempOsContent.value; 
                emit('update-session', props.session); 
            } 
            editingOsIndex.value = -1; 
        };
        const deleteOs = (item) => { 
            if (confirm('删除这条心声?')) { 
                if (props.session.messages[item.originalIndex]) { 
                    delete props.session.messages[item.originalIndex].os; 
                    emit('update-session', props.session); 
                } 
            } 
        };

        const closePopups = () => { contextMenu.visible = false; showOs.value = false; if (inputBarRef.value) inputBarRef.value.closeMenu(); };
        
        const openStatusModal = () => { tempStatusValue.value = props.session.status || '在线'; showStatusModal.value = true; };
        const saveStatus = () => { props.session.status = tempStatusValue.value; emit('update-session', props.session); showStatusModal.value = false; };
        
        const showToast = (msg) => {
            toastMsg.value = msg;
            setTimeout(() => { toastMsg.value = ''; }, 2000);
        };

        const confirmFakePhoto = () => { if (tempPhotoDesc.value.trim()) { const fakePhotoText = `(发送了一张照片: ${tempPhotoDesc.value})`; emit('trigger-generate', { sessionId: props.session.id, text: fakePhotoText }); } tempPhotoDesc.value = ''; showPhotoDialog.value = false; };

        const handleSendOnly = (payload) => { 
            emit('trigger-send', { sessionId: props.session.id, ...payload }); 
        };
        
        const handleGenerate = (payload) => { 
            emit('trigger-generate', { sessionId: props.session.id, ...payload }); 
        };
        
        const handleRegenerate = () => { 
            const msgs = props.session.messages; 
            let lastUserIndex = -1; 
            for (let i = msgs.length - 1; i >= 0; i--) { 
                if (msgs[i].role === 'user') { lastUserIndex = i; break; } 
            } 
            if (lastUserIndex !== -1) { 
                if (lastUserIndex < msgs.length - 1) msgs.splice(lastUserIndex + 1); 
                emit('update-session', props.session); 
                emit('trigger-generate', { sessionId: props.session.id }); 
            } 
        };

        const openContextMenu = ({ x, y, index }) => { 
            const menuWidth = 140; const menuHeight = 220; 
            if (x + menuWidth > window.innerWidth) x -= menuWidth; 
            if (y + menuHeight > window.innerHeight) y -= menuHeight; 
            contextMenu.x = x; contextMenu.y = y; contextMenu.index = index; 
            contextMenu.role = props.session.messages[index].role; 
            contextMenu.visible = true; 
        };

        const menuAction = (action) => {
            const idx = contextMenu.index; 
            const msg = props.session.messages[idx]; 
            contextMenu.visible = false;
            
            if (action === 'copy') { 
                if (msg.role !== 'system') {
                    navigator.clipboard.writeText(msg.content).then(() => {
                        showToast('已复制');
                    }).catch(() => {
                        showToast('复制失败');
                    });
                }
            }
            else if (action === 'delete') { deleteTargetIndices.value = [idx]; showDeleteModal.value = true; }
            else if (action === 'quote') { if (msg.role !== 'system' && inputBarRef.value) inputBarRef.value.setQuote({ name: msg.role === 'user' ? '我' : props.session.name, content: msg.content }); }
            else if (action === 'recall') { if (msg.role === 'user') { props.session.messages[idx] = { role: 'system', content: '你撤回了一条消息', originalContent: msg.content, isRecall: true }; emit('update-session', props.session); } }
            else if (action === 'edit') { if (msg.role !== 'system') { tempEditContent.value = msg.content; editIndex.value = idx; isReadOnlyMode.value = false; showEditModal.value = true; } }
            else if (action === 'multi') { isMultiSelect.value = true; selectedIndices.value = [idx]; }
        };

        const saveEditMessage = () => { if (editIndex.value > -1 && tempEditContent.value.trim()) { props.session.messages[editIndex.value].content = tempEditContent.value; emit('update-session', props.session); } showEditModal.value = false; };
        const handleViewRecall = (msg) => { tempEditContent.value = msg.originalContent || '无法找回内容'; isReadOnlyMode.value = true; showEditModal.value = true; };
        
        const toggleSelect = (index) => { const i = selectedIndices.value.indexOf(index); if (i > -1) selectedIndices.value.splice(i, 1); else selectedIndices.value.push(index); };
        const triggerBatchDelete = () => { if (selectedIndices.value.length === 0) return; deleteTargetIndices.value = [...selectedIndices.value]; showDeleteModal.value = true; };
        const confirmDeleteAction = () => { const sortedIndices = [...deleteTargetIndices.value].sort((a, b) => b - a); sortedIndices.forEach(idx => props.session.messages.splice(idx, 1)); selectedIndices.value = []; isMultiSelect.value = false; emit('update-session', props.session); showDeleteModal.value = false; };

        return { 
            isSettingOpen, displayName, displayStatus, containerStyle, aiAvatarDisplay, userAvatarDisplay, handleClearHistory, 
            showOs, toggleOs, osHistory, editOs, saveOs, deleteOs, editingOsIndex, tempOsContent, osScrollRef, osEditInput,
            contextMenu, openContextMenu, closePopups, menuAction, 
            isMultiSelect, selectedIndices, toggleSelect, inputBarRef, 
            showStatusModal, tempStatusValue, openStatusModal, saveStatus, 
            showEditModal, tempEditContent, saveEditMessage, isReadOnlyMode, handleViewRecall, 
            scrollRef, showDeleteModal, deleteTargetIndices, triggerBatchDelete, confirmDeleteAction, 
            handleSettingsUpdate, handleSendOnly, handleGenerate, handleRegenerate,
            showPhotoDialog, tempPhotoDesc, confirmFakePhoto,
            toastMsg
        };
    }
};
