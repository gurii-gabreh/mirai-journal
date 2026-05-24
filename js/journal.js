// journal.js — ジャーナル入力・AI処理パイプライン

document.addEventListener('DOMContentLoaded', () => {
  initDate();
  initMenu();
  initChips();
  initCharCount();
  initButtons();
  checkApiStatus();
  loadGoalSelector();
});

function initDate() {
  const el = document.getElementById('headerDate');
  if (el) el.textContent = new Date().toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric', weekday:'long' });
}

function initMenu() {
  const toggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  if (!toggle || !sidebar) return;
  toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !toggle.contains(e.target)) sidebar.classList.remove('open');
  });
}

function initChips() {
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const textarea = document.getElementById('journalText');
      if (!textarea) return;
      const addText = chip.dataset.text || '';
      textarea.value += (textarea.value && !textarea.value.endsWith('\n') ? '\n' : '') + addText;
      textarea.focus();
      updateCharCount();
    });
  });
}

function initCharCount() {
  const textarea = document.getElementById('journalText');
  if (!textarea) return;
  textarea.addEventListener('input', updateCharCount);
}

function updateCharCount() {
  const textarea = document.getElementById('journalText');
  const el = document.getElementById('charCount');
  if (textarea && el) el.textContent = textarea.value.length + '文字';
}

function initButtons() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const saveOnlyBtn = document.getElementById('saveOnlyBtn');
  if (analyzeBtn) analyzeBtn.addEventListener('click', runPipeline);
  if (saveOnlyBtn) saveOnlyBtn.addEventListener('click', saveOnly);
}

// 目標セレクター読み込み
function loadGoalSelector() {
  const container = document.getElementById('goalSelectorArea');
  if (!container) return;
  const goals = Storage.getGoals().filter(g => !g.achieved);
  if (!goals.length) {
    container.innerHTML = `<div style="font-size:12px;color:var(--text-muted);">
      目標が未設定です。<a href="goals.html" style="color:var(--accent-blue);">目標を登録する →</a>
    </div>`;
    return;
  }
  container.innerHTML = `
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">📎 今日のジャーナルを紐づける目標（複数選択可）</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;">
      ${goals.map(g => `
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;padding:4px 10px;border:1px solid var(--border-strong);border-radius:20px;background:var(--bg-surface);">
          <input type="checkbox" name="goalCheck" value="${g.id}" style="accent-color:var(--accent-blue);"> ${esc(g.title.slice(0,20))}${g.title.length>20?'...':''}
        </label>
      `).join('')}
    </div>
  `;
}

function getSelectedGoals() {
  const checked = document.querySelectorAll('input[name="goalCheck"]:checked');
  const goalIds = Array.from(checked).map(c => c.value);
  return Storage.getGoals().filter(g => goalIds.includes(g.id));
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
    dot.classList.remove('connected');
    label.textContent = 'Gemini 未設定';
  }
}

// ===== メインパイプライン =====
async function runPipeline() {
  const textarea = document.getElementById('journalText');
  const text = textarea?.value?.trim();
  if (!text || text.length < 20) { showAlert('20文字以上のジャーナルを入力してください', 'error'); return; }

  const settings = Storage.getSettings();
  if (!settings.geminiApiKey) {
    showAlert('API設定ページでGemini APIキーを設定してください', 'error');
    setTimeout(() => { window.location.href = 'settings.html'; }, 2000);
    return;
  }

  const analyzeBtn = document.getElementById('analyzeBtn');
  analyzeBtn.disabled = true;
  analyzeBtn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 1s linear infinite;"></i>処理中...';

  const pipelineCard = document.getElementById('pipelineCard');
  if (pipelineCard) pipelineCard.style.display = 'block';

  const selectedGoals = getSelectedGoals();
  const journalId = 'j_' + Date.now();
  const journalEntry = { id: journalId, text, date: new Date().toISOString(), tags: [], goalIds: selectedGoals.map(g=>g.id) };
  let geminiResult = null;
  let deepAnalysis = '';

  try {
    setStep(1, 'done');

    // Step2: Gemini分析（辛口+フォロー）
    setStep(2, 'active');
    geminiResult = await GeminiAPI.analyze(text, settings.geminiApiKey, selectedGoals);
    journalEntry.tags = geminiResult.tags || [];
    setStep(2, 'done');

    // 結果表示
    showResultArea();
    renderGeminiResult(geminiResult);

    // ローカル保存
    Storage.saveJournal(journalEntry);
    Storage.saveStrengths(mergeStrengths(geminiResult.strengths || []));

    // トレンド保存（目標紐付き）
    (geminiResult.trends || []).forEach(t => {
      // 目標タイトルからIDを逆引き
      const matchGoal = selectedGoals.find(g => g.title === t.goalTitle);
      Storage.saveTrend({
        ...t,
        date: journalEntry.date,
        journalId,
        goalId: matchGoal?.id || null,
        goalName: matchGoal?.title || t.goalTitle || null,
      });
    });
    Storage.saveCareers(mergeCareers(geminiResult.careers || []));

    // 目標進捗を更新
    if (selectedGoals.length && geminiResult.goalProgress) {
      geminiResult.goalProgress.forEach(gp => {
        const matchGoal = selectedGoals.find(g => g.title === gp.goalTitle);
        if (matchGoal) {
          Storage.addGoalHistory(matchGoal.id, {
            journalId,
            date: journalEntry.date,
            journalText: text.slice(0, 200),
            achievementScore: gp.achievementScore || 0,
            assessment: gp.assessment || '',
            approach: gp.approach || '',
            goodPoints: (geminiResult.goodPoints || []).map(p => p.point),
            problems: geminiResult.problems || [],
          });
        }
      });
    }

    // Step3: スプレッドシート保存
    setStep(3, 'active');
    if (settings.gasUrl) {
      try {
        const payload = SheetsAPI.buildPayload(journalEntry, geminiResult, '');
        await SheetsAPI.save(settings.gasUrl, payload);
        setStep(3, 'done');
      } catch(e) {
        console.warn('スプレッドシート保存エラー:', e.message);
        setStepError(3, 'スキップ');
      }
    } else {
      setStepError(3, '未設定');
    }

    // Step4: OpenRouter深堀り
    setStep(4, 'active');
    if (settings.openrouterApiKey) {
      try {
        deepAnalysis = await OpenRouterAPI.deepAnalyze(geminiResult, text, settings.openrouterApiKey, settings.openrouterModel);
        renderDeepAnalysis(deepAnalysis);
        setStep(4, 'done');
        if (settings.gasUrl) {
          try {
            const payload = SheetsAPI.buildPayload(journalEntry, geminiResult, deepAnalysis);
            await SheetsAPI.save(settings.gasUrl, payload);
          } catch(e) { console.warn('スプレッドシート更新エラー:', e.message); }
        }
      } catch(e) {
        renderDeepAnalysis('⚠️ OpenRouter分析に失敗しました: ' + e.message);
        setStepError(4, 'エラー');
      }
    } else {
      renderDeepAnalysis('ℹ️ OpenRouter APIキーが未設定のため深堀り分析はスキップされました。');
      setStepError(4, '未設定');
    }

    setStep(5, 'done');
    showAlert('分析が完了しました！', 'success');

  } catch(e) {
    console.error('パイプラインエラー:', e);
    showAlert('エラー: ' + e.message, 'error');
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = '<i class="ti ti-sparkles"></i>AIに分析させる';
  }
}

function saveOnly() {
  const textarea = document.getElementById('journalText');
  const text = textarea?.value?.trim();
  if (!text) { showAlert('内容を入力してください', 'error'); return; }
  const journalId = 'j_' + Date.now();
  Storage.saveJournal({ id: journalId, text, date: new Date().toISOString(), tags: [] });
  showAlert('保存しました', 'success');
  setTimeout(() => { window.location.href = '../index.html'; }, 1500);
}

// ===== UI更新 =====
function setStep(n, status) {
  const el = document.getElementById('step' + n);
  if (!el) return;
  el.classList.remove('active','done');
  if (status === 'active') el.classList.add('active');
  if (status === 'done') el.classList.add('done');
  const s = el.querySelector('.step-status');
  if (s) s.textContent = status === 'done' ? '✓ 完了' : status === 'active' ? '処理中...' : '待機中';
}

function setStepError(n, msg) {
  const el = document.getElementById('step' + n);
  if (!el) return;
  const s = el.querySelector('.step-status');
  if (s) { s.textContent = msg; s.style.color = 'var(--accent-amber)'; }
}

function showResultArea() {
  const el = document.getElementById('resultArea');
  if (el) el.style.display = 'block';
}

function renderGeminiResult(r) {
  setText('resultSummary', r.summary || '');
  setText('resultCoaching', r.coaching || '');

  // 良かった点
  const goodEl = document.getElementById('resultGoodPoints');
  if (goodEl && r.goodPoints) {
    goodEl.innerHTML = r.goodPoints.map(p => `
      <div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
        <span style="color:var(--accent-green);font-size:16px;flex-shrink:0;">✓</span>
        <div>
          <div style="font-size:13px;font-weight:500;">${esc(p.point)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${esc(p.reason||'')}</div>
        </div>
      </div>
    `).join('');
  }

  // 問題点（辛口+フォロー）
  const probEl = document.getElementById('resultProblems');
  if (probEl && r.problems) {
    probEl.innerHTML = r.problems.map(p => `
      <div style="padding:10px;background:#fff9f9;border-left:3px solid #e74c3c;border-radius:4px;margin-bottom:8px;">
        <div style="font-size:13px;font-weight:500;color:#c0392b;">⚠ ${esc(p.point)}</div>
        <div style="font-size:12px;color:var(--accent-green);margin-top:6px;">→ ${esc(p.follow||'')}</div>
      </div>
    `).join('');
  }

  // 目標進捗
  const goalEl = document.getElementById('resultGoalProgress');
  if (goalEl && r.goalProgress) {
    goalEl.innerHTML = r.goalProgress.map(gp => {
      const sc = gp.achievementScore || 0;
      const color = sc >= 70 ? '#0f9e6e' : sc >= 40 ? '#d97706' : '#e74c3c';
      return `
        <div style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:13px;font-weight:500;">${esc(gp.goalTitle)}</span>
            <span style="font-size:13px;font-weight:700;color:${color};">${sc}%</span>
          </div>
          <div style="height:4px;background:var(--bg-base);border-radius:2px;margin-bottom:8px;">
            <div style="height:100%;width:${sc}%;background:${color};border-radius:2px;"></div>
          </div>
          <div style="font-size:12px;color:var(--text-secondary);">${esc(gp.assessment||'')}</div>
          ${gp.approach ? `<div style="font-size:12px;color:var(--accent-blue);margin-top:4px;">→ ${esc(gp.approach)}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  // 強み
  const strengthsEl = document.getElementById('resultStrengths');
  if (strengthsEl && r.strengths) {
    const colors = ['#0f9e6e','#2563eb','#7c3aed','#d97706','#888'];
    strengthsEl.innerHTML = r.strengths.map((s,i) => `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
          <span style="font-weight:500;">${esc(s.name)}</span>
          <span style="color:var(--text-muted);">${s.score}%</span>
        </div>
        <div style="height:5px;background:var(--bg-base);border-radius:3px;">
          <div style="height:100%;width:${s.score}%;background:${colors[i%colors.length]};border-radius:3px;"></div>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${esc(s.reason||'')}</div>
      </div>
    `).join('');
  }
}

function renderDeepAnalysis(text) {
  const el = document.getElementById('deepAnalysisArea');
  if (!el) return;
  const html = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^#{1,3}\s+(.+)$/gm, '<h3 style="font-size:14px;margin:12px 0 6px;">$1</h3>')
    .replace(/\n/g, '<br>');
  el.innerHTML = `<div class="ai-result-text" style="line-height:1.8;">${html}</div>`;
}

function mergeStrengths(newStrengths) {
  const existing = Storage.getStrengths();
  const merged = [...existing];
  newStrengths.forEach(ns => {
    const idx = merged.findIndex(s => s.name === ns.name);
    if (idx >= 0) merged[idx].score = Math.round((merged[idx].score + ns.score) / 2);
    else merged.push(ns);
  });
  return merged.sort((a,b) => b.score - a.score).slice(0, 20);
}

function mergeCareers(newCareers) {
  const existing = Storage.getCareers();
  const merged = [...existing];
  newCareers.forEach(nc => {
    const idx = merged.findIndex(c => c.name === nc.name);
    if (idx >= 0) merged[idx].score = Math.round((merged[idx].score + nc.score) / 2);
    else merged.push(nc);
  });
  return merged.sort((a,b) => b.score - a.score).slice(0, 20);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function showAlert(msg, type) {
  document.querySelectorAll('.floating-alert').forEach(e => e.remove());
  const el = document.createElement('div');
  el.className = 'toast floating-alert ' + (type==='success'?'success':type==='error'?'error':'');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

const style = document.createElement('style');
style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(style);
