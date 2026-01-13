import { ref } from 'vue';

export default {
    props: {
        name: String,
        status: String, 
        showAvatar: { type: Boolean, default: false }
    },
    emits: ['back', 'edit-status'], 
    template: `
        <div class="chat-header glass-panel" style="border-radius: 0 0 24px 24px; border-top: none; margin-bottom: 0;">
            <div @click="$emit('back')" style="margin-right: 15px; cursor: pointer;">
                <i class="ri-arrow-left-s-line" style="font-size: 28px; color: #333;"></i>
            </div>
            
            <div class="chat-info">
                <!-- 强制固定字号为 18px -->
                <h3 style="font-size: 18px; font-weight: 600; line-height: 1.2;">{{ name }}</h3>
                <div v-if="status !== undefined" 
                     @click="$emit('edit-status')" 
                     style="font-size: 10px; opacity: 0.6; cursor: pointer; margin-top: 2px;">
                    {{ status || '在线' }}
                </div>
            </div>
            
            <div style="margin-left: auto; display: flex; align-items: center; gap: 15px;">
                <slot name="right"></slot>
            </div>
        </div>
    `
};
