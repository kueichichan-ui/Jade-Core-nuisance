export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.body || {};
  if (!address) {
    return res.status(400).json({ error: '請提供地址' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API Key 未設定，請聯絡管理員' });
  }

  const SYSTEM_PROMPT = `你是台灣房地產鄰避設施查核專家。
使用者會提供一個台灣地址，你的任務是根據該地址的地理位置（縣市、區域）進行分析，針對以下每一類鄰避設施，評估300公尺內「可能存在」的風險等級。

重要說明：你無法直接查詢即時地理資料庫，因此請依據你對台灣各地區的地理知識（如：市區密度、工業區分布、宗教設施密集度、垃圾場選址等）做出合理推估。

請針對以下每類設施，以 JSON 格式回傳評估結果（只回傳 JSON，不要有其他文字）：

{
  "address_parsed": "解析後地址",
  "area_description": "地區特性簡述（30字內）",
  "facilities": [
    {
      "name": "設施名稱",
      "risk": "high|medium|low",
      "reason": "判斷理由（40字內）"
    }
  ]
}

risk 說明：
- high：該地區此類設施常見，300公尺內存在的機率高，強烈建議查核
- medium：需要實際查詢確認，有一定可能性
- low：該地區此類設施罕見或不太可能存在於300公尺內

設施清單（按順序）：市場、超市、學校、警察機關、行政機關、體育場、醫院、飛機場、變電所、高壓電塔（線）、寺廟、殯儀館、公墓、火化場、骨灰存放設施、垃圾場／焚化爐、私人墳墓、加油（氣）站、瓦斯行（場）、葬儀社`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `請分析此地址：${address}` }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(502).json({ error: err.error?.message || 'AI 服務暫時無法使用' });
    }

    const data = await response.json();
    const raw = (data.content || []).map(b => b.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message || '伺服器錯誤，請稍後再試' });
  }
}
