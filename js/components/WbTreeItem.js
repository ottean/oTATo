// 递归渲染组件
export default {
    name: 'WbTreeItem', // 必须要有 name 才能递归
    props: ['node', 'selectedIds'], // node 是当前节点(文件夹或书)，selectedIds 是所有选中的ID数组
    emits: ['toggle-book', 'toggle-folder'],
    template: `
        <!-- 1. 如果是书 (Book) -->
        <div 
            v-if="node.type === 'book'" 
            class="wb-item child"
            :class="{ 'active': selectedIds.includes(node.id) }"
            @click="$emit('toggle-book', node.id)"
        >
            <div class="wb-icon book sm"><i class="ri-book-2-line"></i></div>
            <div class="wb-name">{{ node.title }}</div>
            <div class="wb-check">
                <i :class="selectedIds.includes(node.id) ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'"></i>
            </div>
        </div>

        <!-- 2. 如果是文件夹 (Folder) -->
        <div v-else class="wb-folder-group">
            <!-- 头部 -->
            <div class="wb-folder-header" @click="isOpen = !isOpen">
                <i class="ri-arrow-right-s-line arrow" :class="{ 'rotated': isOpen }"></i>
                <div class="wb-icon folder"><i class="ri-folder-3-fill"></i></div>
                <div class="wb-name">{{ node.title }}</div>
                
                <!-- 全选按钮 -->
                <div class="wb-check" @click.stop="$emit('toggle-folder', node)">
                    <i :class="checkState"></i>
                </div>
            </div>

            <!-- 子级 (递归调用自己) -->
            <div class="wb-folder-children" v-if="isOpen">
                <wb-tree-item 
                    v-for="child in node.children" 
                    :key="child.id" 
                    :node="child"
                    :selected-ids="selectedIds"
                    @toggle-book="$emit('toggle-book', $event)"
                    @toggle-folder="$emit('toggle-folder', $event)"
                ></wb-tree-item>
                
                <div v-if="node.children.length === 0" class="empty-folder">(空)</div>
            </div>
        </div>
    `,
    data() {
        return { isOpen: false }; // 每个文件夹自己维护展开状态
    },
    computed: {
        // 计算文件夹的选中状态
        checkState() {
            // 递归获取该文件夹下所有的书 ID
            const getAllBookIds = (n) => {
                if (n.type === 'book') return [n.id];
                return n.children.flatMap(getAllBookIds);
            };
            
            const allIds = getAllBookIds(this.node);
            if (allIds.length === 0) return 'ri-checkbox-blank-circle-line';

            const selectedCount = allIds.filter(id => this.selectedIds.includes(id)).length;
            
            if (selectedCount === 0) return 'ri-checkbox-blank-circle-line';
            if (selectedCount === allIds.length) return 'ri-checkbox-circle-fill';
            return 'ri-checkbox-indeterminate-circle-fill';
        }
    }
};
