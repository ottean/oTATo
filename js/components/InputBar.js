import { ref, computed } from 'vue';
import { store } from '../store.js'; 

export default {
    emits: ['send', 'generate', 'regenerate', 'open-photo-dialog'],
    props: ['disabled'],
    template: `
        <div style="width: 100%; display: flex; flex-direction: column; position: relative;">
            
            <div class="quote-banner" v-if="currentQuote">
                <div class="quote-content">回复 {{ currentQuote.name }}: {{ currentQuote.content }}</div>
                <div class="quote-close" @click="currentQuote = null"><i class="ri-close-circle-fill"></i></div>
            </div>

            <div class="input-area">
                <div class="plus-menu" v-if="showMenu" @click.stop>
                    <div class="plus-item" @click="triggerRegen">
                        <div class="plus-icon"><i class="ri-refresh-line"></i></div>
                        <span class="plus-label">重试</span>
                    </div>
                    <div class="plus-item" @click="triggerImageUpload">
                        <div class="plus-icon"><i class="ri-image-line"></i></div>
                        <span class="plus-label">相册</span>
                    </div>
                    <div class="plus-item" @click="triggerFakePhoto">
                        <div class="plus-icon"><i class="ri-camera-line"></i></div>
                        <span class="plus-label">拍照</span>
                    </div>
                    <div class="plus-item" @click="toggleEmojiPanel">
                        <div class="plus-icon"><i class="ri-emotion-line"></i></div>
                        <span class="plus-label">表情</span>
                    </div>
                    <div class="plus-item" @click="showLocalToast('转账功能开发中')">
                        <div class="plus-icon"><i class="ri-money-cny-box-line"></i></div>
                        <span class="plus-label">转账</span>
                    </div>
                    <div class="plus-item" @click="showLocalToast('语音功能开发中')">
                        <div class="plus-icon"><i class="ri-mic-line"></i></div>
                        <span class="plus-label">语音</span>
                    </div>
                    <div class="plus-item" @click="showLocalToast('位置功能开发中')">
                        <div class="plus-icon"><i class="ri-map-pin-line"></i></div>
                        <span class="plus-label">位置</span>
                    </div>
                    <div class="plus-item" @click="showLocalToast('视频功能开发中')">
                        <div class="plus-icon"><i class="ri-video-chat-line"></i></div>
                        <span class="plus-label">视频</span>
                    </div>
                </div>

                <div class="emoji-panel" v-if="showEmoji" @click.stop>
                    <div class="sticker-tabs">
                        <div class="sticker-tab-item" :class="{ active: currentTab === 'root' }" @click="currentTab = 'root'">默认</div>
                        <div v-for="folder in folders" :key="folder.id" class="sticker-tab-item" :class="{ active: currentTab === folder.id }" @click="currentTab = folder.id">{{ folder.name }}</div>
                    </div>
                    <div class="sticker-content">
                        <div class="sticker-item" v-for="(s, idx) in currentStickers" :key="idx" @click="handleSticker(s.url)">
                            <img :src="s.url" class="sticker-img" loading="lazy" @error="handleImgError">
                        </div>
                        <div v-if="currentStickers.length === 0" style="grid-column: 1 / -1; text-align: center; color: #999; font-size: 12px; padding: 20px;">此处暂无表情</div>
                    </div>
                </div>

                <i class="ri-add-circle-line" :class="{ 'active': showMenu }" @click.stop="toggleMenu"></i>
                
                <input type="text" class="input-box" placeholder="聊点什么..." v-model="text" @focus="closeAllMenus" @keyup.enter="handleSendOnly" :disabled="disabled">
                
                <div class="btn-group">
                    <button class="send-btn" @click="handleGenerate" :disabled="disabled"><i class="ri-flashlight-fill"></i></button>
                    <button class="send-btn" @click="handleSendOnly" :disabled="text.length === 0"><i class="ri-arrow-up-line"></i></button>
                </div>
            </div>

            <transition name="fade">
                <div v-if="toastMsg" style="position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: #fff; padding: 8px 16px; border-radius: 20px; font-size: 13px; z-index: 100; pointer-events: none; white-space: nowrap;">
                    {{ toastMsg }}
                </div>
            </transition>

            <input type="file" ref="imgInput" accept="image/*" style="display:none" @change="handleFileSelect">
        </div>
    `,
    setup(props, { emit, expose }) {
        const text = ref('');
        const showMenu = ref(false);
        const showEmoji = ref(false);
        const currentQuote = ref(null);
        const imgInput = ref(null);
        const toastMsg = ref(''); 
        
        const currentTab = ref('root');
        const folders = computed(() => store.stickers.filter(s => s.type === 'folder'));
        const currentStickers = computed(() => {
            if (currentTab.value === 'root') {
                return store.stickers.filter(s => s.type === 'image' || !s.type);
            } else {
                const folder = store.stickers.find(s => s.id === currentTab.value);
                return folder ? folder.children : [];
            }
        });

        const setQuote = (quoteData) => { currentQuote.value = quoteData; };

        const handleSendOnly = () => {
            if (text.value.length === 0) return;
            emit('send', { text: text.value, quote: currentQuote.value, type: 'text' });
            text.value = ''; currentQuote.value = null; closeAllMenus();
        };

        const handleGenerate = () => {
            emit('generate', { text: text.value, quote: currentQuote.value, type: 'text' });
            text.value = ''; currentQuote.value = null; closeAllMenus();
        };
        
        const handleSticker = (url) => {
            // [确认] 仅发送，不触发 AI
            emit('send', { text: '', quote: currentQuote.value, image: url, type: 'image' });
            closeAllMenus();
        };

        const triggerRegen = () => { emit('regenerate'); closeAllMenus(); };
        
        const toggleMenu = () => { showMenu.value = !showMenu.value; showEmoji.value = false; };
        const toggleEmojiPanel = () => { showEmoji.value = !showEmoji.value; showMenu.value = false; };
        const closeAllMenus = () => { showMenu.value = false; showEmoji.value = false; };
        const closeMenu = () => closeAllMenus(); 

        const showLocalToast = (msg) => {
            toastMsg.value = msg;
            setTimeout(() => { toastMsg.value = ''; }, 2000);
        };

        const triggerImageUpload = () => { imgInput.value.click(); };
        
        // [修复] 1. 强制转码为 JPEG 以修复 RIFF 报错
        // [修复] 2. 限制最大分辨率，防止过大
        // [修复] 3. 改为 emit('send')，禁止自动回复
        const handleFileSelect = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    
                    // 限制最大边长 1024
                    const maxDim = 1024;
                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = (height / width) * maxDim;
                            width = maxDim;
                        } else {
                            width = (width / height) * maxDim;
                            height = maxDim;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    
                    // 填充白色背景，解决 PNG 透明变黑问题
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);
                    
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // 强制转换为 JPEG，质量 0.8
                    const jpegBase64 = canvas.toDataURL('image/jpeg', 0.8);
                    
                    // 关键修复：改为 emit('send')
                    emit('send', { 
                        text: text.value, 
                        quote: currentQuote.value, 
                        image: jpegBase64, 
                        type: 'image' 
                    });
                    
                    text.value = ''; 
                    currentQuote.value = null; 
                    closeAllMenus();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
            event.target.value = ''; 
        };

        const triggerFakePhoto = () => { closeAllMenus(); emit('open-photo-dialog'); };

        const handleImgError = (e) => {
            e.target.style.display = 'none';
        };

        expose({ setQuote, closeMenu });

        return { 
            text, showMenu, showEmoji, store, handleSendOnly, handleGenerate, triggerRegen, 
            currentQuote, toggleMenu, toggleEmojiPanel, handleSticker, closeAllMenus, showLocalToast, toastMsg,
            imgInput, triggerImageUpload, handleFileSelect, triggerFakePhoto,
            currentTab, folders, currentStickers,
            handleImgError
        };
    }
};
