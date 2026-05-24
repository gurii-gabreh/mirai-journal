// storage.js — ローカルデータ管理

const Storage = {
  KEYS: {
    JOURNALS: 'mj_journals',
    STRENGTHS: 'mj_strengths',
    TRENDS: 'mj_trends',
    CAREERS: 'mj_careers',
    SETTINGS: 'mj_settings',
    STREAK: 'mj_streak',
    GOALS: 'mj_goals',
  },

  get(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) { console.error('Storage error:', e); }
  },

  // ===== ジャーナル =====
  getJournals() { return this.get(this.KEYS.JOURNALS) || []; },
  saveJournal(entry) {
    const journals = this.getJournals();
    // IDがなければ付与
    if (!entry.id) entry.id = 'j_' + Date.now();
    journals.unshift(entry);
    this.set(this.KEYS.JOURNALS, journals.slice(0, 500));
    this.updateStreak();
    return entry.id;
  },

  // ジャーナル削除（紐づくトレンド・目標進捗も連動削除）
  deleteJournal(journalId) {
    // ジャーナル削除
    const journals = this.getJournals().filter(j => j.id !== journalId);
    this.set(this.KEYS.JOURNALS, journals);

    // 紐づくトレンド削除
    const trends = this.getTrends().filter(t => t.journalId !== journalId);
    this.set(this.KEYS.TRENDS, trends);

    // 目標の進捗履歴から該当ジャーナルのエントリを削除
    const goals = this.getGoals().map(g => ({
      ...g,
      history: (g.history || []).filter(h => h.journalId !== journalId)
    }));
    // 進捗率を再計算
    goals.forEach(g => {
      g.progress = this._calcGoalProgress(g);
    });
    this.set(this.KEYS.GOALS, goals);

    this.updateStreak();
  },

  // ===== 目標 =====
  getGoals() { return this.get(this.KEYS.GOALS) || []; },
  saveGoal(goal) {
    const goals = this.getGoals();
    if (!goal.id) {
      goal.id = 'g_' + Date.now();
      goal.createdAt = new Date().toISOString();
      goal.progress = 0;
      goal.history = [];
      goals.unshift(goal);
    } else {
      const idx = goals.findIndex(g => g.id === goal.id);
      if (idx >= 0) goals[idx] = goal;
    }
    this.set(this.KEYS.GOALS, goals);
    return goal.id;
  },
  deleteGoal(goalId) {
    const goals = this.getGoals().filter(g => g.id !== goalId);
    this.set(this.KEYS.GOALS, goals);
    // 紐づくトレンドのgoalIdをクリア
    const trends = this.getTrends().map(t => {
      if (t.goalId === goalId) { delete t.goalId; delete t.goalName; }
      return t;
    });
    this.set(this.KEYS.TRENDS, trends);
  },

  // 目標に進捗を追加（ジャーナル分析から）
  addGoalHistory(goalId, historyEntry) {
    const goals = this.getGoals();
    const idx = goals.findIndex(g => g.id === goalId);
    if (idx < 0) return;
    if (!goals[idx].history) goals[idx].history = [];
    goals[idx].history.unshift(historyEntry);
    goals[idx].progress = this._calcGoalProgress(goals[idx]);
    goals[idx].updatedAt = new Date().toISOString();
    this.set(this.KEYS.GOALS, goals);
  },

  // 進捗率計算（historyのachievementScoreの平均）
  _calcGoalProgress(goal) {
    const history = goal.history || [];
    if (!history.length) return 0;
    const recent = history.slice(0, 10); // 直近10件
    const avg = recent.reduce((a, b) => a + (b.achievementScore || 0), 0) / recent.length;
    return Math.round(avg);
  },

  // ===== 設定 =====
  getSettings() {
    return this.get(this.KEYS.SETTINGS) || {
      geminiApiKey: '',
      openrouterApiKey: '',
      gasUrl: '',
      openrouterModel: 'openrouter/free',
    };
  },
  saveSettings(settings) { this.set(this.KEYS.SETTINGS, settings); },

  // ===== 強み =====
  getStrengths() { return this.get(this.KEYS.STRENGTHS) || []; },
  saveStrengths(data) { this.set(this.KEYS.STRENGTHS, data); },

  // ===== トレンド =====
  getTrends() { return this.get(this.KEYS.TRENDS) || []; },
  saveTrend(trend) {
    const trends = this.getTrends();
    if (!trend.id) trend.id = 't_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
    trends.unshift(trend);
    this.set(this.KEYS.TRENDS, trends.slice(0, 200));
  },

  // ===== キャリア候補 =====
  getCareers() { return this.get(this.KEYS.CAREERS) || []; },
  saveCareers(careers) { this.set(this.KEYS.CAREERS, careers); },

  // ===== 連続記録 =====
  updateStreak() {
    const journals = this.getJournals();
    if (!journals.length) { this.set(this.KEYS.STREAK, 0); return; }
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const lastDate = new Date(journals[0].date).toDateString();
    const streak = this.get(this.KEYS.STREAK) || 0;
    if (lastDate === today) {
      // 今日すでに記録済み
    } else if (lastDate === yesterday) {
      this.set(this.KEYS.STREAK, streak + 1);
    } else {
      this.set(this.KEYS.STREAK, 1);
    }
  },
  getStreak() { return this.get(this.KEYS.STREAK) || 0; },
};
