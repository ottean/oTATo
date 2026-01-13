import { ref } from 'vue';
import ChatHeader from './ChatHeader.js';

export default {
    components: { ChatHeader },
    props: ['settings'], 
    emits: ['close', 'update:settings'],
    template: `
        <div class="app-window settings-window">
            <chat-header name="系统设置" :show-avatar="false" @back="$emit('close')"></chat-header>
            
            <div class="settings-content">
                
                <!-- 1. 外观设置 -->
                <div class="section-card">
                    <div class="section-header">显示与外观</div>
                    
                    <div class="switch-row">
                        <span>沉浸全屏模式</span>
                        <label class="toggle-switch">
                            <input type="checkbox" v-model="localSettings.isFullscreen">
                            <span class="slider"></span>
                        </label>
                    </div>

                    <div class="switch-row">
                        <span>显示状态栏</span>
                        <label class="toggle-switch">
                            <input type="checkbox" v-model="localSettings.showStatusBar">
                            <span class="slider"></span>
                        </label>
                    </div>

                    <div class="switch-row">
                        <span>桌面时钟组件</span>
                        <label class="toggle-switch">
                            <input type="checkbox" v-model="localSettings.showDesktopTime">
                            <span class="slider"></span>
                        </label>
                    </div>

                    <div class="switch-row">
                        <span>桌面灵动卡片</span>
                        <label class="toggle-switch">
                            <input type="checkbox" v-model="localSettings.showDesktopCard">
                            <span class="slider"></span>
                        </label>
                    </div>

                    <!-- 桌面壁纸设置 -->
                    <div class="wallpaper-section">
                        <label class="mini-label">桌面壁纸</label>
                        
                        <!-- 背景图路径必须动态绑定，其他样式走 CSS -->
                        <div class="bg-uploader wallpaper-uploader" 
                             @click="triggerWallpaper" 
                             :style="{ backgroundImage: localSettings.desktopWallpaper ? 'url(' + localSettings.desktopWallpaper + ')' : 'none' }"
                        >
                            <div class="bg-placeholder" v-if="!localSettings.desktopWallpaper">
                                <i class="ri-image-2-line"></i>
                                <span>点击设定桌面壁纸</span>
                            </div>
                            <div v-else class="edit-badge wallpaper-edit-badge">
                                <i class="ri-edit-line"></i>
                            </div>
                        </div>
                        <input type="file" ref="wallpaperInput" accept="image/*" style="display:none" @change="handleWallpaperChange">
                        
                        <!-- 移除按钮 (保留 v-if) -->
                        <button v-if="localSettings.desktopWallpaper" 
                            class="danger-btn wallpaper-remove-btn" 
                            @click="localSettings.desktopWallpaper = ''">
                            <i class="ri-delete-bin-line"></i> 移除壁纸恢复默认
                        </button>
                    </div>

                     <div class="switch-row css-switch-row">
                        <span>启用全局 CSS</span>
                        <label class="toggle-switch">
                            <input type="checkbox" v-model="localSettings.enableCustomCss">
                            <span class="slider"></span>
                        </label>
                    </div>
                    
                    <div v-if="localSettings.enableCustomCss" class="css-editor-area">
                        <label class="mini-label">全局样式代码</label>
                        <textarea v-model="localSettings.globalCss" class="glass-textarea code-font" placeholder="/* body { ... } */"></textarea>
                    </div>
                </div>

                <!-- 2. 数据管理 -->
                <div class="section-card">
                    <div class="section-header">数据备份与恢复</div>
                    <div class="backup-desc">
                        将所有聊天记录、世界书、API配置导出为 JSON 文件，或从文件恢复。
                    </div>

                    <div class="backup-btn-group">
                        <button class="api-save-btn btn-blue" @click="handleExport">
                            <i class="ri-download-cloud-2-line"></i> 导出备份
                        </button>
                        <button class="api-save-btn btn-orange" @click="triggerImport">
                            <i class="ri-upload-cloud-2-line"></i> 导入恢复
                        </button>
                    </div>
                    
                    <input type="file" ref="fileInput" accept=".json" style="display:none" @change="handleImport">

                    <button class="danger-btn margin-top-15" @click="handleReset">
                        <i class="ri-delete-bin-2-line"></i> 重置所有数据
                    </button>
                </div>

                <div class="app-version">
                    TaTaOs v1.0.0 (Build 27)
                </div>

            </div>
        </div>
    `,
    setup(props) {
        const localSettings = props.settings;
        const fileInput = ref(null);
        const wallpaperInput = ref(null);

        // --- 备份逻辑 ---
        const handleExport = () => {
            const data = {
                version: 1,
                timestamp: Date.now(),
                sessions: localStorage.getItem('ai_phone_sessions'),
                worldbooks: localStorage.getItem('ai_phone_worldbooks_v2'),
                profiles: localStorage.getItem('ai_phone_profiles'),
                cards: localStorage.getItem('ai_phone_cards'), 
                globalSettings: localStorage.getItem('ai_phone_global_settings'),
                activeId: localStorage.getItem('ai_phone_active_id')
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const dateStr = new Date().toISOString().slice(0,10);
            a.download = `TaTaOs_Backup_${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };

        const triggerImport = () => { fileInput.value.click(); };

        const handleImport = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const json = JSON.parse(e.target.result);
                    if (!json.version) throw new Error("无效的备份文件格式");
                    if (confirm(`检测到备份时间: ${new Date(json.timestamp).toLocaleString()}\n确定要覆盖当前所有数据吗？此操作不可撤销。`)) {
                        if (json.sessions) localStorage.setItem('ai_phone_sessions', json.sessions);
                        if (json.worldbooks) localStorage.setItem('ai_phone_worldbooks_v2', json.worldbooks);
                        if (json.profiles) localStorage.setItem('ai_phone_profiles', json.profiles);
                        if (json.cards) localStorage.setItem('ai_phone_cards', json.cards);
                        if (json.globalSettings) localStorage.setItem('ai_phone_global_settings', json.globalSettings);
                        if (json.activeId) localStorage.setItem('ai_phone_active_id', json.activeId);
                        alert("✅ 数据恢复成功！页面即将刷新...");
                        location.reload();
                    }
                } catch (err) {
                    alert("❌ 导入失败: " + err.message);
                }
            };
            reader.readAsText(file);
            event.target.value = '';
        };

        const handleReset = () => {
            const confirmStr = prompt("⚠️ 警告：这将清空所有聊天记录、设置和 API Key！\n请输入 'RESET' 确认重置：");
            if (confirmStr === 'RESET') {
                localStorage.clear();
                location.reload();
            }
        };

        // --- 壁纸逻辑 ---
        const triggerWallpaper = () => { wallpaperInput.value.click(); };
        
        const handleWallpaperChange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                localSettings.desktopWallpaper = evt.target.result;
            };
            reader.readAsDataURL(file);
            e.target.value = ''; 
        };

        return { 
            localSettings, 
            handleExport, triggerImport, handleImport, fileInput, handleReset,
            wallpaperInput, triggerWallpaper, handleWallpaperChange 
        };
    }
};
