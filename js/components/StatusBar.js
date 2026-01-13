import { ref, onMounted, onUnmounted } from 'vue';

export default {
    template: `
        <div class="status-bar">
            <div class="time">{{ currentTime }}</div>
            <div class="icons">
                <!-- 显示真实电量 -->
                <span style="font-size:12px; margin-right:4px; font-weight:600;">{{ batteryLevel }}%</span>
                <!-- 如果正在充电，显示充电图标 -->
                <i :class="isCharging ? 'ri-battery-charge-fill' : 'ri-battery-fill'"></i>
            </div>
        </div>
    `,
    setup() {
        const currentTime = ref('');
        const batteryLevel = ref(100); // 默认值，用于不支持的设备
        const isCharging = ref(false);
        let timer;

        // --- 时间逻辑 ---
        const updateTime = () => {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            currentTime.value = `${hours}:${minutes}`;
        };

        // --- 真实电量逻辑 ---
        const initBattery = async () => {
            // 判断浏览器是否支持电池 API (安卓/PC Chrome支持，iPhone不支持)
            if (navigator.getBattery) {
                try {
                    const battery = await navigator.getBattery();
                    
                    const updateBatteryUI = () => {
                        batteryLevel.value = Math.round(battery.level * 100);
                        isCharging.value = battery.charging;
                    };

                    // 初始化读取
                    updateBatteryUI();

                    // 监听电量变化
                    battery.addEventListener('levelchange', updateBatteryUI);
                    // 监听充电状态变化
                    battery.addEventListener('chargingchange', updateBatteryUI);

                } catch (e) {
                    console.error("无法读取电量信息", e);
                }
            }
        };

        onMounted(() => {
            updateTime();
            timer = setInterval(updateTime, 1000);
            initBattery(); // 启动电量监听
        });

        onUnmounted(() => clearInterval(timer));

        return { currentTime, batteryLevel, isCharging };
    }
};
