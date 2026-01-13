import { createApp, ref, reactive, watch, computed } from 'vue';
import StatusBar from './components/StatusBar.js';
import Desktop from './components/Desktop.js';
import ChatApp from './components/ChatApp.js';
import SettingsApp from './components/SettingsApp.js';
import ApiApp from './components/ApiApp.js';
import WorldbookApp from './components/WorldbookApp.js';
import { store } from './store.js'; 

const PlaceholderApp = {
    props: ['title'],
    emits: ['close'],
    template: `
        <div style="height:100%; background:#fff; padding:20px; display:flex; flex-direction:column;">
            <div @click="$emit('close')" style="margin-bottom:20px; cursor:pointer; font-size:24px;">
                <i class="ri-arrow-left-line"></i> 返回
            </div>
            <h1>{{ title }}</h1>
            <p style="color:#888; margin-top:10px;">功能开发中...</p>
        </div>
    `
};

const App = {
    components: { StatusBar, Desktop, ChatApp, SettingsApp, ApiApp, WorldbookApp, PlaceholderApp },
    template: `
        <div v-html="globalStyleTag"></div>

        <div class="phone-case" :class="{ 'fullscreen': globalSettings.isFullscreen }">
            <div class="phone-screen">
                <status-bar 
                    class="status-bar" 
                    :class="{ 'hidden': !globalSettings.showStatusBar }"
                ></status-bar>
                
                <!-- 路由 -->
                <transition name="fade" mode="out-in">
                    <!-- [修改] 传递 settings 给 Desktop -->
                    <desktop v-if="currentApp === null" @open-app="openApp" :settings="globalSettings"></desktop>
                    
                    <chat-app v-else-if="currentApp === 'chat'" @close="goHome"></chat-app>
                    <settings-app v-else-if="currentApp === 'settings'" :settings="globalSettings" @close="goHome"></settings-app>
                    <api-app v-else-if="currentApp === 'api'" @close="goHome"></api-app>
                    <worldbook-app v-else-if="currentApp === 'worldbook'" @close="goHome"></worldbook-app>
                    <placeholder-app v-else :title="currentApp" @close="goHome"></placeholder-app>
                </transition>

                <!-- 全局通知弹窗 -->
                <transition name="slide-down">
                    <div v-if="store.notification.show" class="glass-panel" 
                        style="position: absolute; top: 10px; left: 10px; right: 10px; padding: 12px; border-radius: 16px; z-index: 9999; display: flex; align-items: center; box-shadow: 0 10px 30px rgba(0,0,0,0.2); cursor: pointer; background: rgba(255,255,255,0.98); border: 1px solid rgba(0,0,0,0.05);"
                        @click="handleNotificationClick"
                    >
                        <div style="width: 40px; height: 40px; border-radius: 50%; background-color: #ddd; background-size: cover; background-position: center; margin-right: 12px; flex-shrink: 0;" 
                             :style="{ backgroundImage: 'url(' + store.notification.avatar + ')' }"></div>
                        <div style="flex: 1; overflow: hidden;">
                            <div style="font-weight: 600; font-size: 14px; color: #333;">{{ store.notification.title }}</div>
                            <div style="font-size: 12px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{{ store.notification.content }}</div>
                        </div>
                        <div style="font-size: 11px; color: #999; margin-left: 8px;">刚刚</div>
                    </div>
                </transition>

            </div>
        </div>
    `,
    setup() {
        const currentApp = ref(null);
        const savedSettings = JSON.parse(localStorage.getItem('ai_phone_global_settings') || '{}');

        const globalSettings = reactive({
            isFullscreen: savedSettings.isFullscreen || false,
            showStatusBar: savedSettings.showStatusBar !== false, 
            enableCustomCss: savedSettings.enableCustomCss || false,
            globalCss: savedSettings.globalCss || '',
            // [新增] 桌面组件开关，默认为 true
            showDesktopTime: savedSettings.showDesktopTime !== false,
            showDesktopCard: savedSettings.showDesktopCard !== false
        });

        watch(globalSettings, (newVal) => {
            localStorage.setItem('ai_phone_global_settings', JSON.stringify(newVal));
        }, { deep: true });

        const globalStyleTag = computed(() => {
            if (globalSettings.enableCustomCss && globalSettings.globalCss) {
                return `<style>${globalSettings.globalCss}</style>`;
            }
            return '';
        });

        const openApp = (appName) => { currentApp.value = appName; };
        const goHome = () => { currentApp.value = null; };

        const handleNotificationClick = () => {
            currentApp.value = 'chat';
            store.targetSessionId = store.notification.sessionId;
            store.notification.show = false;
        };

        return { currentApp, openApp, goHome, globalSettings, globalStyleTag, store, handleNotificationClick };
    }
};

createApp(App).mount('#app');
