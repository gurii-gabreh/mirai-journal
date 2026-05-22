// storage.js — ローカルデータ管理（バックアップ用）

const Storage = {
  KEYS: {
    JOURNALS: 'mj_journals',
    STRENGTHS: 'mj_strengths',
    TRENDS: 'mj_trends',
    CAREERS: 'mj_careers',
    SETTINGS: 'mj_settings',
    STREAK: 'mj_streak',
  },

  get(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) { console.error('Storage error:', e); }
  },

  // ジャーナル
  getJournals() { return this.get(this.KEYS.JOURNALS) || []; },
  saveJournal(entry) {
    const journals = this.getJournals();
    journals.unshift(entry);
    this.set(this.KEYS.JOURNALS, journals.slice(0, 200)); // 最大200件
    this.updateStreak();
  },

  // 設定
  getSettings() {
    return this.get(this.KEYS.SETTINGS) || {
      geminiApiKey: '',
      openrouterApiKey: '',
      gasUrl: '',
      openrouterModel: 'mistralai/mistral-7b-instruct:free',
    };
  },
  saveSettings(settings) { this.set(this.KEYS.SETTINGS, settings); },

  // 強み
  getStrengths() { return this.get(this.KEYS.STRENGTHS) || []; },
  saveStrengths(data) { this.set(this.KEYS.STRENGTHS, data); },

  // トレンド
  getTrends() { return this.get(this.KEYS.TRENDS) || []; },
  saveTrend(trend) {
    const trends = this.getTrends();
    trends.unshift(trend);
    this.set(this.KEYS.TRENDS, trends.slice(0, 100));
  },

  // キャリア候補
  getCareers() { return this.get(this.KEYS.CAREERS) || []; },
  saveCareers(careers) { this.set(this.KEYS.CAREERS, careers); },

  // 連続記録
  updateStreak() {
    const journals = this.getJournals();
    if (!journals.length) { this.set(this.KEYS.STREAK, 0); return; }
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const lastDate = new Date(journals[0].date).toDateString();
    const streak = this.get(this.KEYS.STREAK) || 0;
    if (lastDate === today) {
      // 今日すでに記録済みならそのまま
    } else if (lastDate === yesterday) {
      this.set(this.KEYS.STREAK, streak + 1);
    } else {
      this.set(this.KEYS.STREAK, 1);
    }
  },
  getStreak() { return this.get(this.KEYS.STREAK) || 0; },
};
