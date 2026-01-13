import { nextTick, watch, ref, onMounted, computed } from 'vue';
import { generateAvatar } from '../store.js';

export default {
    props: ['messages', 'userAvatar', 'aiAvatar', 'isMultiSelect', 'selectedIndices', 'sessionName', 'userName', 'enableTranslation'], 
    emits: ['show-context', 'toggle-select', 'view-recall'], 
    template: `
        <div class="message-list" ref="listRef" :class="{ 'multi-select-mode': isMultiSelect }">
            <template v-for="(msg, index) in messages" :key="index">
                
                <div v-if="shouldShowMessage(msg)">
                    <div class="msg-row-wrapper" @click="handleWrapperClick(index)">
                        
                        <div class="msg-checkbox-col">
                            <i :class="selectedIndices.includes(index) ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'" 
                               :style="{ color: selectedIndices.includes(index) ? '#007aff' : '#ccc', fontSize: '24px' }">
                            </i>
                        </div>

                        <div v-if="msg.role === 'system'" 
                             class="system-msg-row" 
                             style="flex: 1;"
                             @contextmenu.prevent="handleRightClick($event, index)"
                        >
                            <span class="system-text" 
                                  :style="{ cursor: msg.isRecall ? 'pointer' : 'default' }"
                                  @click.stop="msg.isRecall ? $emit('view-recall', msg) : null">
                                {{ msg.content }}
                            </span>
                        </div>

                        <div 
                            v-else
                            class="msg-row" 
                            :class="[
                                msg.role === 'user' ? 'me' : 'ai',
                                { 'selecting': isMultiSelect } 
                            ]"
                            @touchstart="startPress($event, index)"
                            @touchend="endPress"
                            @mousedown="startPress($event, index)"
                            @mouseup="endPress"
                            @mouseleave="endPress"
                            @contextmenu.prevent="handleRightClick($event, index)"
                        >
                            <div v-if="msg.role !== 'user'" class="msg-avatar ai-avatar" :style="{ backgroundImage: 'url(' + (aiAvatar || defaultAi) + ')' }"></div>

                            <div class="msg-col">
                                <div v-if="msg.image" class="bubble" style="padding: 0; overflow: hidden; background: transparent; border: none;">
                                    <img :src="msg.image" style="max-width: 200px; max-height: 200px; border-radius: 16px; display: block;" />
                                </div>

                                <div v-else-if="msg.content" class="bubble" @click="toggleTranslation(index)">
                                    {{ msg.content }}
                                    
                                    <div v-if="msg.role === 'assistant' && msg.showTranslation" class="translation-layer">
                                        {{ msg.translation || '(暂无翻译)' }}
                                    </div>
                                </div>

                                <div v-if="msg.quote" class="quote-bubble">
                                    {{ msg.quote.name }}: {{ msg.quote.content }}
                                </div>
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
            if (msg.role === 'assistant' && !msg.content && !msg.os && !msg.image && !msg.translation) return false;
            return true;
        };

        const scrollToBottom = async () => { await nextTick(); if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight; };
        
        watch(() => props.messages.length, scrollToBottom);
        
        const lastMsgContent = computed(() => {
            const len = props.messages.length;
            if (len === 0) return '';
            return props.messages[len - 1].content;
        });
        watch(lastMsgContent, scrollToBottom);

        onMounted(scrollToBottom);

        const handleRightClick = (e, index) => { if (props.isMultiSelect) return; emit('show-context', { x: e.clientX, y: e.clientY, index }); };
        const startPress = (e, index) => { if (props.isMultiSelect) return; if (e.button === 2) return; isLongPress = false; pressTimer = setTimeout(() => { isLongPress = true; const clientX = e.touches ? e.touches[0].clientX : e.clientX; const clientY = e.touches ? e.touches[0].clientY : e.clientY; emit('show-context', { x: clientX, y: clientY, index }); }, 500); };
        const endPress = () => { clearTimeout(pressTimer); };
        const handleWrapperClick = (index) => { if (props.isMultiSelect) emit('toggle-select', index); };
        
        const toggleTranslation = (index) => { 
            if (!props.enableTranslation) return;
            const msg = props.messages[index];
            if (msg.role === 'user') return; 

            if (msg.type === 'text' || !msg.type) {
                if (msg.showTranslation === undefined) msg.showTranslation = false;
                msg.showTranslation = !msg.showTranslation; 
            }
        };

        return { 
            listRef, defaultAi, defaultUser, startPress, endPress, handleRightClick, shouldShowMessage, handleWrapperClick,
            toggleTranslation
        };
    }
};
