import { ref, onMounted, reactive, nextTick } from 'vue';
import ChatHeader from './ChatHeader.js';

export default {
    components: { ChatHeader },
    emits: ['close'],
    template: `
        <div class="app-window" style="height: 100%; display: flex; flex-direction: column; background: #f2f4f6; position: relative;">
            <chat-header name="接口管理" :show-avatar="false" @back="handleBack"></chat-header>
            <div class="toast-overlay" v-if="toastMsg"><div class="toast-message">{{ toastMsg }}</div></div>

            <div style="flex: 1; overflow-y: auto; padding: 24px 24px 80px 24px;">
                <div v-if="viewMode === 'LIST'" class="api-list-container">
                    <div class="api-add-btn" @click="toCreateMode">
                        <i class="ri-add-line" style="font-size: 20px;"></i> <span>新建 API 配置</span>
                    </div>
                    <div style="font-size: 12px; font-weight: 700; color: #999; margin: 4px 0 0 8px; letter-spacing: 0.5px;" v-if="savedProfiles.length > 0">已保存列表</div>
                    <div v-for="p in savedProfiles" :key="p.id" class="api-profile-card" :class="{ 'active': activeId === p.id }" @click="selectActive(p)">
                        <div class="api-profile-info"><div class="api-profile-name" :class="{ 'active-text': activeId === p.id }">{{ p.name }}</div><div class="api-profile-model">{{ p.model || 'Auto' }}</div></div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div v-if="testingId === p.id" style="color: #999; font-size: 20px;"><i class="ri-loader-4-line" style="animation: spin 1s linear infinite; display: inline-block;"></i></div>
                            <div v-else-if="activeId === p.id" class="api-check-icon"><i class="ri-checkbox-circle-fill"></i></div>
                            <div class="api-edit-btn" @click.stop="toEditMode(p)"><i class="ri-settings-3-line"></i></div>
                        </div>
                    </div>
                </div>

                <div v-else class="edit-container">
                    <div class="form-group"><label class="form-label">配置名称 <span style="color:red">*</span></label><input type="text" ref="nameInputRef" v-model="formData.name" class="glass-input" :class="{ 'shake-anim': isNameError }" placeholder="必填..." @input="isNameError = false"></div>
                    <div class="form-group"><label class="form-label">API 地址</label><input type="text" v-model="formData.baseUrl" class="glass-input"></div>
                    <div class="form-group"><label class="form-label">API Key</label><input type="password" v-model="formData.apiKey" class="glass-input"></div>
                    <div class="form-group"><label class="form-label">模型</label><div class="model-row"><select v-if="modelOptions.length > 0" v-model="formData.model" class="glass-input"><option v-for="m in modelOptions" :key="m" :value="m">{{ m }}</option></select><input v-else type="text" v-model="formData.model" class="glass-input"><button class="refresh-btn" @click="fetchModels" :disabled="isLoading"><i :class="isLoading ? 'ri-loader-4-line' : 'ri-download-cloud-2-line'" :style="{ animation: isLoading ? 'spin 1s linear infinite' : '' }"></i></button></div></div>
                    <div class="form-group"><label class="form-label">随机性: {{ formData.temperature }}</label><div class="slider-container"><span style="font-size: 12px; color: #888;">严谨</span><input type="range" min="0" max="2" step="0.1" v-model.number="formData.temperature" class="temp-slider"><span style="font-size: 12px; color: #888;">发散</span></div></div>
                    
                    <div class="form-group" style="display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.4); padding:12px; border-radius:16px;">
                        <input type="checkbox" v-model="formData.stream" class="styled-checkbox">
                        <label class="form-label" style="margin:0; cursor:pointer;" @click="formData.stream = !formData.stream">启用流式输出 (打字机效果)</label>
                    </div>

                    <div class="api-action-group">
                        <button class="api-save-btn" @click="saveData">{{ isEditingNew ? '保存为新配置' : '更新配置' }}</button>
                        <button v-if="!isEditingNew" class="api-delete-btn" @click="triggerDelete">删除此配置</button>
                    </div>
                </div>
            </div>

            <!-- [新增] 自定义删除确认弹窗 -->
            <div v-if="showDeleteModal" class="center-modal-overlay" @click="showDeleteModal = false" style="z-index: 500;">
                <div class="center-modal-box" @click.stop>
                    <h3 style="text-align: center; font-size: 16px; color: #ff3b30;">确认删除?</h3>
                    <p style="text-align: center; font-size: 13px; color: #666; margin-bottom: 10px;">删除后无法恢复。</p>
                    <div style="display: flex; gap: 10px; width: 100%;">
                        <button class="api-save-btn" style="margin:0; flex:1; padding:12px; background:rgba(0,0,0,0.05); color:#666;" @click="showDeleteModal = false">取消</button>
                        <button class="api-delete-btn" style="margin:0; flex:1; padding:12px;" @click="confirmDelete">删除</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup(props, { emit }) {
        const viewMode = ref('LIST');
        const isEditingNew = ref(true);
        const savedProfiles = ref([]);
        const activeId = ref(null);
        const formData = ref({});
        const toastMsg = ref('');
        const isLoading = ref(false);
        const modelOptions = ref([]);
        const nameInputRef = ref(null);
        const isNameError = ref(false);
        const testingId = ref(null);
        const showDeleteModal = ref(false); // Modal state
        const emptyTemplate = { id: null, name: '', baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-3.5-turbo', temperature: 0.7, stream: true };

        onMounted(() => {
            const localData = localStorage.getItem('ai_phone_profiles');
            if (localData) savedProfiles.value = JSON.parse(localData);
            const lastId = localStorage.getItem('ai_phone_active_id');
            if (lastId) activeId.value = Number(lastId);
        });
        const handleBack = () => { if (viewMode.value === 'EDIT') viewMode.value = 'LIST'; else emit('close'); };
        const toCreateMode = () => { formData.value = JSON.parse(JSON.stringify(emptyTemplate)); formData.value.id = Date.now(); isEditingNew.value = true; modelOptions.value = []; isNameError.value = false; viewMode.value = 'EDIT'; nextTick(() => { if(nameInputRef.value) nameInputRef.value.focus(); }); };
        const toEditMode = (profile) => { formData.value = JSON.parse(JSON.stringify(profile)); if (formData.value.stream === undefined) formData.value.stream = true; isEditingNew.value = false; modelOptions.value = []; isNameError.value = false; viewMode.value = 'EDIT'; };
        const showToast = (msg) => { toastMsg.value = msg; setTimeout(() => { toastMsg.value = ''; }, 2000); };
        const selectActive = async (profile) => { if (testingId.value) return; const id = profile.id; testingId.value = id; try { if (!profile.apiKey) throw new Error("未填写 Key"); let baseUrl = profile.baseUrl.replace(/\/$/, ''); const response = await fetch(`${baseUrl}/models`, { method: 'GET', headers: { 'Authorization': `Bearer ${profile.apiKey}` } }); if (!response.ok) throw new Error(`${response.status}`); activeId.value = id; localStorage.setItem('ai_phone_active_id', id); showToast(`✅ 连接成功`); } catch (e) { activeId.value = id; localStorage.setItem('ai_phone_active_id', id); showToast(`⚠️ 已切换 (未连通)`); } finally { testingId.value = null; } };
        const saveData = () => { if (!formData.value.name.trim()) { isNameError.value = true; showToast('❌ 必须填写名称'); return; } if (isEditingNew.value) { savedProfiles.value.push({ ...formData.value }); activeId.value = formData.value.id; localStorage.setItem('ai_phone_active_id', activeId.value); } else { const index = savedProfiles.value.findIndex(p => p.id === formData.value.id); if (index !== -1) savedProfiles.value[index] = { ...formData.value }; } localStorage.setItem('ai_phone_profiles', JSON.stringify(savedProfiles.value)); showToast('💾 保存成功'); viewMode.value = 'LIST'; };
        
        // [修改] 触发弹窗
        const triggerDelete = () => { showDeleteModal.value = true; };
        
        // [修改] 确认删除
        const confirmDelete = () => {
            const index = savedProfiles.value.findIndex(p => p.id === formData.value.id);
            if (index !== -1) {
                savedProfiles.value.splice(index, 1);
                if (activeId.value === formData.value.id) {
                    activeId.value = null;
                    localStorage.removeItem('ai_phone_active_id');
                }
                localStorage.setItem('ai_phone_profiles', JSON.stringify(savedProfiles.value));
                showToast('🗑️ 已删除');
                viewMode.value = 'LIST';
            }
            showDeleteModal.value = false;
        };

        const fetchModels = async () => { if (!formData.value.apiKey) { showToast('❌ 请先填入 API Key'); return; } isLoading.value = true; modelOptions.value = []; try { let baseUrl = formData.value.baseUrl.replace(/\/$/, ''); const response = await fetch(`${baseUrl}/models`, { method: 'GET', headers: { 'Authorization': `Bearer ${formData.value.apiKey}` } }); if (!response.ok) throw new Error(response.status); const data = await response.json(); if (data && data.data) { modelOptions.value = data.data.map(item => item.id).sort(); if (!formData.value.model && modelOptions.value.length > 0) formData.value.model = modelOptions.value[0]; showToast(`🎉 获取到 ${modelOptions.value.length} 个模型`); } } catch (e) { showToast(`❌ 失败: ${e.message}`); } finally { isLoading.value = false; } };
        
        return { viewMode, isEditingNew, savedProfiles, activeId, formData, toCreateMode, toEditMode, selectActive, handleBack, saveData, triggerDelete, confirmDelete, fetchModels, isLoading, modelOptions, toastMsg, nameInputRef, isNameError, testingId, showDeleteModal };
    }
};
