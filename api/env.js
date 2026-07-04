// 這個檔案會由 Vercel 的後端伺服器執行，所以能安全地讀取後台設定的環境變數
export default function handler(req, res) {
  res.status(200).json({
    SUPABASE_URL: process.env.SUPABASE_URL || "",
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ""
  });
}
