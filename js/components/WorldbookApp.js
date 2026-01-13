import { ref, onMounted, computed, nextTick } from 'vue';
import ChatHeader from './ChatHeader.js';

export default {
    components: { ChatHeader },
    emits: ['close'],
    template: `
        <div class="app-window" style="height: 100%; display: flex; flex-direction: column; background: #f2f4f6; position: relative;">
            
            <chat-header 
                :name="headerTitle" 
                :show-avatar="false" 
                @back="handleBack"
            ></chat-header>
            
            <div class="wb-toolbar" v-if="viewMode === 'LIST' && !isMultiSelect">
                <div class="wb-breadcrumb" style="flex: 1; overflow-x: auto; white-space: nowrap; padding-right: 10px;">
                    <span @click="currentFolderId = null" :class="currentFolderId === null ? 'active' : 'link'">根目录</span>
                    <template v-for="(folder, index) in breadcrumbPath" :key="folder.id">
                        <span style="color:#ccc">/</span>
                        <span :class="index === breadcrumbPath.length - 1 ? 'active' : 'link'" @click="currentFolderId = folder.id">{{ folder.title }}</span>
                    </template>
                </div>
                <div class="wb-tool-btn" @click="isMultiSelect = true"><i class="ri-checkbox-multiple-line"></i></div>
            </div>

            <div class="toast-overlay" v-if="toastMsg"><div class="toast-message">{{ toastMsg }}</div></div>

            <div style="flex: 1; overflow-y: auto; padding: 0 24px 24px 24px;">
                <div v-if="viewMode === 'LIST'">
                    <div class="wb-create-group" v-if="!isMultiSelect">
                        <div class="wb-create-btn" @click="toCreateMode('folder')"><i class="ri-folder-add-line"></i> 文件夹</div>
                        <div class="wb-create-btn" @click="toCreateMode('book')"><i class="ri-file-add-line"></i> 规则书</div>
                    </div>

                    <div style="font-size: 12px; font-weight: 700; color: #999; margin: 0 0 8px 8px;" v-if="currentItems.length > 0">
                        {{ isMultiSelect ? '请选择项目' : '内容列表' }}
                    </div>
                    
                    <div v-for="item in currentItems" :key="item.id" class="wb-item-card" :class="{ 'selected': selectedIds.includes(item.id) }" @click="handleItemClick(item)">
                        <div v-if="isMultiSelect" style="margin-right: 12px; font-size: 22px; color: #007aff;">
                            <i :class="selectedIds.includes(item.id) ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"></i>
                        </div>
                        <div class="wb-item-icon" :class="item.type">
                            <i :class="item.type === 'folder' ? 'ri-folder-3-fill' : 'ri-book-2-line'"></i>
                        </div>
                        <div class="wb-item-info">
                            <div class="wb-item-title">{{ item.title }}</div>
                            <div class="wb-item-desc">
                                <span v-if="item.type === 'folder'">{{ getChildCount(item.id) }} 项</span>
                                <span v-else>{{ item.content ? item.content.substring(0, 15) + '...' : '暂无内容' }}</span>
                            </div>
                        </div>
                        
                        <!-- 修复：去掉了开关，只保留箭头或编辑 -->
                        <div class="wb-item-actions" v-if="!isMultiSelect">
                            <i class="ri-arrow-right-s-line arrow" v-if="item.type === 'folder'" style="font-size: 20px; color: #ccc;"></i>
                            <div class="api-edit-btn" @click.stop="toEditMode(item)">
                                <i class="ri-settings-3-line"></i>
                            </div>
                        </div>
                    </div>
                    <div v-if="currentItems.length === 0" style="text-align: center; color: #999; margin-top: 40px; font-size: 13px;">此文件夹为空</div>
                </div>

                <div v-else class="edit-container">
                    <div class="form-group">
                        <label class="form-label">{{ formData.type === 'folder' ? '文件夹名称' : '规则名称' }} <span style="color:red">*</span></label>
                        <input type="text" ref="titleInputRef" v-model="formData.title" class="glass-input" :class="{ 'shake-anim': isError }" placeholder="必填..." @input="isError = false">
                    </div>
                    <div class="form-group" v-if="formData.type === 'book'" style="flex: 1; display: flex; flex-direction: column;">
                        <label class="form-label">规则设定 (System Prompt)</label>
                        <textarea v-model="formData.content" class="glass-textarea" style="flex: 1; min-height: 200px; resize: none;" placeholder="输入详细规则..."></textarea>
                    </div>
                    <div class="api-action-group" style="margin-top: auto;">
                        <button class="api-save-btn" @click="saveData">保存</button>
                    </div>
                </div>
            </div>

            <div class="wb-batch-bar" v-if="isMultiSelect">
                <div class="wb-batch-btn delete" @click="batchDelete"><i class="ri-delete-bin-line"></i> 删除 ({{ selectedIds.length }})</div>
                <div class="wb-batch-btn move" @click="showMoveModal = true"><i class="ri-folder-transfer-line"></i> 移动</div>
            </div>

            <div class="wb-modal-overlay" v-if="showMoveModal" @click="showMoveModal = false">
                <div class="wb-modal-box" @click.stop>
                    <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 10px;">移动到...</h3>
                    <div class="wb-folder-list">
                        <div class="wb-folder-item" @click="executeMove(null)"><i class="ri-home-line" style="color: #666;"></i> 根目录</div>
                        <div class="wb-folder-item" v-for="f in allFolders" :key="f.id" @click="executeMove(f.id)" v-show="!selectedIds.includes(f.id) && f.id !== currentFolderId">
                            <i class="ri-folder-fill" style="color: #ffb020;"></i> {{ f.title }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <style>
            .toggle-switch-sm { display: none; } /* 隐藏开关 */
        </style>
    `,
    setup(props, { emit }) {
        // ... setup 逻辑保持不变，省略以节省空间，直接复用上一版即可 ...
        // (如果你需要我完整写出 setup 请告诉我，但逻辑确实没变)
        const viewMode = ref('LIST');
        const isEditingNew = ref(true);
        const isMultiSelect = ref(false);
        const allItems = ref([]); 
        const selectedIds = ref([]);
        const currentFolderId = ref(null);
        const formData = ref({});
        const toastMsg = ref('');
        const titleInputRef = ref(null);
        const isError = ref(false);
        const showMoveModal = ref(false);

        const currentFolder = computed(() => allItems.value.find(i => i.id === currentFolderId.value));
        const currentItems = computed(() => allItems.value.filter(i => i.parentId === currentFolderId.value));
        const allFolders = computed(() => allItems.value.filter(i => i.type === 'folder'));

        const headerTitle = computed(() => {
            if (isMultiSelect.value) return `已选择 ${selectedIds.value.length} 项`;
            if (viewMode.value === 'EDIT') return isEditingNew.value ? '新建' : '编辑';
            return '世界书';
        });

        const breadcrumbPath = computed(() => {
            const path = [];
            let currId = currentFolderId.value;
            let safety = 0;
            while (currId && safety < 20) {
                const folder = allItems.value.find(i => i.id === currId);
                if (folder) { path.unshift(folder); currId = folder.parentId; } else break;
                safety++;
            }
            return path;
        });

        onMounted(() => {
            const localData = localStorage.getItem('ai_phone_worldbooks_v2');
            if (localData) allItems.value = JSON.parse(localData);
            else allItems.value = [{ id: 1, type: 'folder', title: '示例：赛博朋克', parentId: null }, { id: 2, type: 'book', title: '通用设定', content: '高科技，低生活...', parentId: 1 }];
        });

        const saveToLocal = () => localStorage.setItem('ai_phone_worldbooks_v2', JSON.stringify(allItems.value));
        const showToast = (msg) => { toastMsg.value = msg; setTimeout(() => { toastMsg.value = ''; }, 2000); };
        const handleBack = () => { if (isMultiSelect.value) { isMultiSelect.value = false; selectedIds.value = []; } else if (viewMode.value === 'EDIT') viewMode.value = 'LIST'; else if (currentFolderId.value !== null) currentFolderId.value = allItems.value.find(i => i.id === currentFolderId.value)?.parentId || null; else emit('close'); };
        
        const handleItemClick = (item) => {
            if (isMultiSelect.value) {
                const idx = selectedIds.value.indexOf(item.id);
                if (idx > -1) selectedIds.value.splice(idx, 1); else selectedIds.value.push(item.id);
            } else {
                if (item.type === 'folder') currentFolderId.value = item.id;
            }
        };

        const getChildCount = (folderId) => allItems.value.filter(i => i.parentId === folderId).length;

        const toCreateMode = (type) => {
            formData.value = { id: Date.now(), type, title: '', content: '', parentId: currentFolderId.value };
            isEditingNew.value = true; isError.value = false; viewMode.value = 'EDIT';
            nextTick(() => { if(titleInputRef.value) titleInputRef.value.focus(); });
        };

        const toEditMode = (item) => { formData.value = JSON.parse(JSON.stringify(item)); isEditingNew.value = false; isError.value = false; viewMode.value = 'EDIT'; };

        const saveData = () => {
            if (!formData.value.title.trim()) { isError.value = true; showToast('❌ 标题必填'); return; }
            if (isEditingNew.value) allItems.value.push({ ...formData.value });
            else { const idx = allItems.value.findIndex(i => i.id === formData.value.id); if (idx !== -1) allItems.value[idx] = { ...formData.value }; }
            saveToLocal(); showToast('💾 已保存'); viewMode.value = 'LIST';
        };

        const batchDelete = () => {
            if (selectedIds.value.length === 0) return;
            if (!confirm(`确定删除这 ${selectedIds.value.length} 项吗？`)) return;
            let idsToDelete = [...selectedIds.value];
            let foundNew = true;
            while(foundNew) {
                foundNew = false;
                const children = allItems.value.filter(i => idsToDelete.includes(i.parentId) && !idsToDelete.includes(i.id));
                if (children.length > 0) { idsToDelete = [...idsToDelete, ...children.map(c => c.id)]; foundNew = true; }
            }
            allItems.value = allItems.value.filter(i => !idsToDelete.includes(i.id));
            selectedIds.value = []; isMultiSelect.value = false; saveToLocal(); showToast('🗑️ 删除成功');
        };

        const executeMove = (targetFolderId) => {
            if (selectedIds.value.includes(targetFolderId)) { showToast('❌ 不能移动到自己里面'); return; }
            allItems.value.forEach(i => { if (selectedIds.value.includes(i.id)) i.parentId = targetFolderId; });
            saveToLocal(); showToast('📂 移动成功'); showMoveModal.value = false; isMultiSelect.value = false; selectedIds.value = [];
        };

        return { viewMode, isEditingNew, isMultiSelect, currentItems, currentFolder, currentFolderId, headerTitle, formData, toastMsg, titleInputRef, isError, handleBack, handleItemClick, getChildCount, toCreateMode, toEditMode, saveData, selectedIds, batchDelete, showMoveModal, allFolders, executeMove, breadcrumbPath };
    }
};
