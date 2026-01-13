import { ref, onMounted, onUnmounted, reactive } from 'vue';

export default {
    props: ['settings'],
    emits: ['open-app'],
    template: `
        <div class="desktop" @click="closeContextMenu">
            
            <!-- 1. 顶部：超级时钟 (Magazine Style) -->
            <!-- 去掉了 glass-panel，直接裸排 -->
            <div class="widget-area" v-if="settings.showDesktopTime" style="margin-top: 20px; margin-bottom: 40px; text-align: center;">
                <div style="display: flex; flex-direction: column; align-items: center; text-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    <!-- 巨大的时间 -->
                    <div style="font-size: 72px; font-weight: 200; line-height: 0.9; color: #333; letter-spacing: -2px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        {{ currentTime }}
                    </div>
                    <!-- 精致的日期与问候 -->
                    <div style="margin-top: 10px; font-size: 14px; font-weight: 600; color: #666; letter-spacing: 1px; text-transform: uppercase; display: flex; align-items: center; gap: 8px;">
                        <span>{{ weekday }}</span>
                        <span style="width: 4px; height: 4px; background: #999; border-radius: 50%;"></span>
                        <span>{{ date }}</span>
                    </div>
                    <div style="font-size: 13px; color: #888; margin-top: 4px; font-weight: 400;">
                        {{ greeting }}
                    </div>
                </div>
            </div>

            <!-- 2. 中间：App Grid (保持原样，增加一点下边距) -->
            <div class="app-grid" style="margin-bottom: 30px;">
                <div class="app-item" @click="$emit('open-app', 'chat')">
                    <div class="app-icon" style="background: #333; color: #fff;"><i class="ri-message-3-line"></i></div>
                    <span>聊天</span>
                </div>
                <div class="app-item" @click="$emit('open-app', 'worldbook')">
                    <div class="app-icon" style="background: #e0e0e0; color: #333;"><i class="ri-book-read-line"></i></div>
                    <span>世界书</span>
                </div>
                <div class="app-item" @click="$emit('open-app', 'api')">
                    <div class="app-icon" style="background: #e0e0e0; color: #333;"><i class="ri-terminal-box-line"></i></div>
                    <span>接口</span>
                </div>
                <div class="app-item" @click="$emit('open-app', 'settings')">
                    <div class="app-icon" style="background: #e0e0e0; color: #333;"><i class="ri-settings-4-line"></i></div>
                    <span>设置</span>
                </div>
            </div>

            <!-- 3. 底部：海报式卡片 (Poster Widget) -->
            <!-- 这种布局让图片成为主角，文字叠加其上 -->
            <transition name="fade" mode="out-in">
                <div 
                    v-if="settings.showDesktopCard"
                    :key="currentIndex" 
                    class="poster-widget"
                    @click="switchCard"
                    @contextmenu.prevent="handleRightClick"
                    @touchstart="startPress"
                    @touchend="endPress"
                    @mousedown="startPress"
                    @mouseup="endPress"
                    @mouseleave="endPress"
                >
                    <!-- 背景图层 -->
                    <div class="poster-bg" :style="currentCard.img ? { backgroundImage: 'url(' + currentCard.img + ')' } : { background: '#ddd' }">
                        <div class="poster-overlay"></div> <!-- 渐变遮罩，保证文字可读 -->
                    </div>

                    <!-- 内容层 -->
                    <div class="poster-content">
                        <div class="poster-top">
                            <span class="poster-tag" v-if="currentCard.tag">#{{ currentCard.tag }}</span>
                            <i class="ri-arrow-right-line" style="font-size: 18px; opacity: 0.8;"></i>
                        </div>
                        <div class="poster-text">{{ currentCard.text }}</div>
                    </div>
                </div>
            </transition>
            
            <!-- 4. Dock 栏 -->
            <div class="dock glass-panel" style="margin-top: auto;">
                 <div class="dock-icon"><i class="ri-phone-fill"></i></div>
                 <div class="dock-icon"><i class="ri-mail-fill"></i></div>
                 <div class="dock-icon"><i class="ri-global-line"></i></div>
                 <div class="dock-icon"><i class="ri-music-fill"></i></div>
            </div>

            <!-- 右键菜单 & 编辑弹窗 (保持逻辑不变) -->
            <div class="context-menu-overlay" v-if="contextMenu.visible" @click="closeContextMenu">
                <div class="context-menu" :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }" @click.stop>
                    <div class="menu-item" @click="openEditModal"><i class="ri-edit-line"></i> 编辑卡片</div>
                </div>
            </div>

            <div v-if="showEdit" class="center-modal-overlay" @click="showEdit = false" style="z-index: 1000;">
                <div class="center-modal-box" @click.stop>
                    <h3 style="text-align: center; font-size: 16px; margin-bottom: 15px;">编辑卡片 ({{ currentIndex + 1 }}/3)</h3>
                    <div class="form-group"><label class="mini-label">标签</label><input v-model="tempData.tag" class="glass-input-sm" placeholder="例如: Daily"></div>
                    <div class="form-group"><label class="mini-label">内容</label><textarea v-model="tempData.text" class="glass-textarea" style="height: 60px;" placeholder="卡片文字..."></textarea></div>
                    <div class="form-group"><label class="mini-label">图片</label><div style="display: flex; gap: 8px;"><input v-model="tempData.img" class="glass-input-sm" placeholder="https://..." style="flex: 1;"><button class="refresh-btn" @click="$refs.fileInput.click()" style="width: 40px; height: 38px;"><i class="ri-upload-2-line"></i></button></div><input type="file" ref="fileInput" accept="image/*" style="display:none" @change="handleFileSelect"></div>
                    <div style="display: flex; gap: 10px; width: 100%; margin-top: 10px;"><button class="api-delete-btn" style="margin:0; flex:1; padding:12px; background:rgba(0,0,0,0.05); color:#666;" @click="showEdit = false">取消</button><button class="api-save-btn" style="margin:0; flex:1; padding:12px;" @click="saveCard">保存</button></div>
                </div>
            </div>
        </div>
    `,
    setup() {
        // ... (JS 逻辑完全保持不变，直接复用上一个版本的 setup 即可) ...
        const now = new Date();
        const date = `${now.getMonth() + 1}月${now.getDate()}日`;
        const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
        const currentTime = ref('');
        let timer;
        const updateTime = () => {
            const t = new Date();
            currentTime.value = t.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit' });
        };
        const hour = now.getHours();
        let greeting = hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 13 ? '中午好' : hour < 18 ? '下午好' : '晚上好';

        const defaultCards = [
            { tag: 'Daily', text: '保持热爱，奔赴山海。', img: 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=400&h=200&fit=crop' },
            { tag: 'Status', text: '系统运行正常，等待指令。', img: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&h=200&fit=crop' },
            { tag: 'Memo', text: '记得喝水，休息一下眼睛。', img: 'https://images.unsplash.com/photo-1512314889357-e157c22f938d?w=400&h=200&fit=crop' }
        ];
        const savedCards = localStorage.getItem('ai_phone_cards');
        const cards = ref(savedCards ? JSON.parse(savedCards) : defaultCards);
        const currentIndex = ref(0);
        const currentCard = ref(cards.value[0]);

        const switchCard = () => {
            if (contextMenu.visible) return;
            currentIndex.value = (currentIndex.value + 1) % cards.value.length;
            currentCard.value = cards.value[currentIndex.value];
        };

        const contextMenu = reactive({ visible: false, x: 0, y: 0 });
        let pressTimer = null;

        const handleRightClick = (e) => {
            contextMenu.x = e.clientX;
            contextMenu.y = e.clientY;
            contextMenu.visible = true;
        };

        const startPress = (e) => {
            if (e.button === 2) return; 
            pressTimer = setTimeout(() => {
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                contextMenu.x = clientX;
                contextMenu.y = clientY;
                contextMenu.visible = true;
            }, 500);
        };

        const endPress = () => { clearTimeout(pressTimer); };
        const closeContextMenu = () => { contextMenu.visible = false; };

        const showEdit = ref(false);
        const tempData = ref({});
        const fileInput = ref(null);

        const openEditModal = () => {
            tempData.value = { ...currentCard.value };
            showEdit.value = true;
            closeContextMenu();
        };

        const handleFileSelect = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                tempData.value.img = e.target.result;
            };
            reader.readAsDataURL(file);
        };

        const saveCard = () => {
            cards.value[currentIndex.value] = { ...tempData.value };
            currentCard.value = cards.value[currentIndex.value];
            localStorage.setItem('ai_phone_cards', JSON.stringify(cards.value));
            showEdit.value = false;
        };

        onMounted(() => { updateTime(); timer = setInterval(updateTime, 1000); });
        onUnmounted(() => clearInterval(timer));

        return { 
            date, weekday, greeting, currentTime, 
            currentCard, switchCard, currentIndex,
            contextMenu, handleRightClick, startPress, endPress, closeContextMenu,
            showEdit, tempData, openEditModal, saveCard,
            fileInput, handleFileSelect
        };
    }
};
