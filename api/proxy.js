/**
 * Vercel Serverless Function: Gemini API 代理轉發程式 (嚴謹版)
 * 提供更詳細的錯誤回報與地區支援優化
 */

export default async function handler(req, res) {
    // 1. 設定 CORS 標頭，解決前端跨域問題
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 2. 處理 Preflight (OPTIONS) 請求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 3. 僅允許 POST 請求
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'Method Not Allowed', 
            message: '請使用 POST 方法進行請求' 
        });
    }

    // 4. 讀取環境變數與前端傳入的資料
    const { model, payload } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    // 5. 嚴格檢查環境變數
    if (!apiKey || apiKey.trim() === "") {
        console.error("錯誤：GEMINI_API_KEY 未在 Vercel 環境變數中設定。");
        return res.status(500).json({ 
            error: 'Server Configuration Error', 
            message: '伺服器未設定 API 金鑰，請檢查 Vercel 後台設定。' 
        });
    }

    if (!model || !payload) {
        return res.status(400).json({ error: 'Bad Request', message: '缺少 model 或 payload 參數' });
    }

    // 6. 構建 Google API URL (確保路徑正確)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
        // 7. 向 Google 發起請求
        const googleResponse = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'Vercel-Proxy-Function' // 增加識別度，防止被 Google 擋掉
            },
            body: JSON.stringify(payload)
        });

        const data = await googleResponse.json();

        // 8. 針對非 200 的回應進行詳細解析 (這能幫你解決 403 到底是金鑰錯還是地區錯)
        if (!googleResponse.ok) {
            console.error(`Google API 回報錯誤 (${googleResponse.status}):`, JSON.stringify(data));
            return res.status(googleResponse.status).json({
                error: `Google API ${googleResponse.status} Error`,
                message: data.error?.message || '呼叫 Google API 時發生錯誤',
                details: data.error || null
            });
        }

        // 9. 成功回傳資料
        return res.status(200).json(data);

    } catch (err) {
        // 10. 捕捉程式執行異常 (如網路超時等)
        console.error('Proxy 執行異常:', err.message);
        return res.status(500).json({ 
            error: 'Proxy Exception', 
            message: '伺服器端轉發發生意外錯誤',
            details: err.message
        });
    }
}
