// features/sidebar.js
export const SidebarComponent = {
    render(container, activePage) {
        const menuItems = [
            { id: 'dashboard', text: '首頁看板', icon: 'bi-speedometer2' },
            { id: 'ipqc', text: '製程檢驗 (IPQC)', icon: 'bi-clipboard-check' },
            { id: 'fqc', text: '成品檢驗 (FQC)', icon: 'bi-box-seam' },
            { id: 'iqc', text: '進料檢驗 (IQC)', icon: 'bi-download' }
        ];

        let linksHtml = menuItems.map(item => `
            <a href="#${item.id}" class="list-group-item list-group-item-action bg-dark text-white p-3 border-0 ${activePage === item.id ? 'active bg-primary' : ''}">
                <i class="bi ${item.icon} me-3"></i>${item.text}
            </a>
        `).join('');

        container.innerHTML = `
            <div class="bg-dark text-white border-end" id="sidebar-wrapper" style="min-width: 250px; max-width: 250px;">
                <div class="sidebar-heading text-center py-4 primary-text fs-4 fw-bold text-uppercase border-bottom border-secondary">
                    <i class="bi bi-cpu-fill me-2"></i>質檢系統
                </div>
                <div class="list-group list-group-flush my-3">
                    ${linksHtml}
                    <hr class="text-secondary">
                    <a href="#login" class="list-group-item list-group-item-action bg-dark text-danger p-3 border-0">
                        <i class="bi bi-box-arrow-left me-3"></i>登出系統
                    </a>
                </div>
            </div>
        `;
    }
};