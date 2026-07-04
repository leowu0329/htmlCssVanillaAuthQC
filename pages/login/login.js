// pages/login/login.js
import { getSupabase } from '../../core/db.js';
import { PasswordToggleComponent } from '../../features/inputPasswordToggle.js';
import { ModalComponent } from '../../features/modal.js';

export function init() {
    // 綁定密碼眼睛切換功能
    PasswordToggleComponent.bind('login-password', 'toggle-login-password');

    const form = document.getElementById('login-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            // 異步獲取 supabase 實例
            const supabase = await getSupabase();
            if (!supabase) throw new Error("資料庫未成功連線，請檢查環境變數設定。");

            // 呼叫 Supabase Auth 登入 API
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;

            ModalComponent.show("登入成功", "歡迎回到質量管理系統，正在導向首頁...", "success");
            setTimeout(() => { window.location.hash = 'dashboard'; }, 1500);
        } catch (err) {
            ModalComponent.show("登入失敗", err.message, "danger");
        }
    });
}