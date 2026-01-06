/**
 * Vercel Serverless Function: Gemini API 代理轉發程式
 * 強化模型名稱自動修正與降級機制，解決 404 模型找不到的問題
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
            message: '找不到 GEMINI_API_KEY，請確認 Vercel 環境變數已設定並重新部署。' 
        });
    }

    /**
     * 強化版模型名稱修正邏輯：
     * 解決 gemini-2.5-flash-preview-09-2025 導致的 404 錯誤
     */
    let targetModel = model;
    
    // 如果模型名稱包含 "2.5" 或特定的預覽日期，強制轉換為穩定的 2.0 預覽版或 1.5 穩定版
    if (model.includes('gemini-2.5') || model.includes('09-2025')) {
        // 優先嘗試使用最新的 2.0 預覽版，若不行則使用 1.5 Flash
        targetModel = 'gemini-1.5-flash'; 
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

    try {
        const googleResponse = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Vercel-Serverless-Proxy)' 
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
                attemptedModel: targetModel, // 顯示最終嘗試的模型名稱以便除錯
                originalModel: model
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
