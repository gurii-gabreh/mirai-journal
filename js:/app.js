// app.js — ダッシュボードメインロジック

document.addEventListener('DOMContentLoaded', () => {
  initDate();
  initMenu();
  initDashboard();
  checkApiStatus();
});

function initDate() {
  const el = document.getElementById('headerDate');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric', weekday:'long' });
}

function initMenu() {
  const toggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  if (!toggle || !sidebar) return;
  toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

function initDashboard() {
  const journals = Storage.getJournals();
  const strengths = Storage.getStrengths();
  const trends = Storage.getTrends();
  const careers = Storage.getCareers();

  // メトリクス
  setEl('streakCount', Storage.getStreak() + '日');
  setEl('totalEntries', journals.length + '件');
  setEl('strengthScore', strengths.length ? calcAvgScore(strengths) + '点' : '-');
  setEl('careerCount', careers.length + '件');

  // 最新ジャーナル
  renderRecentJournals(journals.slice(0, 3));

  // 強みTOP5
  renderStrengths(strengths.slice(0, 5));

  // トレンド
  renderTrends(trends.slice(0, 4));

  // キャリア候補
  renderCareers(careers.slice(0, 5));
}

function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function calcAvgScore(strengths) {
  if (!strengths.length) return 0;
  return Math.round(strengths.reduce((a,b) => a + (b.score || 0), 0) / strengths.length);
}

function renderRecentJournals(journals) {
  const el = document.getElementById('recentJournals');
  if (!el) return;
  if (!journals.length) return; // 空状態はHTMLのまま
  el.innerHTML = journals.map(j => `
    <div class="journal-item">
      <div class="journal-item-date">${formatDate(j.date)}</div>
      <div class="journal-item-text">${escHtml(j.text)}</div>
      <div class="journal-item-tags">
        ${(j.tags || []).map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

function renderStrengths(strengths) {
  const el = document.getElementById('strengthList');
  if (!el || !strengths.length) return;
  const colors = ['#0f9e6e','#2563eb','#7c3aed','#d97706','#5a5a72'];
  el.innerHTML = strengths.map((s, i) => `
    <div class="strength-item">
      <div class="strength-header">
        <span class="strength-name">${escHtml(s.name)}</span>
        <span class="strength-pct">${s.score}%</span>
      </div>
      <div class="bar-bg">
        <div class="bar-fill" style="width:${s.score}%;background:${colors[i % colors.length]};"></div>
      </div>
    </div>
  `).join('');
}

function renderTrends(trends) {
  const el = document.getElementById('trendList');
  if (!el || !trends.length) return;
  el.innerHTML = trends.map(t => `
    <div class="trend-item">
      <span class="trend-relevance ${relevanceClass(t.relevance)}">${t.relevance || '中'}</span>
      <div class="trend-body">
        <div class="trend-title">${escHtml(t.title)}</div>
        <div class="trend-meta">${formatDate(t.date)}</div>
      </div>
    </div>
  `).join('');
}

function renderCareers(careers) {
  const el = document.getElementById('careerList');
  if (!el || !careers.length) return;
  el.innerHTML = careers.map((c, i) => `
    <div class="career-item">
      <span class="career-rank">${i+1}</span>
      <span class="career-name">${escHtml(c.name)}</span>
      <span class="career-score-badge">適合${c.score}%</span>
    </div>
  `).join('');
}

function checkApiStatus() {
  const settings = Storage.getSettings();
  const dot = document.getElementById('gemini-status-dot');
  const label = document.getElementById('gemini-status-label');
  if (!dot || !label) return;
  if (settings.geminiApiKey) {
    dot.classList.add('connected');
    label.textContent = 'Gemini 接続済み';
  } else {
    label.textContent = 'Gemini 未設定';
  }
}

// ユーティリティ
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
}
function relevanceClass(r) {
  if (r === '高') return 'relevance-high';
  if (r === '中') return 'relevance-mid';
  return 'relevance-low';
}
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// パイプライン状態更新（journal.jsから呼び出す）
function updatePipelineStep(step, status) {
  const el = document.getElementById('step' + step);
  if (!el) return;
  el.classList.remove('active', 'done');
  if (status === 'active') el.classList.add('active');
  if (status === 'done') el.classList.add('done');
  const statusEl = el.querySelector('.step-status');
  if (statusEl) {
    statusEl.textContent = status === 'done' ? '完了' : status === 'active' ? '処理中...' : '待機中';
  }
}

function showToast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
