// gemini.js — Gemini API連携

const GeminiAPI = {
  BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',

  // 毎回分析（辛口+フォロー）
  async analyze(journalText, apiKey, goals) {
    if (!apiKey) throw new Error('Gemini APIキーが設定されていません');

    const goalText = goals && goals.length
      ? goals.map((g, i) => `目標${i+1}: ${g.title}（期限: ${g.deadline || '未設定'}）`).join('\n')
      : '目標は未設定です';

    const prompt = `
あなたは厳格かつ誠実なキャリアコーチです。
以下のジャーナルと大目標を分析し、必ずJSON形式で回答してください。

【大目標】
${goalText}

【今日のジャーナル】
${journalText}

【分析方針】
- 良かった点と問題点を具体的に指摘する（曖昧な表現禁止）
- 問題点は辛口で直接指摘する。ただし必ずフォロー（改善策・励まし）を添える
- 目標に対して今日の行動・思考がどう貢献したか、または妨げたかを明確にする
- 褒めるだけの分析は禁止。成長につながる指摘を優先する

【出力形式】
以下のJSON形式のみで回答。バッククォート不要。

{
  "summary": "今日のジャーナルの要約（2文）",
  "goodPoints": [
    {"point": "良かった点の具体的内容", "reason": "なぜ良いか・目標への貢献"}
  ],
  "problems": [
    {"point": "問題点・改善すべき点（辛口で直接的に）", "follow": "改善策とフォロー"}
  ],
  "goalProgress": [
    {"goalTitle": "目標タイトル", "achievementScore": 65, "assessment": "目標に対する今日の評価（辛口+フォロー）", "approach": "今日取るべきだった・明日取るべきアプローチ"}
  ],
  "coaching": "全体的なコーチングメッセージ（辛口だが必ずフォローで締める）",
  "tags": ["タグ1", "タグ2", "タグ3"],
  "trends": [
    {"title": "関連するトレンドや社会的問題点", "relevance": "高", "insight": "あなたの目標との関連性", "goalTitle": "紐づく目標タイトルまたはnull"}
  ],
  "strengths": [
    {"name": "強みの名前", "score": 85, "reason": "根拠"}
  ],
  "careers": [
    {"name": "キャリア候補", "score": 88, "reason": "根拠"}
  ]
}
`;

    const res = await fetch(`${this.BASE_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096, responseMimeType: 'application/json' }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini APIエラー: ${res.status}`);
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map(p => p.text || '').join('');
    if (!text) throw new Error('Geminiから応答が得られませんでした');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON形式の応答が得られませんでした');

    try { return JSON.parse(jsonMatch[0]); }
    catch(e) {
      const cleaned = jsonMatch[0].replace(/```json/g,'').replace(/```/g,'').trim();
      return JSON.parse(cleaned);
    }
  },

  // 週次分析
  async weeklyAnalyze(journals, goals, apiKey) {
    if (!apiKey) throw new Error('Gemini APIキーが設定されていません');

    const journalSummary = journals.slice(0, 20).map(j =>
      `[${new Date(j.date).toLocaleDateString('ja-JP')}] ${j.text.slice(0, 200)}`
    ).join('\n');

    const goalText = goals.map(g =>
      `目標: ${g.title}（期限: ${g.deadline || '未設定'}、現在進捗: ${g.progress || 0}%）`
    ).join('\n');

    const prompt = `
あなたは厳格なキャリアコーチです。週次レポートをJSON形式で出力してください。

【大目標】
${goalText}

【直近のジャーナル】
${journalSummary}

【出力形式】
バッククォート不要。以下のJSONのみ出力。

{
  "overallProgress": 72,
  "overallAssessment": "全体評価（辛口+フォロー）",
  "goalReports": [
    {
      "goalTitle": "目標タイトル",
      "progress": 70,
      "goodPoints": ["良かった点1", "良かった点2"],
      "problems": ["問題点1（辛口）", "問題点2"],
      "requiredSkills": [
        {"skill": "不足スキル名", "currentLevel": 30, "requiredLevel": 80, "approach": "習得アプローチ", "deadline": "いつまでに"}
      ],
      "timeline": "このペースだと目標達成は○年○月頃。期限に間に合わせるには○○が必要",
      "achieved": false
    }
  ],
  "careerDemand": [
    {
      "career": "キャリア名",
      "currentDemand": 85,
      "demand5years": 90,
      "demand10years": 75,
      "reason": "需要予測の根拠",
      "derivedCareers": [
        {"name": "派生キャリア名", "demand5years": 88, "demand10years": 80, "reason": "根拠"}
      ]
    }
  ],
  "weeklyCoaching": "週次コーチングメッセージ（辛口+必ずフォロー）"
}
`;

    const res = await fetch(`${this.BASE_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192, responseMimeType: 'application/json' }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini APIエラー: ${res.status}`);
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map(p => p.text || '').join('');
    if (!text) throw new Error('Geminiから応答が得られませんでした');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON形式の応答が得られませんでした');

    try { return JSON.parse(jsonMatch[0]); }
    catch(e) {
      const cleaned = jsonMatch[0].replace(/```json/g,'').replace(/```/g,'').trim();
      return JSON.parse(cleaned);
    }
  },

  // 自己分析（強み割合・弱み分析）
  async analyzeSelf(journals, apiKey) {
    if (!apiKey) throw new Error('Gemini APIキーが設定されていません');

    const journalText = journals.slice(0, 30).map(j =>
      `[${new Date(j.date).toLocaleDateString('ja-JP')}] ${j.text.slice(0, 300)}`
    ).join('\n\n');

    const prompt = `
あなたは心理分析とキャリア分析の専門家です。
以下の複数のジャーナルエントリーを総合的に分析し、その人の強みと弱みを深く分析してください。

【ジャーナル一覧】
${journalText}

【分析方針】
- 強みは全項目の合計が必ず100になるよう割合（ratio）で表現する
- 特化している強みは具体的なジャーナルの記述を根拠として示す
- 弱みは「外観からの弱み」（文章から直接読み取れるもの）と「潜在的な弱み」（強みの裏返しや行動パターンから推測）に分ける
- 全て具体例（ジャーナルの内容を引用・参照）を添えること
- 辛口だが必ずフォローを入れること

【出力形式】
バッククォート不要。以下のJSONのみ出力。

{
  "strengths": [
    {
      "name": "強みの名前",
      "ratio": 35,
      "description": "この強みの説明",
      "specificExample": "具体的な例（ジャーナルの内容を参照）",
      "isSpecialized": true
    }
  ],
  "weaknesses": {
    "visible": [
      {
        "name": "外観からの弱み名",
        "description": "弱みの説明（辛口）",
        "specificExample": "具体的な例（ジャーナルの内容を参照）",
        "follow": "改善のためのフォロー・アドバイス"
      }
    ],
    "potential": [
      {
        "name": "潜在的な弱み名",
        "description": "なぜこの弱みが潜在しているか（強みの裏返し等）",
        "specificExample": "具体的な根拠",
        "follow": "意識すべきこと・改善策"
      }
    ]
  },
  "overallComment": "総合コメント（辛口+フォロー）",
  "specialization": "最も特化している点とその理由（具体例付き）"
}
`;

    const res = await fetch(`${this.BASE_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096, responseMimeType: 'application/json' }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini APIエラー: ${res.status}`);
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map(p => p.text || '').join('');
    if (!text) throw new Error('Geminiから応答が得られませんでした');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON形式の応答が得られませんでした');

    try { return JSON.parse(jsonMatch[0]); }
    catch(e) {
      const cleaned = jsonMatch[0].replace(/```json/g,'').replace(/```/g,'').trim();
      return JSON.parse(cleaned);
    }
  },
};
