// pages/dashboard/dashboard.js
import { FormatUtility } from '../../utils/utils.js';

export function init() {
    console.log("Dashboard 載入完成");
    
    // 顯示即時格式化時間
    const timeDisplay = document.getElementById('current-time-display');
    if (timeDisplay) {
        timeDisplay.innerHTML = `<i class="bi bi-clock me-1"></i> 系統時間：${FormatUtility.formatDateTime(new Date())}`;
    }

    // 模擬動態跳動更新數據看板
    document.getElementById('dash-iqc-count').innerText = "12 批";
    document.getElementById('dash-ipqc-count').innerText = "36 次";
    document.getElementById('dash-fqc-rate').innerText = "98.5%";
}