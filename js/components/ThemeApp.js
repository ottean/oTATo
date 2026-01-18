import { ref, onMounted, watch, computed } from 'vue';
import ChatHeader from './ChatHeader.js';

export default {
    components: { ChatHeader },
    props: ['settings'], 
    emits: ['close', 'update:settings'],
    template: `
        <div class="app-window settings-window">
            
            <chat-header 
                :name="pageTitle" 
                :show-avatar="false" 
                @back="handleBack"
            ></chat-header>
            
            <div class="settings-content">
                
                <!-- ==================== 0. 首页 ==================== -->
                <transition name="fade" mode="out-in">
                    <div v-if="currentView === 'main'" key="main">
                        
                        <!-- 1. 壁纸预览 -->
                        <div class="section-card" style="padding: 10px; overflow: hidden; position: relative;">
                            <div class="bg-uploader wallpaper-uploader" 
                                 @click="triggerWallpaper" 
                                 :style="{ backgroundImage: localSettings.desktopWallpaper ? 'url(' + localSettings.desktopWallpaper + ')' : 'none', height: '200px', borderRadius: '16px' }"
                            >
                                <div class="bg-placeholder" v-if="!localSettings.desktopWallpaper" style="background: rgba(0,0,0,0.02);">
                                    <i class="ri-image-add-line" style="font-size: 32px; color: #ccc; margin-bottom: 8px;"></i>
                                    <span style="font-size: 13px; color: #999;">点击设定桌面壁纸</span>
                                </div>
                                <div v-else class="wallpaper-actions-overlay">
                                    <div class="edit-badge" style="position: relative; margin-bottom: 5px;"><i class="ri-edit-line"></i></div>
                                    <span style="font-size: 12px; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.5);">更换壁纸</span>
                                </div>
                                <div v-if="localSettings.desktopWallpaper" @click.stop="localSettings.desktopWallpaper = ''" 
                                     style="position: absolute; top: 15px; right: 15px; width: 32px; height: 32px; background: rgba(0,0,0,0.5); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; backdrop-filter: blur(4px);">
                                    <i class="ri-close-line"></i>
                                </div>
                            </div>
                            <input type="file" ref="wallpaperInput" accept="image/*" style="display:none" @change="handleWallpaperChange">
                        </div>

                        <!-- 2. 桌面组件模式选择 -->
                        <div class="section-card">
                            <div class="section-header">桌面组件模式</div>
                            <div class="segment-control" style="margin-bottom: 15px;">
                                <div class="segment-item" :class="{ active: !localSettings.widgetMode || localSettings.widgetMode === 'clock' }" @click="localSettings.widgetMode = 'clock'">
                                    <i class="ri-time-line"></i> 时钟
                                </div>
                                <div class="segment-item" :class="{ active: localSettings.widgetMode === 'hero' }" @click="localSettings.widgetMode = 'hero'">
                                    <i class="ri-layout-top-2-line"></i> Hero
                                </div>
                                <div class="segment-item" :class="{ active: localSettings.widgetMode === 'card' }" @click="localSettings.widgetMode = 'card'">
                                    <i class="ri-slideshow-line"></i> 轮播
                                </div>
                                <div class="segment-item" :class="{ active: localSettings.widgetMode === 'off' }" @click="localSettings.widgetMode = 'off'">
                                    <i class="ri-eye-off-line"></i> 隐藏
                                </div>
                            </div>

                            <!-- 模式说明 -->
                            <div v-if="!localSettings.widgetMode || localSettings.widgetMode === 'clock'" style="font-size: 12px; color: #666; padding: 0 5px;">
                                显示系统默认的杂志风时钟。简洁、实用。
                            </div>
                            <div v-else-if="localSettings.widgetMode === 'card'" style="font-size: 12px; color: #666; padding: 0 5px;">
                                显示多张可滑动的卡片。在桌面<b>右键点击卡片</b>可进行编辑。
                            </div>
                            <div v-else-if="localSettings.widgetMode === 'off'" style="font-size: 12px; color: #666; padding: 0 5px;">
                                不显示任何顶部组件，仅展示 App 图标。
                            </div>

                            <!-- 模式 C: Hero 海报控制面板 -->
                            <div v-else-if="localSettings.widgetMode === 'hero'">
                                <!-- A. 未上传状态 -->
                                <div v-if="!localSettings.widgetImage" 
                                     class="bg-uploader" 
                                     @click="triggerWidgetBg"
                                     style="height: 100px; border: 2px dashed #e0e0e0; background: #fafafa; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; border-radius: 16px;"
                                >
                                    <i class="ri-upload-cloud-2-line" style="font-size: 28px; color: #bbb; margin-bottom: 5px;"></i>
                                    <span style="font-size: 12px; color: #999;">上传图片开启 Hero 模式</span>
                                </div>

                                <!-- B. 已上传状态 -->
                                <div v-else>
                                    <!-- 实时预览卡片 -->
                                    <div class="hero-widget" 
                                         style="height: 180px; margin-bottom: 15px; position: relative; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); display: flex; flex-direction: column;"
                                         :style="[
                                            { 
                                                backgroundImage: 'url(' + localSettings.widgetImage + ')', 
                                                backgroundPositionY: (localSettings.widgetPosY || 50) + '%', 
                                                backgroundSize: 'cover' 
                                            },
                                            localSettings.widgetCss
                                         ]"
                                    >
                                        <div @click="localSettings.widgetImage = ''" 
                                             style="position: absolute; top: 10px; right: 10px; width: 28px; height: 28px; background: rgba(0,0,0,0.6); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; cursor: pointer; z-index: 20; backdrop-filter: blur(4px);">
                                            <i class="ri-close-line"></i>
                                        </div>

                                        <!-- 内容层 -->
                                        <div class="hero-content" style="position: static; background: transparent; padding: 20px; width: 100%;">
                                            <div class="hero-sub">{{ localSettings.widgetSub || 'SUBTITLE' }}</div>
                                            <div class="hero-title">{{ localSettings.widgetTitle || 'Title Here' }}</div>
                                        </div>
                                    </div>

                                    <!-- 标题设置 -->
                                    <div class="form-group">
                                        <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                                            <input type="text" v-model="localSettings.widgetTitle" class="glass-input-sm" placeholder="主标题" style="flex: 1; text-align: left;">
                                            <input type="text" v-model="localSettings.widgetSub" class="glass-input-sm" placeholder="副标题" style="flex: 1; text-align: left;">
                                        </div>
                                    </div>

                                    <!-- 布局控制面板 -->
                                    <div class="form-group">
                                        <label class="mini-label">文字排版</label>
                                        <div class="segment-control" style="margin-bottom: 8px;">
                                            <div class="segment-item" :class="{ active: vAlign === 'flex-start' }" @click="setVAlign('flex-start')"><i class="ri-align-top"></i> 顶部</div>
                                            <div class="segment-item" :class="{ active: vAlign === 'center' }" @click="setVAlign('center')"><i class="ri-align-vertically"></i> 居中</div>
                                            <div class="segment-item" :class="{ active: vAlign === 'flex-end' }" @click="setVAlign('flex-end')"><i class="ri-align-bottom"></i> 底部</div>
                                        </div>
                                        <div class="segment-control">
                                            <div class="segment-item" :class="{ active: hAlign === 'flex-start' }" @click="setHAlign('flex-start')"><i class="ri-align-left"></i> 左侧</div>
                                            <div class="segment-item" :class="{ active: hAlign === 'center' }" @click="setHAlign('center')"><i class="ri-align-center"></i> 居中</div>
                                            <div class="segment-item" :class="{ active: hAlign === 'flex-end' }" @click="setHAlign('flex-end')"><i class="ri-align-right"></i> 右侧</div>
                                        </div>
                                    </div>

                                    <!-- 样式微调 -->
                                    <div style="display: flex; gap: 15px; margin-top: 15px;">
                                        <div style="flex: 1;">
                                            <label class="mini-label">图片重心 ({{ localSettings.widgetPosY || 50 }}%)</label>
                                            <input type="range" class="styled-range" v-model="localSettings.widgetPosY" min="0" max="100" step="1">
                                        </div>
                                        <div style="width: 120px;">
                                            <label class="mini-label">文字颜色</label>
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <div style="position: relative; width: 32px; height: 32px; border-radius: 50%; overflow: hidden; border: 2px solid rgba(0,0,0,0.1); box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                                                    <input type="color" v-model="customColor" style="opacity: 0; width: 100%; height: 100%; cursor: pointer;" @input="updateWidgetCss">
                                                    <div :style="{ background: customColor, position: 'absolute', inset: 0, pointerEvents: 'none' }"></div>
                                                </div>
                                                <input type="text" v-model="customColor" class="glass-input-sm" style="flex: 1; padding: 6px; font-family: monospace;" @input="updateWidgetCss">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <input type="file" ref="widgetBgInput" accept="image/*" style="display:none" @change="handleWidgetBgChange">
                            </div>
                        </div>

                        <!-- 3. 显示开关组 -->
                        <div class="section-card">
                            <div class="switch-row" style="border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 12px; margin-bottom: 12px;">
                                <div style="display:flex; align-items:center; gap: 10px;">
                                    <div style="width:32px; height:32px; background:#e3f2fd; color:#2196f3; border-radius:8px; display:flex; align-items:center; justify-content:center;"><i class="ri-fullscreen-line"></i></div>
                                    <span style="font-weight: 500;">沉浸全屏</span>
                                </div>
                                <label class="toggle-switch"><input type="checkbox" v-model="localSettings.isFullscreen"><span class="slider"></span></label>
                            </div>
                            <div class="switch-row">
                                <div style="display:flex; align-items:center; gap: 10px;">
                                    <div style="width:32px; height:32px; background:#f3e5f5; color:#9c27b0; border-radius:8px; display:flex; align-items:center; justify-content:center;"><i class="ri-layout-top-line"></i></div>
                                    <span style="font-weight: 500;">状态栏</span>
                                </div>
                                <label class="toggle-switch"><input type="checkbox" v-model="localSettings.showStatusBar"><span class="slider"></span></label>
                            </div>
                        </div>

                        <!-- 4. 底部入口 -->
                        <div style="display: flex; gap: 12px;">
                            <div class="section-card" @click="currentView = 'fonts'" style="flex: 1; margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; cursor: pointer;">
                                <div style="width: 40px; height: 40px; background: #fff8e1; color: #ffb300; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 8px;"><i class="ri-font-size"></i></div>
                                <div style="font-weight: 600; font-size: 13px;">字体管理</div>
                            </div>
                            <div class="section-card" @click="currentView = 'advanced'" style="flex: 1; margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; cursor: pointer;">
                                <div style="width: 40px; height: 40px; background: #e8eaf6; color: #3f51b5; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 8px;"><i class="ri-code-s-slash-line"></i></div>
                                <div style="font-weight: 600; font-size: 13px;">全局 CSS</div>
                            </div>
                        </div>

                    </div>

                    <!-- 子页面内容 (Fonts/Advanced) 保持不变 -->
                    <div v-else-if="currentView === 'fonts'" key="fonts">
                        <div class="section-card" style="margin-bottom: 15px;">
                            <div style="font-size:12px; color:#666; margin-bottom:10px;">添加网络字体链接 (URL)。</div>
                            <div style="display:flex; gap:8px; margin-bottom:8px;">
                                <input type="text" v-model="newFontName" class="glass-input-sm" placeholder="字体名称" style="flex:1;">
                                <button class="api-save-btn" @click="addFontToLibrary" style="margin:0; width:auto; padding:8px 15px; font-size:13px;">添加</button>
                            </div>
                            <input type="text" v-model="newFontUrl" class="glass-input-sm" placeholder="URL: https://..." style="width:100%;">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <div class="wb-item" :class="{ active: !localSettings.customFontData && !isGlobalCssFontActive }" @click="resetFont">
                                <div class="wb-icon" style="background:#eee; color:#666;"><i class="ri-font-sans-serif"></i></div>
                                <div class="wb-name">系统默认字体</div>
                                <i v-if="!localSettings.customFontData && !isGlobalCssFontActive" class="ri-check-line wb-check"></i>
                            </div>
                            <div v-for="(font, index) in fontLibrary" :key="index" class="wb-item" :class="{ active: isFontActive(font) }" @click="applyFont(font)">
                                <div class="wb-icon" style="background:#e3f2fd; color:#2196f3;"><i class="ri-text"></i></div>
                                <div class="wb-name" style="display:flex; flex-direction:column; align-items:flex-start;">
                                    <span>{{ font.name }}</span>
                                    <span style="font-size:10px; color:#999; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ font.url }}</span>
                                </div>
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <i v-if="isFontActive(font)" class="ri-check-line wb-check"></i>
                                    <i class="ri-delete-bin-line" style="color:#ff3b30; font-size:18px; padding:5px; z-index: 2;" @click.stop="deleteFont(index)"></i>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-else-if="currentView === 'advanced'" key="advanced">
                        <div class="section-card" style="height: 100%; display: flex; flex-direction: column; overflow: hidden;">
                            <div style="margin-bottom: 15px; flex-shrink: 0;">
                                <div style="font-size: 11px; font-weight: 600; color: #999; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Quick Snippets</div>
                                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                                    <div v-for="snip in cssSnippets" :key="snip.label" @click="appendSnippet(snip.code)"
                                         style="padding: 12px; background: #fff; border: 1px solid rgba(0,0,0,0.1); border-radius: 12px; font-size: 13px; font-weight: 500; color: #555; cursor: pointer; transition: all 0.2s; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px;"
                                    >
                                        <i class="ri-magic-line"></i> {{ snip.label }}
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-shrink: 0; background: rgba(255,255,255,0.4); padding: 8px 12px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.5);">
                                <div style="flex: 1; position: relative;">
                                    <select v-model="currentSchemeId" @change="loadScheme" style="width: 100%; appearance: none; -webkit-appearance: none; background: transparent; border: none; font-size: 14px; font-weight: 600; color: #333; outline: none;">
                                        <option value="">-- 选择预设方案 --</option>
                                        <option v-for="s in cssSchemes" :key="s.id" :value="s.id">{{ s.name }}</option>
                                    </select>
                                    <i class="ri-arrow-down-s-line" style="position: absolute; right: 0; top: 50%; transform: translateY(-50%); color: #999; pointer-events: none;"></i>
                                </div>
                                <div @click="saveScheme" style="width: 32px; height: 32px; background: #333; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.1);"><i class="ri-save-3-fill" style="font-size: 16px;"></i></div>
                                <div v-if="currentSchemeId" @click="deleteScheme" style="width: 32px; height: 32px; background: rgba(255,59,48,0.1); color: #ff3b30; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;"><i class="ri-delete-bin-fill" style="font-size: 16px;"></i></div>
                            </div>
                            <div style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
                                <div style="font-size: 11px; font-weight: 600; color: #999; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Custom CSS Editor</div>
                                <div class="css-editor-area" style="flex: 1; margin-top: 0; border: 1px solid rgba(0,0,0,0.1); border-radius: 16px; overflow: hidden; background: #fff;">
                                    <textarea v-model="localSettings.globalCss" class="glass-textarea code-font" placeholder="/* CSS 代码将自动生效 */" style="height: 100%; min-height: 250px; width: 100%; border: none; background: transparent; border-radius: 0; padding: 15px; font-size: 13px; resize: none;"></textarea>
                                </div>
                            </div>
                        </div>
                    </div>
                </transition>
            </div>

            <!-- 保存方案弹窗 -->
            <div v-if="showSaveModal" class="center-modal-overlay" @click="showSaveModal = false" style="z-index: 600;">
                <div class="center-modal-box" @click.stop>
                    <h3 style="text-align: center; font-size: 16px;">保存样式方案</h3>
                    <input v-model="newSchemeName" class="glass-input" placeholder="方案名称" style="margin: 15px 0;" @keyup.enter="confirmSaveScheme">
                    <div style="display: flex; gap: 10px; width: 100%;">
                        <button class="api-delete-btn" style="margin:0; flex:1; padding:12px; background:rgba(0,0,0,0.05); color:#666;" @click="showSaveModal = false">取消</button>
                        <button class="api-save-btn" style="margin:0; flex:1; padding:12px;" @click="confirmSaveScheme">保存</button>
                    </div>
                </div>
            </div>

        </div>
    `,
    setup(props, { emit }) {
        const localSettings = props.settings;
        const currentView = ref('main');
        
        const vAlign = ref('flex-end'); 
        const hAlign = ref('flex-start');
        const customColor = ref('#ffffff');

        const pageTitle = computed(() => {
            switch(currentView.value) {
                case 'fonts': return '字体库';
                case 'advanced': return '全局 CSS';
                default: return '主题美化';
            }
        });

        const handleBack = () => {
            if (currentView.value === 'main') emit('close');
            else currentView.value = 'main';
        };

        const updateWidgetCss = () => {
            let css = '';
            css += `justify-content: ${vAlign.value}; `;
            css += `align-items: ${hAlign.value}; `;
            let textAlign = 'left';
            if (hAlign.value === 'center') textAlign = 'center';
            if (hAlign.value === 'flex-end') textAlign = 'right';
            css += `text-align: ${textAlign}; `;
            css += `color: ${customColor.value};`;
            localSettings.widgetCss = css;
        };

        const setVAlign = (val) => { vAlign.value = val; updateWidgetCss(); };
        const setHAlign = (val) => { hAlign.value = val; updateWidgetCss(); };
        const toggleColor = (color) => { /* 废弃，改用 Color Picker */ };

        onMounted(() => {
            try { const saved = localStorage.getItem('ai_phone_css_schemes'); if (saved) cssSchemes.value = JSON.parse(saved); } catch(e) {}
            try { const savedFont = localStorage.getItem('ai_phone_font_library'); if (savedFont) fontLibrary.value = JSON.parse(savedFont); } catch(e) {}
            
            checkGlobalCssFont();
            if (localSettings.globalCss && localSettings.globalCss.length > 5) {
                localSettings.enableCustomCss = true;
            }

            if (!localSettings.widgetMode) localSettings.widgetMode = 'clock';

            if (localSettings.widgetCss) {
                if (localSettings.widgetCss.includes('justify-content: center')) vAlign.value = 'center';
                else if (localSettings.widgetCss.includes('justify-content: flex-start')) vAlign.value = 'flex-start';
                else vAlign.value = 'flex-end';

                if (localSettings.widgetCss.includes('align-items: center')) hAlign.value = 'center';
                else if (localSettings.widgetCss.includes('align-items: flex-end')) hAlign.value = 'flex-end';
                else hAlign.value = 'flex-start';

                const colorMatch = localSettings.widgetCss.match(/color:\s*([^;]+)/);
                if (colorMatch) customColor.value = colorMatch[1].trim();
            } else {
                updateWidgetCss();
            }
        });

        // ... (Wallpaper, WidgetBg, Font, CSS Scheme logic 保持不变) ...
        const wallpaperInput = ref(null);
        const widgetBgInput = ref(null);
        const triggerWallpaper = () => wallpaperInput.value.click();
        const triggerWidgetBg = () => widgetBgInput.value.click();
        const handleWallpaperChange = (e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader(); reader.onload = (evt) => localSettings.desktopWallpaper = evt.target.result; reader.readAsDataURL(file);
        };
        const handleWidgetBgChange = (e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader(); reader.onload = (evt) => localSettings.widgetImage = evt.target.result; reader.readAsDataURL(file);
        };

        const fontLibrary = ref([]);
        const newFontName = ref('');
        const newFontUrl = ref('');
        const isGlobalCssFontActive = ref(false);
        watch(() => localSettings.globalCss, (val) => { if (val && val.trim().length > 0) localSettings.enableCustomCss = true; checkGlobalCssFont(); });
        function checkGlobalCssFont() { isGlobalCssFontActive.value = (localSettings.globalCss && localSettings.globalCss.includes('@import') && localSettings.globalCss.includes('font-family')); }
        const saveLibrary = () => { localStorage.setItem('ai_phone_font_library', JSON.stringify(fontLibrary.value)); };
        const addFontToLibrary = () => { if (!newFontName.value.trim() || !newFontUrl.value.trim()) { alert("请填写名称和链接"); return; } fontLibrary.value.push({ name: newFontName.value.trim(), url: newFontUrl.value.trim() }); saveLibrary(); newFontName.value = ''; newFontUrl.value = ''; };
        const deleteFont = (index) => { if (confirm('删除此字体？')) { const target = fontLibrary.value[index]; if (isFontActive(target)) resetFont(); fontLibrary.value.splice(index, 1); saveLibrary(); } };
        const isFontActive = (font) => { if (localSettings.customFontData === font.url) return true; if (localSettings.globalCss && localSettings.globalCss.includes(font.url)) return true; return false; };
        const applyFont = (font) => { const url = font.url.trim(); if (url.includes('googleapis.com/css') || url.endsWith('.css')) { const importStmt = `@import url('${url}');\n`; const fontBodyRule = `body, button, input, textarea, .bubble { font-family: '${font.name}', 'Inter', sans-serif !important; }`; localSettings.enableCustomCss = true; let currentCss = localSettings.globalCss || ''; currentCss = currentCss.replace(/@import.*?;/g, '').replace(/body\s*,\s*button.*?{.*?font-family.*?;.*?}/g, ''); localSettings.globalCss = importStmt + (currentCss ? '\n' + currentCss : '') + '\n' + fontBodyRule; localSettings.customFontData = ''; } else { if (localSettings.globalCss) { localSettings.globalCss = localSettings.globalCss.replace(/@import.*?;/g, '').replace(/body\s*,\s*button.*?{.*?font-family.*?;.*?}/g, ''); } localSettings.customFontData = url; } };
        const resetFont = () => { localSettings.customFontData = ''; if (localSettings.globalCss) { localSettings.globalCss = localSettings.globalCss.replace(/@import.*?;/g, '').replace(/body\s*,\s*button.*?{.*?font-family.*?;.*?}/g, ''); } };
        const cssSchemes = ref([]);
        const currentSchemeId = ref('');
        const showSaveModal = ref(false);
        const newSchemeName = ref('');
        const cssSnippets = [{ label: '直角头像', code: '.msg-avatar { border-radius: 4px !important; }' }, { label: '隐藏头像', code: '.msg-avatar { display: none !important; }' }, { label: '透明气泡', code: '.msg-row.ai .bubble { background: rgba(255,255,255,0.3) !important; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.4); }' }, { label: '圆润气泡', code: '.bubble { border-radius: 20px !important; }' }, { label: '透明输入栏', code: '.input-area { background: transparent !important; border-top: none !important; backdrop-filter: none !important; }' }, { label: '隐藏名称', code: '.chat-name-row { display: none !important; }' }];
        const appendSnippet = (code) => { localSettings.enableCustomCss = true; localSettings.globalCss = (localSettings.globalCss || '') + '\n' + code + '\n'; };
        const saveScheme = () => { if (currentSchemeId.value) { const idx = cssSchemes.value.findIndex(s => s.id === currentSchemeId.value); if (idx > -1) { if (confirm(`覆盖方案 "${cssSchemes.value[idx].name}" ?`)) { cssSchemes.value[idx].code = localSettings.globalCss; persistSchemes(); alert('已更新'); } } } else { newSchemeName.value = ''; showSaveModal.value = true; } };
        const confirmSaveScheme = () => { if (!newSchemeName.value.trim()) return; const newId = Date.now().toString(); cssSchemes.value.push({ id: newId, name: newSchemeName.value.trim(), code: localSettings.globalCss }); currentSchemeId.value = newId; persistSchemes(); showSaveModal.value = false; };
        const loadScheme = () => { if (!currentSchemeId.value) return; const scheme = cssSchemes.value.find(s => s.id === currentSchemeId.value); if (scheme) localSettings.globalCss = scheme.code; };
        const deleteScheme = () => { if (!currentSchemeId.value) return; if (confirm('删除此方案？')) { cssSchemes.value = cssSchemes.value.filter(s => s.id !== currentSchemeId.value); currentSchemeId.value = ''; persistSchemes(); } };
        const persistSchemes = () => { localStorage.setItem('ai_phone_css_schemes', JSON.stringify(cssSchemes.value)); };

        return { 
            localSettings, currentView, pageTitle, handleBack,
            wallpaperInput, triggerWallpaper, handleWallpaperChange,
            widgetBgInput, triggerWidgetBg, handleWidgetBgChange,
            vAlign, hAlign, setVAlign, setHAlign, customColor, updateWidgetCss,
            fontLibrary, newFontName, newFontUrl, addFontToLibrary, deleteFont, applyFont, resetFont, isFontActive, isGlobalCssFontActive,
            cssSnippets, appendSnippet, cssSchemes, currentSchemeId, showSaveModal, newSchemeName, saveScheme, confirmSaveScheme, loadScheme, deleteScheme
        };
    }
};
