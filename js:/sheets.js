// sheets.js — Google Apps Script経由でスプレッドシートに保存

const SheetsAPI = {
  async save(gasUrl, payload) {
    if (!gasUrl) throw new Error('GAS URLが設定されていません');

    const res = await fetch(gasUrl, {
      method: 'POST',
      mode: 'no-cors', // CORSを回避（GASのデプロイ設定に合わせる）
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // no-corsの場合はレスポンスを読めないが、エラーなければ成功とみなす
    return true;
  },

  buildPayload(journalEntry, geminiResult, deepAnalysis) {
    const now = new Date().toISOString();
    return {
      timestamp: now,
      date: journalEntry.date,
      journal_text: journalEntry.text,
      tags: (journalEntry.tags || []).join(', '),

      // Gemini分析結果
      summary: geminiResult.summary || '',
      coaching: geminiResult.coaching || '',
      strengths: JSON.stringify(geminiResult.strengths || []),
      trends: JSON.stringify(geminiResult.trends || []),
      problems: JSON.stringify(geminiResult.problems || []),
      careers: JSON.stringify(geminiResult.careers || []),

      // OpenRouter深堀り
      deep_analysis: deepAnalysis || '',
    };
  },
};
