/**
 * Vercel Serverless Function: Gemini API 代理轉發程式
 * 修正了模型名稱可能導致的 404 錯誤
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
        return res.status(405).json({ error: '僅支援 POST 請求' });
    }

    const { model, payload } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ 
            error: 'Server Config Error', 
            message: '找不到 GEMINI_API_KEY，請確認 Vercel 環境變數已設定。' 
        });
    }

    /**
     * 修正模型名稱：
     * 如果傳入的是預覽版模型名稱導致 404，
     * 我們可以將其導向更穩定的 1.5-flash 版本。
     */
    let targetModel = model;
    if (model.includes('gemini-2.5-flash-preview')) {
        targetModel = 'gemini-1.5-flash'; // 回退到穩定版本
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

    try {
        const googleResponse = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Vercel-Serverless)' 
            },
            body: JSON.stringify(payload)
        });

        const data = await googleResponse.json();

        if (!googleResponse.ok) {
            // 處理詳細錯誤訊息
            return res.status(googleResponse.status).json({
                error: `Google API ${googleResponse.status}`,
                message: data.error?.message || '呼叫 Google API 時發生錯誤',
                details: data.error || null,
                attemptedUrl: url.split('?')[0] // 隱藏 Key 但顯示 URL 以供除錯
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
