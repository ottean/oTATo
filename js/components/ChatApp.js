import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import ChatList from './ChatList.js';
import ChatRoom from './ChatRoom.js'; 
import { store, createSession, deleteSession, updateSession, sendUserMessage, generateAiMessage } from '../store.js';

export default {
    components: { ChatList, ChatRoom },
    emits: ['close'],
    template: `
        <div style="height: 100%; position: relative;">
            <transition name="slide">
                <chat-room 
                    v-if="currentSessionId" 
                    :session="currentSession"
                    @back="closeSession"
                    @trigger-send="onSend"
                    @trigger-generate="onGenerate"
                    @update-session="onUpdateSession"
                    @delete-session="onDeleteSession"
                ></chat-room>

                <chat-list 
                    v-else 
                    :sessions="store.sessions"
                    @open-session="openSession"
                    @create-session="onCreateSession"
                    @delete-session="onDeleteSession"
                    @close="$emit('close')"
                ></chat-list>
            </transition>
        </div>
    `,
    setup() {
        const currentSessionId = ref(null);
        
        const currentSession = computed(() => store.sessions.find(s => s.id === currentSessionId.value));

        // [修复] 实时同步当前查看的 Session ID 到 Store，用于判断弹窗
        watch(currentSessionId, (newId) => {
            store.currentViewingSessionId = newId;
        }, { immediate: true });

        // 组件销毁时（如切回桌面），清空 ViewingID，确保后台生成能触发弹窗
        onUnmounted(() => {
            store.currentViewingSessionId = null;
        });

        const openSession = (id) => { 
            currentSessionId.value = id; 
            store.notification.show = false; 
        };

        const closeSession = () => {
            currentSessionId.value = null;
        };

        // 处理从通知跳转
        watch(() => store.targetSessionId, (newId) => {
            if (newId) {
                openSession(newId);
                store.targetSessionId = null; 
            }
        }, { immediate: true });

        const onCreateSession = (s) => { createSession(s); openSession(s.id); };
        const onDeleteSession = (id) => { 
            deleteSession(id); 
            if (currentSessionId.value === id) currentSessionId.value = null; 
        };
        const onUpdateSession = (s) => { updateSession(s); };
        
        const onSend = (payload) => { sendUserMessage(payload); };
        
        // [修复] 不再传递 currentSessionId，generateAiMessage 内部会自动读取 store
        const onGenerate = (payload) => { generateAiMessage(payload); };

        return { 
            store, 
            currentSessionId, 
            currentSession, 
            openSession,
            closeSession,
            onCreateSession, 
            onDeleteSession, 
            onUpdateSession, 
            onSend, 
            onGenerate 
        };
    }
};
