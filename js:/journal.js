// journal.js — ジャーナル入力・AI処理パイプライン

document.addEventListener('DOMContentLoaded', () => {
  initDate();
  initMenu();
  initChips();
  initCharCount();
  initButtons();
  checkApiStatus();
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
  if (!text || text.length < 20) {
    showAlert('20文字以上のジャーナルを入力してください', 'error');
    return;
  }

  const settings = Storage.getSettings();
  if (!settings.geminiApiKey) {
    showAlert('API設定ページでGemini APIキーを設定してください', 'error');
    setTimeout(() => { window.location.href = 'settings.html'; }, 2000);
    return;
  }

  const analyzeBtn = document.getElementById('analyzeBtn');
  analyzeBtn.disabled = true;
  analyzeBtn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 1s linear infinite;"></i>処理中...';

  // パイプライン表示
  const pipelineCard = document.getElementById('pipelineCard');
  if (pipelineCard) pipelineCard.style.display = 'block';

  const journalEntry = { text, date: new Date().toISOString(), tags: [] };
  let geminiResult = null;
  let deepAnalysis = '';

  try {
    // Step1: 入力完了
    setStep(1, 'done');

    // Step2: Gemini分析
    setStep(2, 'active');
    geminiResult = await GeminiAPI.analyze(text, settings.geminiApiKey);
    journalEntry.tags = geminiResult.tags || [];
    setStep(2, 'done');

    // Gemini結果を画面に表示
    showResultArea();
    renderGeminiResult(geminiResult);

    // ローカル保存
    Storage.saveJournal(journalEntry);
    Storage.saveStrengths(mergeStrengths(geminiResult.strengths || []));
    (geminiResult.trends || []).forEach(t => Storage.saveTrend({ ...t, date: journalEntry.date }));
    Storage.saveCareers(mergeCareers(geminiResult.careers || []));

    // Step3: スプレッドシート保存
    setStep(3, 'active');
    if (settings.gasUrl) {
      try {
        const payload = SheetsAPI.buildPayload(journalEntry, geminiResult, '');
        await SheetsAPI.save(settings.gasUrl, payload);
        setStep(3, 'done');
      } catch(e) {
        console.warn('スプレッドシート保存エラー（続行）:', e.message);
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

        // Step3: スプレッドシートを深堀り含めて更新
        if (settings.gasUrl) {
          try {
            const payload = SheetsAPI.buildPayload(journalEntry, geminiResult, deepAnalysis);
            await SheetsAPI.save(settings.gasUrl, payload);
          } catch(e) { console.warn('スプレッドシート更新エラー:', e.message); }
        }
      } catch(e) {
        console.warn('OpenRouterエラー:', e.message);
        renderDeepAnalysis('⚠️ OpenRouter分析に失敗しました: ' + e.message);
        setStepError(4, 'エラー');
      }
    } else {
      renderDeepAnalysis('ℹ️ OpenRouter APIキーが未設定のため、深堀り分析はスキップされました。\n設定ページでAPIキーを登録すると利用できます。');
      setStepError(4, '未設定');
    }

    // Step5: 完了
    setStep(5, 'done');
    showAlert('分析が完了しました！', 'success');

  } catch (e) {
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
  Storage.saveJournal({ text, date: new Date().toISOString(), tags: [] });
  showAlert('保存しました', 'success');
  setTimeout(() => { window.location.href = '../index.html'; }, 1500);
}

// ===== UI更新 =====
function setStep(n, status) {
  const el = document.getElementById('step' + n);
  if (!el) return;
  el.classList.remove('active', 'done', 'error');
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

  // 強み
  const strengthsEl = document.getElementById('resultStrengths');
  if (strengthsEl && r.strengths) {
    const colors = ['#0f9e6e','#2563eb','#7c3aed','#d97706','#888'];
    strengthsEl.innerHTML = r.strengths.map((s, i) => `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
          <span style="font-weight:500;">${escHtml(s.name)}</span>
          <span style="color:var(--text-muted);">${s.score}%</span>
        </div>
        <div style="height:5px;background:var(--bg-base);border-radius:3px;overflow:hidden;margin-bottom:4px;">
          <div style="height:100%;width:${s.score}%;background:${colors[i%colors.length]};border-radius:3px;"></div>
        </div>
        <div style="font-size:11px;color:var(--text-muted);">${escHtml(s.reason || '')}</div>
      </div>
    `).join('');
  }

  // トレンド
  const trendsEl = document.getElementById('resultTrends');
  if (trendsEl && r.trends) {
    trendsEl.innerHTML = r.trends.map(t => `
      <div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
        <span class="trend-relevance ${relevanceClass(t.relevance)}">${t.relevance || '中'}</span>
        <div>
          <div style="font-size:13px;font-weight:500;">${escHtml(t.title)}</div>
          <div style="font-size:11px;color:var(--text-muted);">${escHtml(t.insight || '')}</div>
        </div>
      </div>
    `).join('');
  }

  // キャリア候補
  const careersEl = document.getElementById('resultCareers');
  if (careersEl && r.careers) {
    careersEl.innerHTML = r.careers.map((c, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:12px;color:var(--text-muted);width:18px;">${i+1}</span>
        <span style="font-size:13px;flex:1;">${escHtml(c.name)}</span>
        <span class="career-score-badge">適合${c.score}%</span>
      </div>
      <div style="font-size:11px;color:var(--text-muted);padding:0 28px 6px;">${escHtml(c.reason || '')}</div>
    `).join('');
  }
}

function renderDeepAnalysis(text) {
  const el = document.getElementById('deepAnalysisArea');
  if (!el) return;
  // Markdownライクな変換
  const html = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^#{1,3}\s+(.+)$/gm, '<h3 style="font-size:14px;margin:12px 0 6px;">$1</h3>')
    .replace(/\n/g, '<br>');
  el.innerHTML = `<div class="ai-result-text" style="line-height:1.8;">${html}</div>`;
}

// ===== データマージ =====
function mergeStrengths(newStrengths) {
  const existing = Storage.getStrengths();
  const merged = [...existing];
  newStrengths.forEach(ns => {
    const idx = merged.findIndex(s => s.name === ns.name);
    if (idx >= 0) {
      // 既存があれば平均化
      merged[idx].score = Math.round((merged[idx].score + ns.score) / 2);
    } else {
      merged.push(ns);
    }
  });
  return merged.sort((a, b) => b.score - a.score).slice(0, 20);
}

function mergeCareers(newCareers) {
  const existing = Storage.getCareers();
  const merged = [...existing];
  newCareers.forEach(nc => {
    const idx = merged.findIndex(c => c.name === nc.name);
    if (idx >= 0) {
      merged[idx].score = Math.round((merged[idx].score + nc.score) / 2);
    } else {
      merged.push(nc);
    }
  });
  return merged.sort((a, b) => b.score - a.score).slice(0, 20);
}

// ===== ユーティリティ =====
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function relevanceClass(r) {
  if (r === '高') return 'relevance-high';
  if (r === '中') return 'relevance-mid';
  return 'relevance-low';
}
function showAlert(msg, type) {
  // 既存のアラートを削除
  document.querySelectorAll('.floating-alert').forEach(e => e.remove());
  const el = document.createElement('div');
  el.className = 'toast floating-alert ' + (type === 'success' ? 'success' : type === 'error' ? 'error' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// CSS追加
const style = document.createElement('style');
style.textContent = `
  @keyframes spin { to { transform: rotate(360deg); } }
  .pipeline-step.error .step-icon { border-color: var(--accent-amber); color: var(--accent-amber); }
`;
document.head.appendChild(style);
