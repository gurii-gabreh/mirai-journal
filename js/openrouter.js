// openrouter.js — OpenRouter連携（無料モデル使用）

const OpenRouterAPI = {
  BASE_URL: 'https://openrouter.ai/api/v1/chat/completions',

  // 2026年5月時点で利用可能な無料モデル一覧
  FREE_MODELS: [
    { id: 'openrouter/free', name: '自動選択（無料・推奨）' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (無料)' },
    { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (無料)' },
    { id: 'qwen/qwen3-14b:free', name: 'Qwen3 14B (無料)' },
  ],

  async deepAnalyze(geminiResult, journalText, apiKey, model) {
    if (!apiKey) throw new Error('OpenRouter APIキーが設定されていません');

    // デフォルトは自動選択（openrouter/free）
    const usedModel = model || 'openrouter/free';

    const prompt = `
あなたはキャリアコンサルタントかつ未来洞察の専門家です。
以下のAI分析結果とジャーナルを元に、より深く掘り下げた洞察を提供してください。

【ジャーナル内容】
${journalText}

【Geminiによる初期分析】
${JSON.stringify(geminiResult, null, 2)}

以下について日本語で詳しく分析してください：

1. **独自性の発見**: この人だけができる業種・ポジションは何か？強みの組み合わせから独自のニッチを提案
2. **問題解決力の深堀り**: 発見された問題点に対して、具体的にどんな解決策・ビジネスモデルが考えられるか
3. **次の30日間のアクション**: 自己探求とキャリア構築のために今すぐできる具体的な行動3つ
4. **市場との接点**: 強みとトレンドがどう交差しているか、そこにどんなチャンスがあるか

回答は構造化された読みやすい形式でお願いします。
`;

    const res = await fetch(this.BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://gurii-gabreh.github.io/mirai-journal/',
        'X-Title': 'Mirai Journal',
      },
      body: JSON.stringify({
        model: usedModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.8,
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenRouter APIエラー: ${res.status}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '深堀り分析の取得に失敗しました';
  },
};
