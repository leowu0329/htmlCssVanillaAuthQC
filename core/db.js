// core/db.js

let supabaseInstance = null;

// 執行非同步初始化
const initPromise = (async function initSupabase() {
    let url = "";
    let key = "";

    try {
        const response = await fetch('./env.json');
        if (response.ok) {
            const env = await response.json();
            url = env.SUPABASE_URL;
            key = env.SUPABASE_ANON_KEY;
            console.log("成功動態載入本地環境變數 (env.json)");
        } else {
            const vResponse = await fetch('/api/env');
            if (vResponse.ok) {
                const vEnv = await vResponse.json();
                url = vEnv.SUPABASE_URL;
                key = vEnv.SUPABASE_ANON_KEY;
                console.log("成功動態載入 Vercel 雲端環境變數");
            }
        }
    } catch (e) {
        console.warn("環境變數載入過程中發生異常，嘗試切換備用路由...", e);
    }

    const { createClient } = window.supabase;
    
    if (!url || !key) {
        console.error("錯誤：無法取得有效的 SUPABASE_URL 或 SUPABASE_ANON_KEY，請確認環境設定！");
        return null;
    }

    supabaseInstance = createClient(url, key);
    window.supabaseClient = supabaseInstance;
    return supabaseInstance;
})();

/**
 * 具名匯出 getSupabase 函式
 * 因為環境變數是異步加載的，操作資料庫前必須確保連線已建立
 */
export async function getSupabase() {
    if (!supabaseInstance) {
        await initPromise; // 等待初始化完成
    }
    return supabaseInstance;
}