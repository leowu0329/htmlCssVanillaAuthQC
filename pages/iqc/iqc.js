// pages/iqc/iqc.js
import { ModalComponent } from '../../features/modal.js';

export function init() {
    document.getElementById('btn-iqc-fetch').addEventListener('click', () => {
        ModalComponent.show("資料同步中", "已成功從供應商 ERP 連線並下載最新的 1 筆進料項目。", "success");
    });
}