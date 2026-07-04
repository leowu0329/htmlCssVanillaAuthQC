// features/inputPasswordToggle.js
export const PasswordToggleComponent = {
    /**
     * 綁定密碼切換事件
     * @param {string} inputId 密碼輸入框 ID
     * @param {string} iconId 切換按鈕/圖示 ID
     */
    bind(inputId, iconId) {
        const passwordInput = document.getElementById(inputId);
        const toggleIcon = document.getElementById(iconId);

        if (!passwordInput || !toggleIcon) return;

        toggleIcon.addEventListener('click', () => {
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            
            // 切換 Bootstrap Icon 樣式
            if (isPassword) {
                toggleIcon.classList.remove('bi-eye-slash');
                toggleIcon.classList.add('bi-eye');
            } else {
                toggleIcon.classList.remove('bi-eye');
                toggleIcon.classList.add('bi-eye-slash');
            }
        });
    }
};