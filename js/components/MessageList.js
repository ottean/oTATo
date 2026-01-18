import { nextTick, watch, ref, onMounted, computed } from 'vue';
import { generateAvatar } from '../store.js';

export default {
    props: ['messages', 'userAvatar', 'aiAvatar', 'isMultiSelect', 'selectedIndices', 'sessionName', 'userName', 'enableTranslation'], 
    emits: ['show-context', 'toggle-select', 'view-recall', 'preview-image', 'update-message', 'view-transfer'], 
    template: `
        <div class="message-list" ref="listRef" :class="{ 'multi-select-mode': isMultiSelect }">
            <template v-for="(msg, index) in messages" :key="index">
                
                <div v-if="shouldShowMessage(msg)">
                    <!-- ... (模板内容保持不变) ... -->
                    <div class="msg-row-wrapper" @click="handleWrapperClick(index)">
                        <div class="msg-checkbox-col">
                            <i :class="selectedIndices.includes(index) ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'" 
                               :style="{ color: selectedIndices.includes(index) ? '#007aff' : '#ccc', fontSize: '24px' }">
                            </i>
                        </div>

                        <div v-if="msg.role === 'system'" class="system-msg-row" style="flex: 1;" @contextmenu.prevent="handleRightClick($event, index)">
                            <span class="system-text" :style="{ cursor: msg.isRecall ? 'pointer' : 'default' }" @click.stop="msg.isRecall ? $emit('view-recall', msg) : null">{{ msg.content }}</span>
                        </div>

                        <div v-else class="msg-row" :class="[msg.role === 'user' ? 'me' : 'ai', { 'selecting': isMultiSelect }]" @touchstart="startPress($event, index)" @touchend="endPress" @mousedown="startPress($event, index)" @mouseup="endPress" @mouseleave="endPress" @contextmenu.prevent="handleRightClick($event, index)">
                            <div v-if="msg.role !== 'user'" class="msg-avatar ai-avatar" :style="{ backgroundImage: 'url(' + (aiAvatar || defaultAi) + ')' }"></div>

                            <div class="msg-col">
                                <div v-if="msg.image" class="bubble" style="padding: 0; overflow: hidden; background: transparent; border: none; position: relative;" @click="handleImageClick(msg)">
                                    <img :src="msg.image" :class="getImageClass(msg)" />
                                    <div v-if="msg.fakePhotoContent && msg.showFakeContent" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 15px; color: #fff; font-size: 13px; text-align: center; border-radius: 16px;">{{ msg.fakePhotoContent }}</div>
                                </div>

                                <div v-else-if="msg.type === 'transfer' && msg.transfer" class="bubble-transfer" :class="{ 'received': msg.transfer.status === 'received', 'returned': msg.transfer.status === 'returned' }" @click.stop="$emit('view-transfer', msg)">
                                    <div class="transfer-content">
                                        <div class="transfer-icon-box">
                                            <i v-if="msg.transfer.status === 'received'" class="ri-check-line"></i>
                                            <i v-else-if="msg.transfer.status === 'returned'" class="ri-arrow-go-back-line"></i>
                                            <i v-else class="ri-exchange-cny-line"></i>
                                        </div>
                                        <div class="transfer-info">
                                            <div class="transfer-amount">¥{{ msg.transfer.amount }}</div>
                                            <div class="transfer-remark">{{ getTransferStatusText(msg) }}</div>
                                        </div>
                                    </div>
                                    <div class="transfer-footer">TaTa Transfer</div>
                                </div>

                                <div v-else-if="msg.content" class="bubble" @click="toggleTranslation(index)">
                                    {{ msg.content }}
                                    <div v-if="msg.role === 'assistant' && msg.showTranslation" class="translation-layer">{{ msg.translation || '(暂无翻译)' }}</div>
                                </div>

                                <div v-if="msg.quote" class="quote-bubble">{{ msg.quote.name }}: {{ msg.quote.content }}</div>
                            </div>

                            <div v-if="msg.role === 'user'" class="msg-avatar user-avatar" :style="{ backgroundImage: 'url(' + (userAvatar || defaultUser) + ')' }"></div>
                        </div>
                    </div>
                </div>
            </template>
        </div>
    `,
    setup(props, { emit }) {
        const listRef = ref(null);
        const defaultAi = generateAvatar('AI', 'assistant');
        const defaultUser = generateAvatar('Me', 'user');
        let pressTimer = null;
        let isLongPress = false;

        const shouldShowMessage = (msg) => {
            if (msg.type === 'transfer') return !!msg.transfer; // 必须有 transfer 数据
            if (msg.role === 'assistant') {
                const hasContent = msg.content && msg.content.trim().length > 0;
                const hasImage = !!msg.image;
                const hasOs = msg.os && msg.os.trim().length > 0;
                // [核心] 只有当有内容、图片、OS 或 转账时才显示
                return hasContent || hasImage || hasOs || msg.type === 'transfer';
            }
            return true;
        };

        const getImageClass = (msg) => {
            if (msg.fakePhotoContent) return 'bubble-image fake-size';
            if (msg.image && msg.image.startsWith('data:')) return 'bubble-image auto-size';
            return 'bubble-image sticker-size';
        };

        const scrollToBottom = async () => { await nextTick(); if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight; };
        
        watch(() => props.messages.length, scrollToBottom);
        watch(() => props.messages[props.messages.length - 1]?.content, scrollToBottom);

        onMounted(scrollToBottom);

        const handleRightClick = (e, index) => { if (props.isMultiSelect) return; emit('show-context', { x: e.clientX, y: e.clientY, index }); };
        const startPress = (e, index) => { if (props.isMultiSelect) return; if (e.button === 2) return; isLongPress = false; pressTimer = setTimeout(() => { isLongPress = true; const clientX = e.touches ? e.touches[0].clientX : e.clientX; const clientY = e.touches ? e.touches[0].clientY : e.clientY; emit('show-context', { x: clientX, y: clientY, index }); }, 500); };
        const endPress = () => { clearTimeout(pressTimer); };
        const handleWrapperClick = (index) => { if (props.isMultiSelect) emit('toggle-select', index); };
        const toggleTranslation = (index) => { if (!props.enableTranslation) return; const msg = props.messages[index]; if (msg.role === 'user') return; if (msg.type === 'text' || !msg.type) { if (msg.showTranslation === undefined) msg.showTranslation = false; msg.showTranslation = !msg.showTranslation; } };
        const handleImageClick = (msg) => { if (msg.fakePhotoContent) { msg.showFakeContent = !msg.showFakeContent; } else if (msg.image && msg.image.startsWith('data:')) { emit('preview-image', msg.image); } };

        const getTransferStatusText = (msg) => {
            if (msg.transfer.status === 'received') return '已收款';
            if (msg.transfer.status === 'returned') return '已退还';
            if (msg.transfer.remark && msg.transfer.remark !== '转账给朋友') return msg.transfer.remark;
            return `转账给${msg.role === 'user' ? (props.sessionName || '对方') : (props.userName || '你')}`;
        };

        return { 
            listRef, defaultAi, defaultUser, startPress, endPress, handleRightClick, shouldShowMessage, handleWrapperClick,
            toggleTranslation, handleImageClick, getImageClass, getTransferStatusText
        };
    }
};
