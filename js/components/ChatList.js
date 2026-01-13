import { ref, nextTick } from 'vue';
import ChatHeader from './ChatHeader.js';
import { generateAvatar } from '../store.js'; // 引入生成器

export default {
    components: { ChatHeader },
    props: ['sessions'], 
    emits: ['open-session', 'close', 'create-session', 'delete-session'],
    template: `
        <div class="app-window" style="height: 100%; display: flex; flex-direction: column; background: #f2f4f6; position: relative;">
            <chat-header name="消息列表" :show-avatar="false" @back="$emit('close')">
                <template #right>
                    <i class="ri-add-circle-line" style="font-size: 26px; cursor: pointer; color: #007aff;" @click="openCreateModal"></i>
                </template>
            </chat-header>

            <div style="flex: 1; overflow-y: auto;">
                <div class="chat-list-container">
                    <div v-for="session in sessions" :key="session.id" class="chat-session-card" @click="$emit('open-session', session.id)">
                        <!-- [更新] 使用 generateAvatar -->
                        <div class="chat-avatar" :style="{ backgroundImage: 'url(' + (session.avatar || getAvatar(session.name)) + ')' }"></div>
                        <div class="chat-info">
                            <div class="chat-name-row">
                                <span class="chat-name">{{ session.name }}</span>
                                <span class="chat-time">{{ formatTime(session.lastTime) }}</span>
                            </div>
                            <div class="chat-msg-preview">
                                <span v-if="session.isGenerating" style="color:#007aff;">[对方正在输入...]</span>
                                <span v-else>{{ session.lastMessage || '点击开始聊天...' }}</span>
                            </div>
                        </div>
                        <div class="chat-del-btn" @click.stop="confirmDelete(session.id)"><i class="ri-close-circle-fill" style="font-size: 20px;"></i></div>
                    </div>
                    <div v-if="sessions.length === 0" style="text-align: center; color: #999; margin-top: 50px; font-size: 14px;">
                        <i class="ri-chat-smile-2-line" style="font-size: 40px; margin-bottom: 10px; display:block;"></i>暂无会话
                    </div>
                </div>
            </div>

            <div v-if="showCreate" class="center-modal-overlay" @click="showCreate = false" style="z-index: 500;">
                <div class="center-modal-box" @click.stop>
                    <h3 style="text-align: center; font-size: 16px; margin-bottom: 5px;">新建会话</h3>
                    <input ref="nameInput" v-model="newName" class="glass-input" style="text-align: center;" @keyup.enter="handleCreate" placeholder="例如：我的助理">
                    <div style="display: flex; gap: 10px; width: 100%; margin-top: 10px;">
                        <button class="api-delete-btn" style="margin:0; flex:1; padding:12px; background:rgba(0,0,0,0.05); color:#666;" @click="showCreate = false">取消</button>
                        <button class="api-save-btn" style="margin:0; flex:1; padding:12px;" @click="handleCreate">创建</button>
                    </div>
                </div>
            </div>
            <div v-if="showDelete" class="center-modal-overlay" @click="showDelete = false" style="z-index: 500;">
                <div class="center-modal-box" @click.stop>
                    <h3 style="text-align: center; font-size: 16px; color: #ff3b30;">确认删除?</h3>
                    <p style="text-align: center; font-size: 13px; color: #666; margin-bottom: 10px;">聊天记录将无法恢复。</p>
                    <div style="display: flex; gap: 10px; width: 100%;">
                        <button class="api-save-btn" style="margin:0; flex:1; padding:12px; background:rgba(0,0,0,0.05); color:#666;" @click="showDelete = false">取消</button>
                        <button class="api-delete-btn" style="margin:0; flex:1; padding:12px;" @click="handleDelete">删除</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        const showCreate = ref(false);
        const newName = ref('');
        const nameInput = ref(null);
        const showDelete = ref(false);
        const deleteTargetId = ref(null);

        const openCreateModal = () => { newName.value = ''; showCreate.value = true; nextTick(() => { if(nameInput.value) nameInput.value.focus(); }); };
        const handleCreate = () => {
            if (!newName.value.trim()) return;
            const name = newName.value.trim();
            const newSession = { id: Date.now(), name: name, avatar: '', lastMessage: '', lastTime: Date.now(), messages: [], isGenerating: false, settings: { aiName: name, userName: '我', systemPrompt: '', background: '' } };
            emit('create-session', newSession); showCreate.value = false;
        };
        const confirmDelete = (id) => { deleteTargetId.value = id; showDelete.value = true; };
        const handleDelete = () => { if (deleteTargetId.value) emit('delete-session', deleteTargetId.value); showDelete.value = false; };
        
        const getAvatar = (name) => generateAvatar(name, 'assistant');
        
        const formatTime = (ts) => { if (!ts) return ''; const date = new Date(ts); const now = new Date(); if (date.toDateString() === now.toDateString()) return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`; return `${date.getMonth() + 1}/${date.getDate()}`; };

        return { showCreate, newName, nameInput, openCreateModal, handleCreate, confirmDelete, handleDelete, showDelete, getAvatar, formatTime };
    }
};
