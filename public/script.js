const API = '';

let QUIZ_API_KEY = '';
fetch(`${API}/api/config`).then(r => r.json()).then(d => { QUIZ_API_KEY = d.quizApiKey; }).catch(() => {});

let userId = localStorage.getItem('climate_user_id') || (() => {
  const id = 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  localStorage.setItem('climate_user_id', id);
  return id;
})();

let currentConvId = null;
let chatMessages = [];
let isLoading = false;

let quizQuestions = [];
let quizAnswers = [];
let quizResults = [];
let currentQuestion = 0;
let quizTimer = null;
let quizStartTime = 0;

const $ = id => document.getElementById(id);

// ===== SIDEBAR =====
const sidebar = $('sidebar');
const sidebarOverlay = $('sidebarOverlay');
const hamburgerBtn = $('hamburgerBtn');
const sidebarClose = $('sidebarClose');
const sidebarItems = document.querySelectorAll('.sidebar-item');
const views = document.querySelectorAll('.view');
const chatInputContainer = $('chatInputContainer');

function openSidebar() { sidebar.classList.add('open'); sidebarOverlay.classList.add('active'); loadConversationList(); }
function closeSidebar() { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('active'); }

hamburgerBtn.addEventListener('click', openSidebar);
sidebarClose.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

sidebarItems.forEach(item => {
  item.addEventListener('click', () => {
    sidebarItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const view = item.dataset.view;
    if (view === 'home') {
      showLanding();
      chatInputContainer.style.display = 'none';
      closeSidebar();
      return;
    }
    views.forEach(v => v.classList.remove('active'));
    $(view + 'View').classList.add('active');
    chatInputContainer.style.display = view === 'chat' ? '' : 'none';
    closeSidebar();
    if (view === 'history') loadHistory();
    if (view === 'quiz') loadQuizStats();
    if (view === 'chat') loadConversationList();
  });
});

// ===== CONVERSATION HISTORY =====
async function loadConversationList() {
  try {
    const res = await fetch(`${API}/api/conversations/${userId}`);
    const data = await res.json();
    const list = $('sidebarConvList');

    if (!data.conversations.length) {
      list.innerHTML = '<div class="conv-empty">No conversations yet</div>';
      return;
    }

    list.innerHTML = data.conversations.map(c => {
      const date = new Date(c.updatedAt);
      const timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const isActive = c.id === currentConvId;
      return `
        <div class="conv-item ${isActive ? 'active' : ''}" data-conv-id="${c.id}">
          <div class="conv-item-title">${escapeHtml(c.title)}</div>
          <div class="conv-item-meta">${c.messageCount} messages · ${timeStr}</div>
          <button class="conv-item-delete" data-conv-id="${c.id}" title="Delete">&times;</button>
        </div>`;
    }).join('');

    list.querySelectorAll('.conv-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('conv-item-delete')) return;
        loadConversation(item.dataset.convId);
        closeSidebar();
      });
    });

    list.querySelectorAll('.conv-item-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Delete this conversation?')) return;
        await fetch(`${API}/api/conversations/${userId}/${btn.dataset.convId}`, { method: 'DELETE' });
        if (btn.dataset.convId === currentConvId) startNewChat();
        loadConversationList();
      });
    });
  } catch {}
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function loadConversation(convId) {
  try {
    const res = await fetch(`${API}/api/conversations/${userId}/${convId}`);
    const data = await res.json();
    currentConvId = convId;
    chatMessages = data.conversation.messages || [];
    renderChatMessages();
    loadConversationList();
  } catch {}
}

function renderChatMessages() {
  const container = $('chatContainer');
  if (!chatMessages.length) {
    container.innerHTML = `
      <div class="welcome-message">
        <div class="welcome-icon">🌱</div>
        <h2>Welcome to the Global Climate & Sustainability Coach</h2>
        <p>I'm here to guide you toward sustainable consumption, waste reduction, and lower-impact lifestyle choices.</p>
        <div class="topic-chips">
          <button class="chip" data-message="How can I reduce my carbon footprint at home?">Carbon Footprint</button>
          <button class="chip" data-message="What are the best practices for sustainable consumption?">Sustainable Consumption</button>
          <button class="chip" data-message="How can I reduce food waste in my daily life?">Food Waste</button>
          <button class="chip" data-message="What are effective ways to reduce plastic use?">Plastic Reduction</button>
          <button class="chip" data-message="How can I make my wardrobe more sustainable?">Fashion Sustainability</button>
        </div>
      </div>`;
    attachChipListeners();
    return;
  }

  container.innerHTML = '';
  chatMessages.forEach(msg => {
    const d = document.createElement('div');
    d.className = `message ${msg.role === 'user' ? 'user' : 'bot'}`;
    const avatar = msg.role === 'user' ? '👤' : '🌍';
    const content = msg.role === 'assistant' ? formatMessage(msg.content) : `<p>${escapeHtml(msg.content)}</p>`;
    d.innerHTML = `<div class="message-avatar">${avatar}</div><div class="message-content">${content}</div>`;
    container.appendChild(d);
  });
  scrollChatToBottom();
}

async function startNewChat() {
  try {
    const res = await fetch(`${API}/api/conversations/${userId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Conversation' })
    });
    const data = await res.json();
    currentConvId = data.conversation.id;
    chatMessages = [];
    renderChatMessages();
    loadConversationList();
  } catch {}
}

$('clearAllConvsBtn').addEventListener('click', async () => {
  if (!confirm('Delete all conversations?')) return;
  await fetch(`${API}/api/conversations/${userId}`, { method: 'DELETE' });
  startNewChat();
  loadConversationList();
});

// ===== CHAT =====
const chatContainer = $('chatContainer');
const messageInput = $('messageInput');
const sendBtn = $('sendBtn');
const clearBtn = $('clearBtn');

messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
  sendBtn.disabled = !messageInput.value.trim();
});

messageInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (messageInput.value.trim() && !isLoading) sendMessage(); }
});
sendBtn.addEventListener('click', () => { if (messageInput.value.trim() && !isLoading) sendMessage(); });

clearBtn.addEventListener('click', () => { startNewChat(); });

function attachChipListeners() {
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => { messageInput.value = chip.dataset.message; sendBtn.disabled = false; sendMessage(); });
  });
}
attachChipListeners();

function formatMessage(text) {
  let listOpen = false;
  let tableOpen = false;
  const out = [];

  const closeList = () => { if (listOpen) { out.push('</ul>'); listOpen = false; } };
  const flushTable = () => { if (tableOpen) { out.push('</table></div>'); tableOpen = false; } };

  const inline = (raw) => {
    const s = raw.replace(/\$\$/g, '').replace(/\$/g, '');
    return s
      .replace(/\\text\{([^}]*)\}/g, '$1')
      .replace(/\\times/g, '×')
      .replace(/\\[a-z]+/g, '')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>');
  };

  const lines = escapeHtml(text).split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) { closeList(); continue; }

    if (/^#{1,6}\s+/.test(line)) {
      closeList(); flushTable();
      const level = Math.min(line.match(/^#+/)[0].length, 3);
      out.push(`<h${level}>${inline(line.replace(/^#+\s*/, ''))}</h${level}>`);
      continue;
    }

    if (line.includes('|') && !/^[\s|: -]+$/.test(line)) {
      closeList();
      const next = (lines[i + 1] || '').trim();
      const isHeader = /^[\s|:-]+$/.test(next) && next.includes('-');
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => inline(c.trim()));
      if (!tableOpen) { tableOpen = true; out.push('<div class="table-wrap"><table>'); }
      out.push(isHeader
        ? `<tr><th>${cells.join('</th><th>')}</th></tr>`
        : `<tr><td>${cells.join('</td><td>')}</td></tr>`);
      if (isHeader) i++;
      continue;
    }

    if (/^[•*-]\s+/.test(line)) {
      flushTable();
      if (!listOpen) { out.push('<ul>'); listOpen = true; }
      out.push(`<li>${inline(line.replace(/^[•*-]\s+/, ''))}</li>`);
      continue;
    }

    flushTable();
    out.push(`<p>${inline(line)}</p>`);
  }

  closeList(); flushTable();
  return out.join('');
}

function scrollChatToBottom() {
  $('chatView').scrollTop = $('chatView').scrollHeight;
}

function addMessage(content, role) {
  const w = chatContainer.querySelector('.welcome-message'); if (w) w.remove();
  const d = document.createElement('div');
  d.className = `message ${role}`;
  const avatar = role === 'user' ? '👤' : '🌍';
  const formatted = role === 'bot' ? formatMessage(content) : `<p>${escapeHtml(content)}</p>`;
  d.innerHTML = `<div class="message-avatar">${avatar}</div><div class="message-content">${formatted}</div>`;
  chatContainer.appendChild(d);
  scrollChatToBottom();
}

function addTypingIndicator() {
  const d = document.createElement('div');
  d.className = 'message bot'; d.id = 'typingIndicator';
  d.innerHTML = '<div class="message-avatar">🌍</div><div class="message-content"><div class="typing-indicator"><span></span><span></span><span></span></div></div>';
  chatContainer.appendChild(d);
  scrollChatToBottom();
}

async function sendMessage() {
  const msg = messageInput.value.trim();
  if (!msg || isLoading) return;

  if (!currentConvId) await startNewChat();

  isLoading = true;
  messageInput.value = '';
  messageInput.style.height = 'auto';
  sendBtn.disabled = true;

  chatMessages.push({ role: 'user', content: msg });
  addMessage(msg, 'user');

  await fetch(`${API}/api/conversations/${userId}/${currentConvId}/messages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'user', content: msg })
  });

  addTypingIndicator();

  try {
    const res = await fetch(`${API}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, history: chatMessages.slice(0, -1) })
    });
    const data = await res.json();

    document.getElementById('typingIndicator')?.remove();

    const reply = data.error || data.response;
    chatMessages.push({ role: 'assistant', content: reply });
    addMessage(reply, 'bot');

    await fetch(`${API}/api/conversations/${userId}/${currentConvId}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'assistant', content: reply })
    });

    loadConversationList();
  } catch {
    document.getElementById('typingIndicator')?.remove();
    addMessage('Unable to connect to the server.', 'bot');
  }

  isLoading = false;
  sendBtn.disabled = !messageInput.value.trim();
}

// ===== QUIZ =====
async function loadQuizStats() {
  try {
    const res = await fetch(`${API}/api/quiz/stats/${userId}`, { headers: { 'x-quiz-api-key': QUIZ_API_KEY } });
    const data = await res.json();
    const bar = $('quizStatsBar');
    if (!data.totalQuizzes) { bar.innerHTML = ''; return; }
    bar.innerHTML = `
      <div class="quiz-stat-item"><div class="stat-value">${data.totalQuizzes}</div><div class="stat-label">Quizzes Taken</div></div>
      <div class="quiz-stat-item"><div class="stat-value">${data.avgScore}%</div><div class="stat-label">Average Score</div></div>
      <div class="quiz-stat-item"><div class="stat-value">${data.bestScore}%</div><div class="stat-label">Best Score</div></div>`;
  } catch {}
}

document.querySelectorAll('.quiz-start-btn[data-count]').forEach(btn => {
  btn.addEventListener('click', () => startQuiz(parseInt(btn.dataset.count)));
});

async function startQuiz(count) {
  try {
    const res = await fetch(`${API}/api/quiz/questions?count=${count}`, { headers: { 'x-quiz-api-key': QUIZ_API_KEY } });
    const data = await res.json();
    quizQuestions = data.questions;
    quizAnswers = new Array(quizQuestions.length).fill(null);
    quizResults = new Array(quizQuestions.length).fill(null);
    currentQuestion = 0;
    $('quizLanding').classList.add('hidden');
    $('quizActive').classList.remove('hidden');
    $('quizResults').classList.add('hidden');
    quizStartTime = Date.now();
    startTimer();
    renderQuestion();
  } catch { alert('Failed to load questions.'); }
}

function startTimer() {
  clearInterval(quizTimer);
  quizTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - quizStartTime) / 1000);
    $('quizTimer').textContent = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  }, 1000);
}

function renderQuestion() {
  const q = quizQuestions[currentQuestion];
  const total = quizQuestions.length;
  $('quizProgressFill').style.width = `${((currentQuestion + 1) / total) * 100}%`;
  $('quizCategoryBadge').textContent = q.category;
  $('quizCounter').textContent = `Question ${currentQuestion + 1} of ${total}`;
  $('quizQuestionText').textContent = q.question;

  const list = $('quizOptionsList');
  const markers = ['A', 'B', 'C', 'D'];
  const checked = quizResults[currentQuestion];

  list.innerHTML = q.options.map((opt, i) => {
    let cls = '';
    if (checked) {
      if (i === checked.correct && checked.isCorrect) cls = 'correct';
      else if (i === quizAnswers[currentQuestion] && !checked.isCorrect) cls = 'incorrect';
      else if (i === checked.correct && !checked.isCorrect) cls = 'correct';
      cls += ' disabled';
    } else if (quizAnswers[currentQuestion] === i) {
      cls = 'selected';
    }
    return `<div class="quiz-option ${cls}" data-index="${i}"><div class="quiz-option-marker">${markers[i]}</div><span>${opt}</span></div>`;
  }).join('');

  if (!checked) {
    list.querySelectorAll('.quiz-option').forEach(opt => {
      opt.addEventListener('click', () => {
        if (quizResults[currentQuestion]) return;
        quizAnswers[currentQuestion] = parseInt(opt.dataset.index);
        gradeQuestion(currentQuestion);
        renderQuestion();
      });
    });
  }

  const fb = $('quizFeedback');
  if (checked) {
    fb.classList.remove('hidden');
    fb.className = `quiz-feedback ${checked.isCorrect ? 'correct' : 'incorrect'}`;
    fb.innerHTML = checked.isCorrect
      ? `<span class="fb-icon">✓</span> Correct!${checked.explanation ? ' ' + checked.explanation : ''}`
      : `<span class="fb-icon">✗</span> Wrong! Correct answer: <strong>${checked.correctAnswer || '—'}</strong>${checked.explanation ? '. ' + checked.explanation : ''}`;
  } else {
    fb.classList.add('hidden');
    fb.innerHTML = '';
  }

  $('quizPrevBtn').disabled = currentQuestion === 0;
  $('quizSubmitBtn').classList.remove('hidden');
  $('quizSubmitBtn').disabled = false;
  if (currentQuestion === total - 1) {
    $('quizNextBtn').classList.add('hidden');
  } else {
    $('quizNextBtn').classList.remove('hidden');
    $('quizNextBtn').disabled = quizAnswers[currentQuestion] === null;
  }
}

function gradeQuestion(i) {
  if (quizResults[i] !== null) return;
  const q = quizQuestions[i];
  const sel = quizAnswers[i];
  if (sel === null || !q) return;
  const correctIdx = q.correct;
  const isCorrect = correctIdx === sel;
  quizResults[i] = {
    isCorrect,
    correct: correctIdx,
    correctAnswer: (q.correctAnswer || (q.options && q.options[correctIdx])) || '—',
    explanation: q.explanation || '',
    yourAnswer: q.options[sel]
  };
}

$('quizPrevBtn').addEventListener('click', () => {
  if (currentQuestion > 0) { currentQuestion--; renderQuestion(); }
});

$('quizNextBtn').addEventListener('click', () => {
  if (currentQuestion < quizQuestions.length - 1) { currentQuestion++; renderQuestion(); }
});

$('quizSubmitBtn').addEventListener('click', () => {
  if (quizAnswers[currentQuestion] !== null && quizResults[currentQuestion] === null) gradeQuestion(currentQuestion);
  submitQuiz();
});

async function submitQuiz() {
  clearInterval(quizTimer);
  const timeTaken = Math.floor((Date.now() - quizStartTime) / 1000);
  const answers = quizQuestions.map((q, i) => ({ questionId: q.id, selected: quizAnswers[i] }));

  let record;
  try {
    const res = await fetch(`${API}/api/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-quiz-api-key': QUIZ_API_KEY },
      body: JSON.stringify({ userId, answers, timeTaken })
    });
    const data = await res.json();
    if (data && data.record) record = data.record;
  } catch {}

  if (!record) record = buildLocalRecord(answers, timeTaken);

  showResults(record);
}

function buildLocalRecord(answers, timeTaken) {
  let score = 0;
  const results = answers.map((a, i) => {
    const q = quizQuestions[i];
    if (!q) return null;
    const correctIdx = q.correct;
    const isCorrect = correctIdx === a.selected;
    if (isCorrect) score++;
    return { questionId: q.id, question: q.question, category: q.category, selected: a.selected, correct: correctIdx, isCorrect, correctAnswer: (q.correctAnswer || (q.options && q.options[correctIdx])) || '—', explanation: q.explanation || '' };
  }).filter(Boolean);
  return {
    id: `quiz_local_${Date.now()}`,
    score,
    total: results.length,
    percentage: results.length ? Math.round((score / results.length) * 100) : 0,
    timeTaken: timeTaken || 0,
    results,
    date: new Date().toISOString()
  };
}

function showResults(record) {
  if (!record || !record.results) { alert('Could not load quiz results.'); return; }
  $('quizActive').classList.add('hidden');
  $('quizResults').classList.remove('hidden');

  const pct = record.percentage;
  $('resultsPercentage').textContent = pct + '%';
  $('resultsScoreCircle').style.borderColor = pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)';
  $('resultsTitle').textContent = pct >= 90 ? 'Outstanding!' : pct >= 70 ? 'Great Job!' : pct >= 50 ? 'Good Effort!' : 'Keep Learning!';
  $('resultsSummary').textContent = `You answered ${record.score} out of ${record.total} questions correctly.`;

  const mins = Math.floor(record.timeTaken / 60);
  const secs = record.timeTaken % 60;
  $('resultsStats').innerHTML = `
    <div class="results-stat"><div class="rs-value">${record.score}/${record.total}</div><div class="rs-label">Correct</div></div>
    <div class="results-stat"><div class="rs-value">${mins}:${String(secs).padStart(2, '0')}</div><div class="rs-label">Time Taken</div></div>
    <div class="results-stat"><div class="rs-value">${pct}%</div><div class="rs-label">Accuracy</div></div>`;

  $('resultsBreakdown').innerHTML = record.results.map(r => {
    const correctAnswer = r.correctAnswer || (quizQuestions.find(q => q.id === r.questionId)?.options[r.correct]) || '—';
    const yourAnswer = r.selected !== null && r.selected !== undefined
      ? (quizQuestions.find(q => q.id === r.questionId)?.options[r.selected] || r.yourAnswer || '—')
      : 'No answer';
    return `
    <div class="result-item">
      <div class="result-icon ${r.isCorrect ? 'correct' : 'incorrect'}">${r.isCorrect ? '✓' : '✗'}</div>
      <div class="result-details">
        <h4>${r.question}</h4>
        <div class="result-meta">${r.category}</div>
        ${r.isCorrect
          ? `<div class="result-correct-answer">✓ ${correctAnswer}</div>`
          : `<div class="result-your-answer">✗ Your answer: ${yourAnswer}</div>
             <div class="result-correct-answer">✓ Correct: ${correctAnswer}</div>`}
        ${r.explanation ? `<div class="result-explanation">${r.explanation}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

$('retakeQuizBtn').addEventListener('click', () => {
  $('quizLanding').classList.remove('hidden');
  $('quizActive').classList.add('hidden');
  $('quizResults').classList.add('hidden');
  loadQuizStats();
});

$('backToQuizHomeBtn').addEventListener('click', () => {
  $('quizLanding').classList.remove('hidden');
  $('quizActive').classList.add('hidden');
  $('quizResults').classList.add('hidden');
  loadQuizStats();
});

// ===== HISTORY =====
async function loadHistory() {
  try {
    const [histRes, statsRes] = await Promise.all([
      fetch(`${API}/api/quiz/history/${userId}`, { headers: { 'x-quiz-api-key': QUIZ_API_KEY } }),
      fetch(`${API}/api/quiz/stats/${userId}`, { headers: { 'x-quiz-api-key': QUIZ_API_KEY } })
    ]);
    const histData = await histRes.json();
    const statsData = await statsRes.json();

    $('historyStatsRow').innerHTML = `
      <div class="history-stat-card"><div class="hs-value">${statsData.totalQuizzes}</div><div class="hs-label">Total Quizzes</div></div>
      <div class="history-stat-card"><div class="hs-value">${statsData.avgScore}%</div><div class="hs-label">Average Score</div></div>
      <div class="history-stat-card"><div class="hs-value">${statsData.bestScore}%</div><div class="hs-label">Best Score</div></div>`;

    const list = $('historyList');
    if (!histData.history.length) {
      list.innerHTML = '<div class="history-empty"><div class="history-empty-icon">📋</div><p>No quiz history yet.</p></div>';
      return;
    }

    list.innerHTML = histData.history.map(h => {
      const scoreClass = h.percentage >= 70 ? 'high' : h.percentage >= 40 ? 'mid' : 'low';
      const date = new Date(h.date);
      const mins = Math.floor(h.timeTaken / 60);
      const secs = h.timeTaken % 60;
      return `
        <div class="history-item" data-id="${h.id}">
          <div class="history-item-left">
            <div class="history-item-score ${scoreClass}">${h.percentage}%</div>
            <div class="history-item-info">
              <h4>Quiz: ${h.score}/${h.total} Correct</h4>
              <p>Time: ${mins}:${String(secs).padStart(2, '0')}</p>
            </div>
          </div>
          <div class="history-item-right">
            <div class="hi-date">${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            <div class="hi-time">${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <div class="history-item-detail">
            <div class="history-detail-grid">
              ${h.results.map(r => `<div class="history-detail-item ${r.isCorrect ? 'correct' : 'incorrect'}"><span>${r.category}</span><span>${r.isCorrect ? '✓' : '✗'}</span></div>`).join('')}
            </div>
          </div>
        </div>`;
    }).join('');

    list.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => item.classList.toggle('expanded'));
    });
  } catch {}
}

$('clearHistoryBtn').addEventListener('click', async () => {
  if (!confirm('Clear all quiz history?')) return;
  await fetch(`${API}/api/quiz/history/${userId}`, { method: 'DELETE', headers: { 'x-quiz-api-key': QUIZ_API_KEY } });
  loadHistory();
});

// ===== INIT =====
loadConversationList();

// ===== LANDING PAGE OVERLAY =====
const landingOverlay = $('landingOverlay');

function showLanding() {
  landingOverlay.classList.remove('fade-out');
  landingOverlay.style.display = '';
  landingOverlay.scrollTo(0, 0);
}

document.querySelectorAll('.cta-start').forEach(btn => {
  btn.addEventListener('click', () => {
    landingOverlay.classList.add('fade-out');
    setTimeout(() => { landingOverlay.style.display = 'none'; }, 500);
    if (currentConvId) loadConversationList();
  });
});