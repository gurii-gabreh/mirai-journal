// gemini.js — Gemini API連携

const GeminiAPI = {
  BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent',

  async analyze(journalText, apiKey) {
    if (!apiKey) throw new Error('Gemini APIキーが設定されていません');

    const prompt = `
あなたは自己探求とキャリア分析の専門コーチです。
以下のジャーナルエントリーを分析し、必ずJSON形式で回答してください。

【ジャーナル内容】
${journalText}

【出力形式】
以下のJSON形式のみで回答してください。余計なテキストや\`\`\`は不要です。

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
          maxOutputTokens: 2048,
        }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini APIエラー: ${res.status}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // JSON部分を抽出してパース
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Geminiの応答をパースできませんでした');
    return JSON.parse(jsonMatch[0]);
  },
};
