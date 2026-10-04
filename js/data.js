// data.js — JSON正本(GitHub)からの読み取り専用フェッチモジュール(2026-10-04、全面改修で新設)
//
// mirai-journalはこのファイル以外に書き込み手段を持たない。journals.json/profile.jsonへの
// 書き込みは常にClaude Codeセッションが直接commitする(サイト上の保存・編集・削除UIは撤去済み)。
// 旧storage.js(localStorage)はこのファイルに置き換えられた。

const Data = {
  JOURNALS_URL: "https://raw.githubusercontent.com/gurii-gabreh/mirai-journal/main/data/journals.json",
  PROFILE_URL: "https://raw.githubusercontent.com/gurii-gabreh/mirai-journal/main/data/profile.json",

  _journals: null,
  _profile: null,
  _loaded: false,
  _error: null,

  async init() {
    try {
      const [j, p] = await Promise.all([
        fetch(this.JOURNALS_URL, { cache: "no-store" }).then((r) => {
          if (!r.ok) throw new Error(`journals.json の取得に失敗しました(HTTP ${r.status})`);
          return r.json();
        }),
        fetch(this.PROFILE_URL, { cache: "no-store" }).then((r) => {
          if (!r.ok) throw new Error(`profile.json の取得に失敗しました(HTTP ${r.status})`);
          return r.json();
        }),
      ]);
      this._journals = j;
      this._profile = p;
      this._loaded = true;
    } catch (e) {
      this._error = e;
      throw e;
    }
  },

  getJournals() {
    return (this._journals && this._journals.entries) || [];
  },
  getJournal(id) {
    return this.getJournals().find((e) => e.id === id) || null;
  },
  getGoals() {
    return (this._profile && this._profile.goals) || [];
  },
  getGoal(id) {
    return this.getGoals().find((g) => g.id === id) || null;
  },
  getStrengths() {
    return (this._profile && this._profile.strengths) || [];
  },
  getCareers() {
    return (this._profile && this._profile.careers) || [];
  },
  getTrends() {
    return (this._profile && this._profile.trends) || [];
  },
  getWeeklyReport() {
    return (this._profile && this._profile.weeklyReport) || null;
  },
  getSelfAnalysis() {
    return (this._profile && this._profile.selfAnalysis) || null;
  },

  // 連続記録日数(journalsのdateを日付単位で見て、今日から遡って連続している日数を数える)
  getStreak() {
    const journals = this.getJournals();
    if (!journals.length) return 0;
    const days = new Set(journals.map((j) => new Date(j.date).toDateString()));
    let streak = 0;
    let cursor = new Date();
    // 今日の記録がまだ無くても、昨日まで繋がっていれば streak を維持する
    if (!days.has(cursor.toDateString())) {
      cursor = new Date(Date.now() - 86400000);
    }
    while (days.has(cursor.toDateString())) {
      streak += 1;
      cursor = new Date(cursor.getTime() - 86400000);
    }
    return streak;
  },
};
