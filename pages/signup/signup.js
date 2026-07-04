// pages/signup/signup.js
import { getSupabase } from '../../core/db.js';
import { PasswordToggleComponent } from '../../features/inputPasswordToggle.js';
import { ModalComponent } from '../../features/modal.js';

export function init() {
    PasswordToggleComponent.bind('signup-password', 'toggle-signup-password');

    const form = document.getElementById('signup-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        try {
            // 異步獲取 supabase 實例
            const supabase = await getSupabase();
            if (!supabase) throw new Error("資料庫未成功連線，請檢查環境變數設定。");

            // 呼叫 Supabase Auth 註冊 API
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;

            ModalComponent.show("註冊成功", "帳號已成功建立！請至信箱收取驗證信，或直接嘗試登入。", "success");
            setTimeout(() => { window.location.hash = 'login'; }, 2000);
        } catch (err) {
            ModalComponent.show("註冊失敗", err.message, "danger");
        }
    });
}