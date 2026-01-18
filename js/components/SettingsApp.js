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
                
                <!-- 1. 数据管理 -->
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

                <!-- 2. 关于 -->
                <div class="section-card">
                    <div class="section-header">关于系统</div>
                    <div style="font-size: 13px; color: #666; line-height: 1.6; text-align: center;">
                        <p style="font-weight: 600;">v1.0.5 (Build 33)</p>
                    </div>
                </div>

                <div class="app-version">
                    Powered by Zoelle
                </div>

            </div>
        </div>
    `,
    setup(props) {
        const fileInput = ref(null);

        const handleExport = () => {
            const data = {
                version: 1,
                timestamp: Date.now(),
                sessions: localStorage.getItem('ai_phone_sessions'),
                worldbooks: localStorage.getItem('ai_phone_worldbooks_v2'),
                profiles: localStorage.getItem('ai_phone_profiles'),
                cards: localStorage.getItem('ai_phone_cards'), 
                globalSettings: localStorage.getItem('ai_phone_global_settings'),
                activeId: localStorage.getItem('ai_phone_active_id'),
                stickers: localStorage.getItem('ai_phone_stickers') 
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
                        if (json.stickers) localStorage.setItem('ai_phone_stickers', json.stickers);
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

        return { 
            handleExport, triggerImport, handleImport, fileInput, handleReset
        };
    }
};
