// features/modal.js
export const ModalComponent = {
    /**
     * 快顯自訂提示彈窗 (5秒後自動關閉)
     * @param {string} title 標題
     * @param {string} message 內容
     * @param {string} type 類型 ('success' | 'danger' | 'warning' | 'info')
     */
    show(title, message, type = 'info') {
        // 動態建立 Modal HTML 結構
        const modalId = `custom-modal-${Date.now()}`;
        const headerClass = type === 'danger' ? 'bg-danger text-white' : 
                            type === 'success' ? 'bg-success text-white' : 
                            type === 'warning' ? 'bg-warning text-dark' : 'bg-primary text-white';

        const modalHtml = `
            <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header ${headerClass}">
                            <h5 class="modal-title"><i class="bi bi-info-circle-fill me-2"></i>${title}</h5>
                            <button type="button" class="btn-close ${type !== 'warning' ? 'btn-close-white' : ''}" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p class="mb-0">${message}</p>
                            <small class="text-muted d-block mt-3 text-end">此視窗將於 5 秒內自動關閉...</small>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 插入至 body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalElement = document.getElementById(modalId);
        
        // 初始化 Bootstrap Modal (注意大小寫修正為 bootstrap.Modal)
        const bsModal = new bootstrap.Modal(modalElement, {
            backdrop: 'static',
            keyboard: false
        });
        
        bsModal.show();

        // 設定 5 秒後自動關閉並從 DOM 移除
        const autoCloseTimeout = setTimeout(() => {
            bsModal.hide();
        }, 5000);

        // 監聽隱藏事件，釋放記憶體與 DOM 節點
        modalElement.addEventListener('hidden.bs.modal', () => {
            clearTimeout(autoCloseTimeout);
            modalElement.remove();
        });
    }
};