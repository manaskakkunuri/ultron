(() => {
  'use strict';

  const DB_NAME = 'ultron-device-data';
  const DB_STORE = 'workspace';
  const DB_KEY = 'current';
  const fallbackKey = 'ultron-device-data-v2';
  const plans = { free: { chats: 50, uploads: 10 }, basic: { chats: 200, uploads: 50 }, pro: { chats: Infinity, uploads: Infinity } };
  const labels = {
    en: ['Home', 'Study', 'Focus', 'Tasks', 'Awards', 'Plans', 'Profile'],
    te: ['హోమ్', 'చదువు', 'ఫోకస్', 'పనులు', 'అవార్డులు', 'ప్లాన్లు', 'ప్రొఫైల్'],
    hi: ['होम', 'पढ़ाई', 'फोकस', 'कार्य', 'पुरस्कार', 'योजनाएँ', 'प्रोफ़ाइल'],
    ta: ['முகப்பு', 'படிப்பு', 'கவனம்', 'பணிகள்', 'விருதுகள்', 'திட்டங்கள்', 'சுயவிவரம்'],
    kn: ['ಮುಖಪುಟ', 'ಅಧ್ಯಯನ', 'ಗಮನ', 'ಕಾರ್ಯಗಳು', 'ಪ್ರಶಸ್ತಿಗಳು', 'ಯೋಜನೆಗಳು', 'ಪ್ರೊಫೈಲ್'],
    ml: ['ഹോം', 'പഠനം', 'ശ്രദ്ധ', 'ചുമതലകൾ', 'അവാർഡുകൾ', 'പ്ലാനുകൾ', 'പ്രൊഫൈൽ'],
    mr: ['मुख्यपृष्ठ', 'अभ्यास', 'लक्ष', 'कामे', 'पुरस्कार', 'योजना', 'प्रोफाइल'],
    bn: ['হোম', 'পড়াশোনা', 'মনোযোগ', 'কাজ', 'পুরস্কার', 'প্ল্যান', 'প্রোফাইল']
  };
  const defaultState = () => ({
    profile: { name: '', classGrade: '', section: '', school: '', dob: '', age: '', email: '', phone: '', language: 'en', theme: 'dark' },
    tasks: [], cards: [], quizzes: [], prompts: [], notes: [], sessions: [], labs: [], activity: [], paymentDrafts: [],
    xp: 0, chatsUsed: 0, uploadsUsed: 0, revision: '', chime: true, board: '', serverPlan: 'free', syllabusScans: 0, homeworkSessions: 0
  });
  let state = defaultState();
  let db = null;
  let dbReady = false;
  let activePage = 'home';
  let taskFilter = 'today';
  let studyTab = 'chat';
  let currentCard = 0;
  let cardFlipped = false;
  let quiz = null;
  let quizIndex = 0;
  let selectedMinutes = 25;
  let secondsLeft = 25 * 60;
  let timer = null;
  let timerDeadline = 0;
  let toastTimer = null;
  let deferredInstall = null;
  const AUTH_API_BASE = (document.querySelector('meta[name="ultron-api-base-url"]')?.content || '').trim().replace(/\/$/, '');
  let authToken = null;
  let authUser = null;
  let localDataLoaded = false;
  const otpChallenges = { login: null, register: null };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
      request.onsuccess = () => { db = request.result; resolve(db); };
      request.onerror = () => reject(request.error || new Error('Could not open local storage'));
    });
  }

  function dbGet(key) {
    return new Promise((resolve, reject) => {
      const request = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function dbPut(key, value) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function loadState() {
    try {
      await openDb();
      const saved = await dbGet(DB_KEY);
      if (saved && typeof saved === 'object') state = mergeState(saved);
      dbReady = true;
    } catch {
      try {
        const saved = JSON.parse(localStorage.getItem(fallbackKey) || 'null');
        if (saved) state = mergeState(saved);
      } catch { /* Keep a usable in-memory session if storage is unavailable. */ }
      dbReady = false;
    }
    hydrateProfile();
    applyLanguage();
    applyTheme();
    renderAll();
    localDataLoaded = true;
  }

  function mergeState(saved) {
    const base = defaultState();
    return { ...base, ...saved, serverPlan: 'free', isComplimentary: false, profile: { ...base.profile, ...(saved.profile || {}) }, tasks: Array.isArray(saved.tasks) ? saved.tasks : [], cards: Array.isArray(saved.cards) ? saved.cards : [], quizzes: Array.isArray(saved.quizzes) ? saved.quizzes : [], prompts: Array.isArray(saved.prompts) ? saved.prompts : [], notes: Array.isArray(saved.notes) ? saved.notes : [], sessions: Array.isArray(saved.sessions) ? saved.sessions : [], labs: Array.isArray(saved.labs) ? saved.labs : [], activity: Array.isArray(saved.activity) ? saved.activity : [], paymentDrafts: Array.isArray(saved.paymentDrafts) ? saved.paymentDrafts : [] };
  }

  async function saveState() {
    try {
      const snapshot = typeof structuredClone === 'function' ? structuredClone(state) : JSON.parse(JSON.stringify(state));
      if (dbReady && db) await dbPut(DB_KEY, snapshot);
      else localStorage.setItem(fallbackKey, JSON.stringify(snapshot));
      return true;
    } catch {
      toast('Could not save to this device. Export a backup and free some storage.');
      return false;
    }
  }

  const safe = (text) => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const id = () => (window.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const addDays = (date, count) => { const next = new Date(date); next.setDate(next.getDate() + count); return dayKey(next); };

  function toast(message) {
    const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2900);
  }

  function applyLanguage() {
    const current = labels[state.profile.language] || labels.en;
    $$('.bottom-item small').forEach((node, index) => { node.textContent = current[index]; });
    $('#languageSelect').value = state.profile.language || 'en';
  }
  function applyTheme() { document.body.dataset.theme = state.profile.theme || 'dark'; $('#themeSelect').value = state.profile.theme || 'dark'; }
  function hydrateProfile() {
    const mapping = { fullName: 'name', classGrade: 'classGrade', section: 'section', schoolName: 'school', dateOfBirth: 'dob', age: 'age', emailAddress: 'email', profilePhone: 'phone' };
    for (const [element, key] of Object.entries(mapping)) $(`#${element}`).value = state.profile[key] || '';
    $('#revisionNotes').value = state.revision || '';
  }

  function renderAll() {
    renderHeader(); renderHome(); renderTasks(); renderCards(); renderAwards(); renderFocus(); renderClaims(); renderSavedLabs(); drawSavedBoard(); updateConnection();
  }
  function renderHeader() {
    const name = authUser?.full_name || authUser?.display_name || state.profile.name || 'Student';
    $('#topName').textContent = name.split(' ')[0];
    $('#topAvatar').textContent = name.trim().charAt(0).toUpperCase() || 'S';
    const tier = authUser?.subscription?.plan_tier || authUser?.plan_tier || state.serverPlan;
    $('#topTier').textContent = String(tier).toUpperCase();
    const hour = new Date().getHours();
    $('#homeGreeting').textContent = state.profile.name ? (hour < 12 ? `Good morning, ${name.split(' ')[0]}.` : hour < 18 ? `Good afternoon, ${name.split(' ')[0]}.` : `Good evening, ${name.split(' ')[0]}.`) : 'Ready when you are.';
  }
  function currentStreak() {
    const days = new Set(state.activity);
    let cursor = dayKey();
    if (!days.has(cursor)) cursor = addDays(new Date(), -1);
    let streak = 0;
    while (days.has(cursor)) { streak++; cursor = addDays(new Date(`${cursor}T12:00:00`), -1); }
    return streak;
  }
  function markActivity() {
    const today = dayKey();
    if (!state.activity.includes(today)) state.activity.push(today);
    state.activity = state.activity.slice(-180);
  }
  function quotaText(used, limit) { return limit === Infinity ? `${used} used · Unlimited` : `${used} / ${limit} this month`; }
  function renderHome() {
    const tier = String(authUser?.subscription?.plan_tier || authUser?.plan_tier || state.serverPlan).toLowerCase();
    const plan = plans[tier] || plans.free;
    const chatsUsed = Number(authUser?.usage?.chats_used ?? state.chatsUsed);
    const uploadsUsed = Number(authUser?.usage?.images_used ?? state.uploadsUsed);
    $('#homePlan').textContent = `${tier.charAt(0).toUpperCase()}${tier.slice(1)} plan${authUser?.subscription?.is_complimentary ? ' · lifetime' : ''}`;
    $('#homeTierBadge').textContent = tier.toUpperCase();
    $('#chatQuotaText').textContent = quotaText(chatsUsed, plan.chats);
    $('#imageQuotaText').textContent = quotaText(uploadsUsed, plan.uploads);
    $('#chatQuotaBar').style.width = plan.chats === Infinity ? '12%' : `${Math.min(100, chatsUsed / plan.chats * 100)}%`;
    $('#imageQuotaBar').style.width = plan.uploads === Infinity ? '12%' : `${Math.min(100, uploadsUsed / plan.uploads * 100)}%`;
    const level = Math.floor(state.xp / 100) + 1, within = state.xp % 100;
    $('#levelName').textContent = `Level ${level} Scholar`;
    $('#xpValue').textContent = String(state.xp);
    $('#xpBar').style.width = `${within}%`;
    $('#xpNext').textContent = `${within} / 100 XP to Level ${level + 1}`;
    $('#streakValue').textContent = String(currentStreak());
    renderTaskList($('#todayTasks'), 'today', true);
  }

  function awardXp(amount, activity = true) {
    state.xp += amount;
    if (activity) markActivity();
    saveState(); renderHeader(); renderHome(); renderAwards();
  }
  function taskMarkup(task) {
    const deadline = task.deadline ? new Date(`${task.deadline}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
    return `<div class="task-row ${task.done ? 'done' : ''}"><input class="task-check" type="checkbox" data-task-toggle="${safe(task.id)}" ${task.done ? 'checked' : ''} aria-label="Complete ${safe(task.title)}"><div class="task-info"><div class="task-title">${safe(task.title)}</div><div class="task-meta">${task.subject ? `<span>${safe(task.subject)}</span>` : ''}${deadline ? `<span class="task-date">Due ${safe(deadline)}</span>` : ''}<span class="priority ${safe(task.priority)}">${safe(task.priority)}</span>${task.done ? '<span class="task-xp">+10 XP earned</span>' : '<span class="task-xp">+10 XP</span>'}</div></div><button class="task-delete" data-task-delete="${safe(task.id)}" aria-label="Delete task">×</button></div>`;
  }
  function belongsToFilter(task, filter) {
    if (filter === 'completed') return task.done;
    if (task.done) return false;
    const today = dayKey();
    if (filter === 'today') return task.category === 'today' || task.deadline === today;
    if (filter === 'tomorrow') return task.category === 'tomorrow' || task.deadline === addDays(new Date(), 1);
    return task.category === 'upcoming' || (task.deadline && task.deadline > addDays(new Date(), 1));
  }
  function renderTaskList(container, filter, compact = false) {
    const list = state.tasks.filter(task => belongsToFilter(task, filter)).sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]) || (a.deadline || '').localeCompare(b.deadline || ''));
    const shown = compact ? list.slice(0, 4) : list;
    container.innerHTML = shown.length ? shown.map(taskMarkup).join('') : `<div class="empty-state">${filter === 'completed' ? 'Completed tasks will collect here.' : 'Nothing on this list yet. Add one small step.'}</div>`;
    if (compact && list.length > 4) container.insertAdjacentHTML('beforeend', `<button class="inline-link" data-page="tasks">+ ${list.length - 4} more tasks</button>`);
  }
  function renderTasks() { renderTaskList($('#taskBoard'), taskFilter); $$('.task-filters button').forEach(button => button.classList.toggle('selected', button.dataset.taskFilter === taskFilter)); }
  async function addTask(event) {
    event.preventDefault();
    const task = { id: id(), title: $('#taskTitle').value.trim(), subject: $('#taskSubject').value.trim(), deadline: $('#taskDue').value, category: $('#taskCategory').value, priority: $('#taskPriority').value, done: false, createdAt: new Date().toISOString() };
    if (!task.title) return;
    state.tasks.unshift(task); markActivity(); await saveState(); $('#taskForm').reset(); $('#taskDialog').close(); renderAll(); toast('Task added.');
  }
  async function toggleTask(taskId, checked) {
    const task = state.tasks.find(item => item.id === taskId); if (!task || task.done === checked) return;
    task.done = checked;
    if (checked) state.xp += 10;
    if (checked) markActivity();
    await saveState(); renderAll(); if (checked) toast('+10 XP · Task complete');
  }
  async function deleteTask(taskId) { state.tasks = state.tasks.filter(item => item.id !== taskId); await saveState(); renderAll(); }

  function renderCards() {
    const cards = state.cards;
    $('#deckCount').textContent = String(cards.length);
    $('#deckKnown').textContent = String(cards.filter(card => card.known).length);
    $('#deckLearning').textContent = String(cards.filter(card => !card.known).length);
    $('#cardCounter').textContent = cards.length ? `${Math.min(currentCard + 1, cards.length)} of ${cards.length}` : '0 cards';
    $('#flashcardStage').innerHTML = cards.length ? `<div class="flashcard ${cardFlipped ? 'answer' : ''}"><small>${cardFlipped ? 'ANSWER' : 'QUESTION'} · TAP TO FLIP</small><strong>${safe(cardFlipped ? cards[currentCard % cards.length].answer : cards[currentCard % cards.length].question)}</strong></div>` : '<div class="empty-state">Create your first flashcard. Your deck stays offline on this device.</div>';
    $('#quizAvailability').textContent = cards.length >= 2 ? `${cards.length} cards ready · quiz results stay here.` : 'Add at least two flashcards with answers to begin.';
  }
  async function saveCard(event) {
    event.preventDefault();
    state.cards.push({ id: id(), question: $('#cardQuestion').value.trim(), answer: $('#cardAnswer').value.trim(), known: false, createdAt: new Date().toISOString() });
    await saveState(); $('#cardForm').reset(); $('#cardDialog').close(); renderCards(); toast('Flashcard saved.');
  }
  function changeCard(delta) { if (!state.cards.length) return; currentCard = (currentCard + delta + state.cards.length) % state.cards.length; cardFlipped = false; renderCards(); }
  async function rateCard(known) {
    const card = state.cards[currentCard % state.cards.length]; if (!card) return;
    if (known && !card.known) { card.known = true; state.cardsMastered = (state.cardsMastered || 0) + 1; state.xp += 1; }
    if (!known) card.known = false;
    markActivity(); await saveState(); changeCard(1); renderAll();
  }
  function startQuiz() {
    if (state.cards.length < 2) { toast('Add at least two flashcards first.'); return; }
    const pool = [...state.cards].sort(() => Math.random() - .5).slice(0, 5);
    quiz = pool.map(card => {
      const wrong = state.cards.filter(other => other.id !== card.id).map(other => other.answer).sort(() => Math.random() - .5).slice(0, 3);
      const options = [card.answer, ...wrong].sort(() => Math.random() - .5);
      return { question: card.question, answer: card.answer, options, selected: null };
    });
    quizIndex = 0; renderQuiz();
  }
  function renderQuiz() {
    $('#quizStart').classList.toggle('hidden', !!quiz);
    const stage = $('#quizStage'); stage.classList.toggle('hidden', !quiz); if (!quiz) return;
    if (quizIndex >= quiz.length) {
      const score = quiz.filter(item => item.selected === item.answer).length;
      state.quizzes.push({ score, total: quiz.length, date: dayKey() }); state.xp += 25; markActivity();
      if (score === quiz.length) state.perfectQuiz = (state.perfectQuiz || 0) + 1;
      saveState(); renderAwards();
      stage.innerHTML = `<div class="quiz-question"><span class="eyebrow">QUIZ COMPLETE</span><h3>${score} / ${quiz.length} correct</h3><p class="muted-copy">+25 XP · ${score === quiz.length ? 'Perfect score!' : 'A little practice goes a long way.'}</p><button class="button button-primary" id="quizAgain">Try another</button></div>`;
      $('#quizAgain').addEventListener('click', startQuiz); quiz = null; return;
    }
    const item = quiz[quizIndex];
    stage.innerHTML = `<div class="quiz-question"><span class="eyebrow">QUESTION ${quizIndex + 1} OF ${quiz.length}</span><h3>${safe(item.question)}</h3>${item.options.map(option => `<button class="quiz-option ${item.selected === option ? (option === item.answer ? 'correct' : 'incorrect') : ''}" data-quiz-answer="${safe(option)}">${safe(option)}</button>`).join('')}<button class="button button-primary" id="quizContinue" ${item.selected === null ? 'disabled' : ''}>${quizIndex + 1 === quiz.length ? 'See score' : 'Next question →'}</button></div>`;
    $$('.quiz-option', stage).forEach(button => button.addEventListener('click', () => { if (item.selected !== null) return; item.selected = button.dataset.quizAnswer; renderQuiz(); }));
    $('#quizContinue').addEventListener('click', () => { if (item.selected !== null) { quizIndex++; renderQuiz(); } });
  }

  function renderFocus() {
    $('#timerDisplay').textContent = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;
    $('#timerToggle').textContent = timer ? 'Pause session' : (secondsLeft < selectedMinutes * 60 ? 'Resume session' : 'Start focus');
    $('#focusMinutes').textContent = String(state.sessions.reduce((sum, session) => sum + session.minutes, 0));
    $('#focusSessions').textContent = String(state.sessions.length);
    $('#chimeToggle').textContent = `Completion chime: ${state.chime ? 'On' : 'Off'}`;
    $$('.duration-picker button').forEach(button => button.classList.toggle('selected', Number(button.dataset.minutes) === selectedMinutes));
  }
  function playChime() {
    if (!state.chime || !window.AudioContext) return;
    try {
      const ctx = new AudioContext(); const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = 660; gain.gain.setValueAtTime(.0001, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.14, ctx.currentTime + .04); gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .8); oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + .85); oscillator.onended = () => ctx.close();
    } catch { /* A quiet finish is fine when the browser blocks audio. */ }
  }
  async function finishFocus() {
    clearInterval(timer); timer = null; secondsLeft = selectedMinutes * 60;
    state.sessions.push({ id: id(), minutes: selectedMinutes, date: dayKey(), completedAt: new Date().toISOString() });
    state.xp += 20; markActivity(); await saveState(); playChime(); renderAll(); toast(`Focus session complete · +20 XP`);
  }
  function timerTick() {
    secondsLeft = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000)); renderFocus();
    if (secondsLeft <= 0) finishFocus();
  }
  function toggleTimer() {
    if (timer) { clearInterval(timer); timer = null; renderFocus(); return; }
    timerDeadline = Date.now() + secondsLeft * 1000; timer = setInterval(timerTick, 250); timerTick();
  }
  function setDuration(minutes) { if (timer) { clearInterval(timer); timer = null; } selectedMinutes = minutes; secondsLeft = minutes * 60; renderFocus(); }

  function calcBadges() {
    const tasksDone = state.tasks.filter(task => task.done).length;
    const quizCount = state.quizzes.length;
    const best = state.quizzes.some(item => item.score === item.total && item.total > 0);
    const known = Number(state.cardsMastered || 0);
    const streak = currentStreak();
    return [
      ['🌱', 'First Step', 'Complete your first study task', tasksDone >= 1],
      ['✦', 'Quiz Starter', 'Finish your first quiz', quizCount >= 1],
      ['🏅', 'Perfect Score', 'Score 100% on a quiz', best],
      ['📚', 'Bookworm', 'Complete 10 focus sessions', state.sessions.length >= 10],
      ['⏱', 'Focus Master', 'Complete 10 focus sessions', state.sessions.length >= 10],
      ['🗂', 'Flashcard Pro', 'Master 100 flashcards', known >= 100],
      ['✓', 'Task Crusher', 'Complete 25 tasks', tasksDone >= 25],
      ['🔥', '7-Day Streak', 'Keep a 7-day study streak', streak >= 7],
      ['🌟', '30-Day Streak', 'Keep a 30-day study streak', streak >= 30],
      ['🧭', 'Syllabus Explorer', 'Save a concept map', state.syllabusScans >= 1],
      ['💡', 'Homework Hero', 'Complete 10 homework sessions', state.homeworkSessions >= 10]
    ];
  }
  function renderAwards() {
    const level = Math.floor(state.xp / 100) + 1, within = state.xp % 100;
    $('#awardLevel').textContent = `LEVEL ${level}`; $('#awardXp').textContent = String(state.xp); $('#awardBar').style.width = `${within}%`; $('#awardNext').textContent = `${100 - within} XP to Level ${level + 1} Scholar`; $('#awardStreak').textContent = String(currentStreak());
    const now = new Date(); const monthStart = new Date(now.getFullYear(), now.getMonth(), 1); const firstDay = monthStart.getDay(); const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    $('#calendarMonth').textContent = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    $('#streakCalendar').innerHTML = ['S','M','T','W','T','F','S'].map(letter => `<div class="calendar-label">${letter}</div>`).join('') + Array.from({ length: firstDay }, () => '<div></div>').join('') + Array.from({ length: days }, (_, idx) => { const date = new Date(now.getFullYear(), now.getMonth(), idx + 1); const key = dayKey(date); const active = state.activity.includes(key); return `<div class="day-cell ${active ? 'active' : ''} ${key === dayKey() ? 'today' : ''}">${idx + 1}</div>`; }).join('');
    $('#badgeGrid').innerHTML = calcBadges().map(([icon, name, description, earned]) => `<div class="badge-card ${earned ? 'earned' : ''}"><span>${icon}</span><strong>${name}</strong><small>${description}</small></div>`).join('');
  }

  function renderClaims() {
    const current = state.paymentDrafts.at(-1);
    $('#paymentMessage').textContent = current ? `Draft ${current.requestId} · ${current.plan.toUpperCase()} · LOCAL ONLY · not synced or activated.` : 'Local draft only. It will not be reviewed or activated until API sync is enabled.';
    const amount = $('#paymentPlan').value === 'pro' ? '₹299 intro · ₹399/month after renewal' : '₹99 intro · ₹199/month after renewal';
    $('#payableAmount').textContent = `Payable: ${amount}`;
  }
  async function savePaymentClaim(event) {
    event.preventDefault();
    const utr = $('#utrInput').value.trim();
    if (!/^\d{12}$/.test(utr)) { toast('Enter an exact 12-digit UTR.'); return; }
    const plan = $('#paymentPlan').value;
    const amount = plan === 'pro' ? 299 : 99;
    state.paymentDrafts.push({ requestId: `LOCAL-${Date.now()}`, plan, amount, utr, status: 'LOCAL_DRAFT', submittedAt: new Date().toISOString() });
    await saveState(); $('#utrInput').value = ''; renderClaims(); toast('Saved as a local draft. No plan was activated.');
  }

  function renderSavedLabs() {
    $('#labSaved').innerHTML = state.labs.length ? state.labs.slice(-4).reverse().map(lab => `<div>✧ ${safe(lab.start)} → ${safe(lab.middle)} → ${safe(lab.end)}</div>`).join('') : '';
  }
  function drawSavedBoard() {
    const canvas = $('#whiteboard'); const ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1; const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio); ctx.scale(ratio, ratio); ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, rect.width, rect.height);
    if (!state.board) return;
    const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height); img.src = state.board;
  }
  function initBoard() {
    const canvas = $('#whiteboard'); const ctx = canvas.getContext('2d'); let drawing = false;
    const point = event => { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
    canvas.addEventListener('pointerdown', event => { drawing = true; canvas.setPointerCapture(event.pointerId); const p = point(event); ctx.beginPath(); ctx.moveTo(p.x, p.y); });
    canvas.addEventListener('pointermove', event => { if (!drawing) return; const p = point(event); ctx.strokeStyle = '#0f4771'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineTo(p.x, p.y); ctx.stroke(); });
    canvas.addEventListener('pointerup', () => { drawing = false; }); canvas.addEventListener('pointercancel', () => { drawing = false; });
    $('#clearBoard').addEventListener('click', () => { state.board = ''; drawSavedBoard(); });
    $('#saveBoard').addEventListener('click', async () => { state.board = canvas.toDataURL('image/webp', .75); await saveState(); toast('Whiteboard saved on this device.'); });
  }

  function setPage(page) {
    if (!$(`#view-${page}`)) return;
    activePage = page;
    $$('.view').forEach(view => view.classList.toggle('active', view.id === `view-${page}`));
    $$('.bottom-item').forEach(item => item.classList.toggle('active', item.dataset.page === page));
    document.body.classList.toggle('study-view', page === 'study');
    $('#appMain').scrollTo({ top: 0, behavior: 'smooth' }); window.scrollTo({ top: 0, behavior: 'smooth' });
    if (page === 'study' && studyTab === 'board') setTimeout(drawSavedBoard, 30);
    if (page === 'profile') hydrateProfile();
  }
  function setStudyTab(tab) {
    studyTab = tab;
    $$('.study-tab').forEach(button => button.classList.toggle('active', button.dataset.studyTab === tab));
    $$('.study-panel').forEach(panel => panel.classList.toggle('active', panel.id === `study-${tab}`));
    if (tab === 'board') setTimeout(drawSavedBoard, 30);
  }
  function updateConnection() {
    const online = navigator.onLine;
    $('#offlineBanner').classList.toggle('show', !online);
    $('#connectionLabel').textContent = online ? 'On this device' : 'Offline';
  }

  function showAuthView(view) {
    const registering = view === 'register';
    $('#gateLoginForm').classList.toggle('hidden', registering);
    $('#gateRegisterForm').classList.toggle('hidden', !registering);
    $('#showLogin').classList.toggle('selected', !registering);
    $('#showRegister').classList.toggle('selected', registering);
    $('#gateTitle').textContent = registering ? 'Create your account' : 'Sign in to continue';
    $('#gateStatus').textContent = AUTH_API_BASE
      ? 'Your account service is ready. Verify the phone number to continue.'
      : 'Sign-in service is not configured. No OTP has been sent, and the app remains locked.';
  }
  function normalizedPhone(input) { return input.trim().replace(/[\s()-]/g, ''); }
  async function authRequest(path, payload) {
    if (!AUTH_API_BASE) throw new Error('No sign-in API URL is configured. No request was sent.');
    const url = new URL(AUTH_API_BASE);
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Sign-in requires HTTPS. No request was sent.');
    const response = await fetch(`${AUTH_API_BASE}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.detail || result.message || 'Sign-in service could not complete the request.');
    return result;
  }
  async function requestOtp(flow) {
    const phoneInput = flow === 'register' ? $('#regPhone') : $('#gateLoginPhone');
    const phone = normalizedPhone(phoneInput.value);
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) { $('#gateStatus').textContent = 'Enter a valid phone number with country code, such as +91 98765 43210. No SMS was sent.'; return; }
    const button = flow === 'register' ? $('#sendRegisterOtp') : $('#sendLoginOtp');
    button.disabled = true; $('#gateStatus').textContent = 'Requesting a one-time code…';
    try {
      const result = await authRequest('/auth/phone/start', { phone_number: phone, purpose: flow });
      otpChallenges[flow] = { phone, challengeId: result.challenge_id || null };
      $('#gateStatus').textContent = result.message || 'If this number can receive a code, an SMS has been requested.';
    } catch (error) { $('#gateStatus').textContent = `${error.message} No verification was completed.`; }
    finally { button.disabled = false; }
  }
  async function unlockAfterServerAuth(result) {
    if (!result?.access_token || !result?.user) throw new Error('The API did not return a verified session. The app remains locked.');
    authToken = result.access_token;
    authUser = result.user;
    $('#gateLoginPassword').value = ''; $('#gateLoginOtp').value = ''; $('#regPassword').value = ''; $('#regOtp').value = '';
    otpChallenges.login = null; otpChallenges.register = null;
    $('#authGate').classList.add('hidden');
    $('#protectedApp').classList.remove('hidden');
    if (!localDataLoaded) await loadState();
    renderHeader(); renderHome();
    $('#authForm')?.classList.add('hidden');
    if ($('#authStatus')) $('#authStatus').textContent = `Signed in as ${authUser.full_name || authUser.display_name || authUser.email || authUser.phone_number || 'verified account'}.`;
    $('#profileSignOut')?.classList.remove('hidden');
  }
  async function signIn(event) {
    event.preventDefault();
    const phone = normalizedPhone($('#gateLoginPhone').value);
    const challenge = otpChallenges.login;
    if (!challenge || challenge.phone !== phone) { $('#gateStatus').textContent = 'Request a one-time code for this phone number first. No sign-in was attempted.'; return; }
    const code = $('#gateLoginOtp').value.trim();
    const password = $('#gateLoginPassword').value;
    if (!/^\d{4,8}$/.test(code) || !password) { $('#gateStatus').textContent = 'Enter your SMS code and password.'; return; }
    $('#gateStatus').textContent = 'Verifying your code…';
    try {
      const result = await authRequest('/auth/phone/verify', { phone_number: phone, code, password, challenge_id: challenge.challengeId, purpose: 'login' });
      await unlockAfterServerAuth(result);
    } catch (error) { $('#gateStatus').textContent = error.message; }
  }
  async function register(event) {
    event.preventDefault();
    const phone = normalizedPhone($('#regPhone').value);
    const challenge = otpChallenges.register;
    if (!challenge || challenge.phone !== phone) { $('#gateStatus').textContent = 'Request a one-time code for the registration phone number first.'; return; }
    const code = $('#regOtp').value.trim();
    const password = $('#regPassword').value;
    if (!/^\d{4,8}$/.test(code) || password.length < 12) { $('#gateStatus').textContent = 'Enter the SMS code and a password with at least 12 characters.'; return; }
    const payload = {
      full_name: $('#regName').value.trim(), class_grade: $('#regClass').value.trim(), section: $('#regSection').value.trim(),
      school_name: $('#regSchool').value.trim(), date_of_birth: $('#regDob').value, age: Number($('#regAge').value),
      email: $('#regEmail').value.trim().toLowerCase(), phone_number: phone, code, challenge_id: challenge.challengeId, password
    };
    if (Object.values(payload).some(value => value === '' || value === null || value === undefined)) { $('#gateStatus').textContent = 'Complete every required registration field.'; return; }
    $('#gateStatus').textContent = 'Creating and verifying your account…';
    try {
      const result = await authRequest('/auth/register', payload);
      await unlockAfterServerAuth(result);
    } catch (error) { $('#gateStatus').textContent = error.message; }
  }
  async function signOut() {
    try { if (AUTH_API_BASE && authToken) await fetch(`${AUTH_API_BASE}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, credentials: 'include' }); } catch { /* Local lock still clears the in-memory session. */ }
    authToken = null; authUser = null; otpChallenges.login = null; otpChallenges.register = null;
    if (db) db.close(); db = null; dbReady = false; localDataLoaded = false; state = defaultState();
    $('#protectedApp').classList.add('hidden'); $('#authGate').classList.remove('hidden');
    $('#gateLoginForm').reset(); $('#gateRegisterForm').reset(); $('#gateLoginOtp').value = ''; $('#regOtp').value = '';
    $('#profileSignOut')?.classList.add('hidden'); $('#authForm')?.classList.remove('hidden');
    $('#gateStatus').textContent = 'Signed out. Verify your phone to open ULTRON.';
    showAuthView('login'); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function saveStudyPrompt(event) {
    event.preventDefault();
    const prompt = $('#chatInput').value.trim(); if (!prompt) return;
    state.prompts.push({ id: id(), prompt, mode: $('#chatMode').value, createdAt: new Date().toISOString() });
    saveState();
    $('#chatFeed').insertAdjacentHTML('beforeend', `<div class="chat-message">${safe(prompt)}<small>Saved offline · waiting for API</small></div>`);
    $('#chatInput').value = ''; toast('Prompt saved locally. No Gemini API call was made.');
  }
  function selectPhoto(file) {
    if (!file) return;
    const url = URL.createObjectURL(file); $('#homeworkPreview').innerHTML = `<img src="${url}" alt="Selected homework image preview"><span>${safe(file.name)} · stays on this device</span>`;
    $('#analyzeHomework').textContent = 'OCR unavailable until API is connected'; $('#analyzeHomework').disabled = true;
  }

  function copyUpi() {
    navigator.clipboard?.writeText('shreetulasi@oksbi').then(() => toast('UPI ID copied.')).catch(() => toast('Copy unavailable. Select the UPI ID to copy.'));
  }
  function exportBackup() {
    const blob = new Blob([JSON.stringify({ app: 'ULTRON', version: 2, exportedAt: new Date().toISOString(), state }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `ultron-device-backup-${dayKey()}.json`; link.click(); URL.revokeObjectURL(url);
  }
  async function importBackup(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()); const incoming = parsed?.state || parsed?.data;
      if (parsed?.app !== 'ULTRON' || !incoming || !Array.isArray(incoming.tasks)) throw new Error('That file is not an ULTRON backup.');
      if (!confirm('Restore this backup? It replaces local tasks, notes, cards and preferences.')) return;
      state = mergeState(incoming); await saveState(); hydrateProfile(); applyTheme(); applyLanguage(); renderAll(); toast('Backup restored on this device.');
    } catch (error) { toast(error.message || 'Could not restore backup.'); }
    finally { $('#importFile').value = ''; }
  }

  async function saveProfile() {
    const profile = { name: $('#fullName').value.trim(), classGrade: $('#classGrade').value.trim(), section: $('#section').value.trim(), school: $('#schoolName').value.trim(), dob: $('#dateOfBirth').value, age: $('#age').value, email: $('#emailAddress').value.trim().toLowerCase(), phone: $('#profilePhone').value.trim(), language: $('#languageSelect').value, theme: $('#themeSelect').value };
    state.profile = profile; applyLanguage(); applyTheme(); await saveState(); renderHeader(); toast('Profile saved on this device.');
  }
  function noApiNotice(action) { toast(`${action} is ready in the app, but no API is connected. No request was sent.`); }

  document.addEventListener('click', event => {
    const nav = event.target.closest('[data-page]'); if (nav) { setPage(nav.dataset.page); return; }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'add-task') $('#taskDialog').showModal();
    if (action === 'new-card') $('#cardDialog').showModal();
    const tab = event.target.closest('[data-study-tab]'); if (tab) setStudyTab(tab.dataset.studyTab);
    const filter = event.target.closest('[data-task-filter]'); if (filter) { taskFilter = filter.dataset.taskFilter; renderTasks(); }
    const taskToggle = event.target.closest('[data-task-toggle]'); if (taskToggle) toggleTask(taskToggle.dataset.taskToggle, taskToggle.checked);
    const taskDelete = event.target.closest('[data-task-delete]'); if (taskDelete) deleteTask(taskDelete.dataset.taskDelete);
    const duration = event.target.closest('[data-minutes]'); if (duration) setDuration(Number(duration.dataset.minutes));
    const close = event.target.closest('[data-close]'); if (close) $(`#${close.dataset.close}`).close();
    const plan = event.target.closest('[data-select-plan]'); if (plan) { $('#paymentPlan').value = plan.dataset.selectPlan; renderClaims(); $('#paymentForm').scrollIntoView({ behavior: 'smooth', block: 'center' }); toast(`${plan.dataset.selectPlan.toUpperCase()} selected. Your active plan has not changed.`); }
    const quizAnswer = event.target.closest('[data-quiz-answer]'); if (quizAnswer && quiz) { const item = quiz[quizIndex]; if (item.selected !== null) return; item.selected = quizAnswer.dataset.quizAnswer; renderQuiz(); }
    if (event.target.closest('#openAdmin')) noApiNotice('Admin access');
  });
  document.addEventListener('change', event => {
    if (event.target.id === 'homeworkImage') selectPhoto(event.target.files?.[0]);
    if (event.target.id === 'paymentPlan') renderClaims();
    if (event.target.id === 'languageSelect') { state.profile.language = event.target.value; applyLanguage(); saveState(); }
    if (event.target.id === 'themeSelect') { state.profile.theme = event.target.value; applyTheme(); saveState(); }
  });
  $('#taskForm').addEventListener('submit', addTask);
  $('#cardForm').addEventListener('submit', saveCard);
  $('#chatForm').addEventListener('submit', saveStudyPrompt);
  $('#paymentForm').addEventListener('submit', savePaymentClaim);
  $('#timerToggle').addEventListener('click', toggleTimer);
  $('#timerReset').addEventListener('click', () => { if (timer) clearInterval(timer); timer = null; secondsLeft = selectedMinutes * 60; renderFocus(); });
  $('#cardPrev').addEventListener('click', () => changeCard(-1));
  $('#cardNext').addEventListener('click', () => changeCard(1));
  $('#flashcardStage').addEventListener('click', () => { if (state.cards.length) { cardFlipped = !cardFlipped; renderCards(); } });
  $('#cardKnown').addEventListener('click', () => rateCard(true));
  $('#cardUnknown').addEventListener('click', () => rateCard(false));
  $('#startQuiz').addEventListener('click', startQuiz);
  $('#saveLab').addEventListener('click', async () => {
    const lab = { start: $('#labStart').value.trim() || 'Concept', middle: $('#labMiddle').value.trim() || 'Key idea', end: $('#labEnd').value.trim() || 'Example', createdAt: new Date().toISOString() };
    state.labs.push(lab); state.syllabusScans++; await saveState(); renderSavedLabs(); renderAwards(); toast('Concept map saved locally.');
  });
  $('#saveRevision').addEventListener('click', async () => { state.revision = $('#revisionNotes').value; await saveState(); toast('Revision note saved.'); });
  $('#chimeToggle').addEventListener('click', async () => { state.chime = !state.chime; await saveState(); renderFocus(); });
  $('#saveProfile').addEventListener('click', saveProfile);
  $('#parentLink').addEventListener('click', () => { $('#parentLinkStatus').textContent = 'Parent account linking requires the secure ULTRON API. No link was created.'; });
  $('#showLogin').addEventListener('click', () => showAuthView('login'));
  $('#showRegister').addEventListener('click', () => showAuthView('register'));
  $('#sendLoginOtp').addEventListener('click', () => requestOtp('login'));
  $('#sendRegisterOtp').addEventListener('click', () => requestOtp('register'));
  $('#gateLoginForm').addEventListener('submit', signIn);
  $('#gateRegisterForm').addEventListener('submit', register);
  $('#profileSignOut')?.addEventListener('click', signOut);
  $('#exportData').addEventListener('click', exportBackup);
  $('#importFile').addEventListener('change', event => importBackup(event.target.files?.[0]));
  window.addEventListener('online', updateConnection); window.addEventListener('offline', updateConnection);
  window.addEventListener('scroll', () => { $('#topbar').classList.toggle('study-collapsed', activePage === 'study' && window.scrollY > 50); }, { passive: true });
  window.addEventListener('resize', () => { if (studyTab === 'board' && activePage === 'study') drawSavedBoard(); });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstall = event; $('#installApp')?.classList.remove('hidden'); });
  $('#installApp')?.addEventListener('click', async () => { if (!deferredInstall) { toast('Use your browser menu and choose Install app / Add to Home Screen.'); return; } deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; });
  $('#copyUpi').addEventListener('click', copyUpi);
  $('#paymentPlan').addEventListener('change', renderClaims);
  initBoard(); renderClaims(); updateConnection();
  $('#protectedApp').classList.add('hidden'); $('#authGate').classList.remove('hidden'); showAuthView('login');

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
