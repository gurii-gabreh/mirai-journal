// gemini.js — Gemini API連携

const GeminiAPI = {
  BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',

  async analyze(journalText, apiKey) {
    if (!apiKey) throw new Error('Gemini APIキーが設定されていません');

    const prompt = `
あなたは自己探求とキャリア分析の専門コーチです。
以下のジャーナルエントリーを分析し、必ずJSON形式で回答してください。

【ジャーナル内容】
${journalText}

【出力形式】
以下のJSON形式のみで回答してください。余計なテキストやバッククォートは不要です。

{
  "summary": "ジャーナルの要約（2〜3文）",
  "strengths": [
    {"name": "強みの名前", "score": 85, "reason": "この強みが見られた理由"},
    {"name": "強みの名前", "score": 72, "reason": "この強みが見られた理由"}
  ],
  "trends": [
    {"title": "関連するトレンドや社会的問題点", "relevance": "高", "insight": "あなたとの関連性"}
  ],
  "problems": [
    {"title": "あなたが発見した問題点や課題", "domain": "業界・分野"}
  ],
  "careers": [
    {"name": "キャリア候補名", "score": 88, "reason": "なぜこのキャリアが向いているか"}
  ],
  "coaching": "今日のコーチングメッセージ（励ましと次のアクション提案）",
  "tags": ["タグ1", "タグ2", "タグ3"]
}
`;

    const res = await fetch(`${this.BASE_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini APIエラー: ${res.status}`);
    }

    const data = await res.json();

    // 全partsのtextを結合（thinking機能対応）
    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map(p => p.text || '').join('');

    if (!text) throw new Error('Geminiから応答が得られませんでした');

    // JSON部分を抽出（最初の{から最後の}まで）
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON形式の応答が得られませんでした');

    try {
      return JSON.parse(jsonMatch[0]);
    } catch(e) {
      // バッククォートや余分な文字を除去して再試行
      const cleaned = jsonMatch[0]
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      return JSON.parse(cleaned);
    }
  },
};
