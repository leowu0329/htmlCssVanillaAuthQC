// pages/fqc/fqc.js
import { ModalComponent } from '../../features/modal.js';

export function init() {
    document.getElementById('btn-fqc-scan').addEventListener('click', () => {
        ModalComponent.show(
            "條碼掃描成功", 
            "成功讀取成品序號：FQC-2026-003841。檢驗狀態：待驗（Pending）。", 
            "info"
        );
    });
}