// core/router.js
import { SidebarComponent } from '../features/sidebar.js';

const routes = {
    'dashboard': { html: './pages/dashboard/dashboard.html', js: '../pages/dashboard/dashboard.js' },
    'ipqc': { html: './pages/ipqc/ipqc.html', js: '../pages/ipqc/ipqc.js' },
    'fqc': { html: './pages/fqc/fqc.html', js: '../pages/fqc/fqc.js' },
    'iqc': { html: './pages/iqc/iqc.html', js: '../pages/iqc/iqc.js' },
    'login': { html: './pages/login/login.html', js: '../pages/login/login.js' },
    'signup': { html: './pages/signup/signup.html', js: '../pages/signup/signup.js' }
};

async function handleRouting() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    const route = routes[hash];

    if (!route) {
        document.getElementById('app').innerHTML = '<h2>404 找不到頁面</h2>';
        return;
    }

    try {
        // 1. 處理側邊欄顯示邏輯
        const sidebarContainer = document.getElementById('sidebar-container');
        if (hash === 'login' || hash === 'signup') {
            sidebarContainer.innerHTML = ''; 
        } else {
            SidebarComponent.render(sidebarContainer, hash);
        }

        // 2. 獲取並注入 HTML 內容
        const response = await fetch(route.html);
        const htmlContent = await response.text();
        document.getElementById('app').innerHTML = htmlContent;

        // 3. 動態載入該頁面的 JavaScript 模組並執行初始化
        const pageModule = await import(`${route.js}?update=${Date.now()}`);
        if (pageModule.init) {
            pageModule.init();
        }
    } catch (error) {
        console.error(`路由加載失敗: ${hash}`, error);
    }
}

// 監聽路由變化與首次載入
window.addEventListener('hashchange', handleRouting);
window.addEventListener('DOMContentLoaded', handleRouting);