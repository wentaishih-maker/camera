/**
 * Vercel Serverless Function: Gemini API 代理轉發程式
 * 增加了環境變數的顯性檢查，解決 "is not defined" 或 "missing" 錯誤
 */

export default async function handler(req, res) {
    // 1. 設定 CORS 標頭
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed', message: '請使用 POST 方法' });
    }

    const { model, payload } = req.body;
    
    // 從環境變數讀取金鑰
    const apiKey = process.env.GEMINI_API_KEY;

    // --- 環境變數檢查點 ---
    if (!apiKey || apiKey === "undefined") {
        return res.status(500).json({ 
            error: 'GEMINI_API_KEY is not defined', 
            message: '伺服器找不到金鑰。請至 Vercel Settings > Environment Variables 設定 GEMINI_API_KEY，並執行 Redeploy。' 
        });
    }

    /**
     * 模型名稱修正邏輯
     */
    let targetModel = model || 'gemini-1.5-flash';
    if (targetModel.includes('gemini-2.5') || targetModel.includes('09-2025')) {
        targetModel = 'gemini-1.5-flash'; 
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

    try {
        const googleResponse = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'Vercel-Serverless-Proxy' 
            },
            body: JSON.stringify(payload)
        });

        const data = await googleResponse.json();

        if (!googleResponse.ok) {
            return res.status(googleResponse.status).json({
                error: `Google API ${googleResponse.status}`,
                message: data.error?.message || '呼叫 Google API 失敗',
                details: data.error || null
            });
        }

        return res.status(200).json(data);

    } catch (err) {
        return res.status(500).json({ 
            error: 'Proxy Exception', 
            message: err.message 
        });
    }
}
