/* PopMastery frontend — rebuilt with safe DOM startup and Supabase tracking. */
(function () {
  const $ = (id) => document.getElementById(id);
  const modal = $('modal'), gameArea = $('gameArea'), modalTitle = $('modalTitle'), modalText = $('modalText');
  const authModal = $('authModal'), authForm = $('authForm');
  let authMode = 'signup';

  const show = (el, open) => {
    if (!el) return;
    el.classList.toggle('open', open);
    el.setAttribute('aria-hidden', open ? 'false' : 'true');
  };

  function openModal() { show(modal, true); }
  function closeModal() { show(modal, false); if (gameArea) gameArea.innerHTML = ''; }
  function openAuth() { renderAuth(); show(authModal, true); $('authEmail')?.focus(); }
  function closeAuth() { show(authModal, false); }
  function openProfile() { loadProfile().then(() => show($('profileDrawer'), true)); }
  function closeProfile() { show($('profileDrawer'), false); }

  function renderAuth() {
    const signin = authMode === 'signin';
    if ($('authName')) $('authName').style.display = signin ? 'none' : 'block';
    if ($('authTitle')) $('authTitle').textContent = signin ? 'Welcome back' : 'Save your progress';
    if ($('authText')) $('authText').textContent = signin ? 'Sign in to continue your progress.' : 'Create a free account to keep every result and build your personal learning profile.';
    if ($('authSubmit')) $('authSubmit').textContent = signin ? 'Sign in' : 'Create account';
    if ($('switchAuth')) $('switchAuth').textContent = signin ? 'New here? Create a free account' : 'Already have an account? Sign in';
    if ($('authMessage')) $('authMessage').textContent = '';
  }

  async function handleAuth(e) {
    e.preventDefault();
    if (!window.popSupabase) { $('authMessage').textContent = 'Supabase is not configured.'; return; }
    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;
    const name = $('authName')?.value.trim() || '';
    $('authMessage').textContent = 'Working…';
    try {
      const response = authMode === 'signin'
        ? await window.popSignIn(email, password)
        : await window.popSignUp(name, email, password);
      if (response?.error) throw response.error;
      if (authMode === 'signup' && !response?.data?.session) {
        $('authMessage').textContent = 'Account created. Check your email to confirm, then sign in.';
      } else {
        $('authMessage').textContent = 'Signed in successfully!';
        setTimeout(closeAuth, 400);
      }
    } catch (err) {
      $('authMessage').textContent = err?.message || 'Authentication failed.';
    }
  }

  function updateAuthUI() {
    const button = $('authBtn');
    if (!button) return;
    if (window.popUser) {
      const name = window.popUser.user_metadata?.display_name || window.popUser.user_metadata?.full_name || window.popUser.user_metadata?.name || window.popUser.email?.split('@')[0] || 'Profile';
      button.textContent = name;
    } else button.textContent = 'Sign in';
  }

  async function logActivity(eventType, game = null, payload = {}) {
    if (window.popSaveActivity) await window.popSaveActivity(eventType, game, payload);
  }

  async function saveResult(game, result) {
    if (window.popSaveResult && window.popUser) {
      await window.popSaveResult(game, result);
      loadProfile();
    }
  }

  function launch(type) {
    if (!modal || !gameArea) return;
    openModal();
    logActivity('game_started', type, {});
    ({ typing, memory, math, focus }[type] || typing)();
  }

  function typing() {
    modalTitle.textContent = 'Typing Rush';
    modalText.textContent = 'Type the sentence as quickly and accurately as you can.';
    const target = 'Small steps every day create big skills.';
    const start = performance.now();
    gameArea.innerHTML = `<div class="type-text">${target}</div><input class="type-input" id="typeInput" autocomplete="off" placeholder="Start typing here…"><div class="type-result" id="typeResult">0 characters typed</div>`;
    const input = $('typeInput'), result = $('typeResult');
    input.focus();
    let saved = false;
    input.oninput = () => {
      const value = input.value;
      let correct = 0;
      for (let i = 0; i < Math.min(value.length, target.length); i++) if (value[i] === target[i]) correct++;
      const seconds = Math.max(0.1, (performance.now() - start) / 1000);
      const minutes = seconds / 60;
      const wpm = Math.round((correct / 5) / minutes);
      const accuracy = value.length ? Math.round(correct / value.length * 100) : 0;
      result.textContent = `${correct}/${target.length} correct • ${wpm} WPM • ${accuracy}% accuracy`;
      if (value === target && !saved) {
        saved = true;
        saveResult('typing', { score: wpm, accuracy, wpm, duration_seconds: Math.round(seconds), metadata: { text_length: target.length } });
        result.textContent = `Complete! ${wpm} WPM • ${accuracy}% accuracy 🎉`;
      }
    };
  }

  function memory() {
    modalTitle.textContent = 'Memory Flip';
    modalText.textContent = 'Find all matching pairs.';
    const symbols = ['◆','◆','●','●','▲','▲','★','★'].sort(() => Math.random() - 0.5);
    gameArea.innerHTML = `<div class="memory-grid">${symbols.map((s, i) => `<button class="memory-card" data-index="${i}" data-symbol="${s}">${s}</button>`).join('')}</div><div class="type-result" id="memResult">0/4 pairs found</div>`;
    const cards = [...gameArea.querySelectorAll('.memory-card')];
    const open = [];
    let pairs = 0, moves = 0, locked = false, saved = false;
    cards.forEach(card => card.onclick = () => {
      if (locked || card.classList.contains('flipped')) return;
      card.classList.add('flipped'); open.push(card); moves++;
      if (open.length !== 2) return;
      locked = true;
      if (open[0].dataset.symbol === open[1].dataset.symbol) {
        pairs++; open.length = 0; locked = false;
        $('memResult').textContent = `${pairs}/4 pairs found`;
        if (pairs === 4 && !saved) {
          saved = true;
          const score = Math.max(100, 500 - moves * 25);
          const accuracy = Math.round(8 / moves * 100);
          $('memResult').textContent = `Perfect! ${score} points 🧠`;
          saveResult('memory', { score, accuracy, level: 4, metadata: { moves } });
        }
      } else setTimeout(() => { open.forEach(x => x.classList.remove('flipped')); open.length = 0; locked = false; }, 550);
    });
  }

  function math() {
    modalTitle.textContent = 'Math Sprint';
    modalText.textContent = 'Choose the correct answer. Keep your streak going.';
    let score = 0, questions = 0, saved = false;
    const next = () => {
      const a = Math.floor(Math.random() * 20) + 5;
      const b = Math.floor(Math.random() * 15) + 2;
      const answer = a + b;
      const options = [...new Set([answer, answer + 2, answer - 3, answer + 5])].sort(() => Math.random() - 0.5);
      gameArea.innerHTML = `<div class="math-q">${a} + ${b} = ?</div><div class="choices">${options.map(x => `<button class="choice" data-answer="${x}">${x}</button>`).join('')}</div><div class="type-result" id="mathResult">Score: ${score}</div>`;
      gameArea.querySelectorAll('.choice').forEach(btn => btn.onclick = () => {
        questions++;
        const correct = Number(btn.dataset.answer) === answer;
        $('mathResult').textContent = correct ? 'Correct! ⚡' : 'Not quite — try again.';
        if (correct) {
          score++;
          saveResult('math', { score, level: score, metadata: { correct: true, question_number: questions } });
          setTimeout(next, 450);
        }
      });
    };
    next();
  }

  function focus() {
    modalTitle.textContent = 'Focus Hunt';
    modalText.textContent = 'Click the target as soon as it appears. Beat your reaction time.';
    gameArea.innerHTML = '<div class="focus-board" id="focusBoard"></div><div class="focus-score" id="focusScore">Get ready…</div>';
    const board = $('focusBoard'), score = $('focusScore');
    let stopped = false;
    const spawn = () => {
      if (stopped || !board.isConnected) return;
      board.innerHTML = '<button class="focus-dot" aria-label="target"></button>';
      const dot = board.firstElementChild;
      dot.style.left = `${Math.random() * 84 + 6}%`;
      dot.style.top = `${Math.random() * 78 + 8}%`;
      const start = performance.now();
      dot.onclick = () => {
        const ms = Math.round(performance.now() - start);
        score.textContent = `${ms} ms — ${ms < 300 ? 'Lightning fast! 🔥' : 'Nice! Try to beat it.'}`;
        saveResult('focus', { score: Math.max(1, 1000 - ms), reaction_ms: ms, metadata: { fast: ms < 300 } });
        setTimeout(spawn, 650);
      };
    };
    setTimeout(spawn, 700);
  }

  async function loadProfile() {
    if (!window.popUser || !window.popGetProfile) return;
    const data = await window.popGetProfile();
    if (!data) return;
    const user = window.popUser;
    const profile = data.profile || {};
    const name = profile.display_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Learner';
    $('profileName').textContent = name;
    $('profileEmail').textContent = profile.email || user.email || '—';
    $('avatar').textContent = name.charAt(0).toUpperCase();
    $('totalPlays').textContent = data.results.length;
    $('bestScore').textContent = Math.round(Math.max(0, ...data.results.map(r => Number(r.score) || 0)));
    $('streak').textContent = new Set(data.results.map(r => new Date(r.played_at).toISOString().slice(0, 10))).size;

    const scores = { typing: 0, memory: 0, math: 0, focus: 0 };
    data.results.forEach(r => {
      if (r.game === 'typing') scores.typing = Math.max(scores.typing, Math.min(100, Number(r.accuracy) || 0));
      if (r.game === 'memory') scores.memory = Math.max(scores.memory, Math.min(100, Number(r.accuracy) || 0));
      if (r.game === 'math') scores.math = Math.max(scores.math, Math.min(100, (Number(r.score) || 0) * 10));
      if (r.game === 'focus') scores.focus = Math.max(scores.focus, Math.min(100, (Number(r.score) || 0) / 10));
    });
    Object.entries(scores).forEach(([game, value]) => {
      const bar = $(`${game}Bar`), text = $(`${game}Score`);
      if (bar) bar.style.width = `${Math.round(value)}%`;
      if (text) text.textContent = Math.round(value) || '—';
    });
    $('trend').textContent = `${data.results.length} recorded result${data.results.length === 1 ? '' : 's'} — keep playing to grow your skill map.`;
    $('activityList').innerHTML = data.activities.length
      ? data.activities.slice(0, 15).map(e => `<div class="activity-item"><b>${e.game || e.event_type}</b><span>${new Date(e.created_at).toLocaleString()}</span></div>`).join('')
      : '<p class="muted">No activity yet.</p>';
    $('interestList').innerHTML = data.interests.length
      ? data.interests.map(i => `<span class="interest-pill">${i.interest} · ${i.score}</span>`).join('')
      : '<span class="muted">Play games to discover your interests.</span>';
  }

  function bind() {
    $('closeModal')?.addEventListener('click', closeModal);
    modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    document.querySelectorAll('[data-game]').forEach(card => card.addEventListener('click', () => launch(card.dataset.game)));
    $('heroPlay')?.addEventListener('click', () => launch('typing'));
    $('ctaPlay')?.addEventListener('click', () => launch('typing'));
    $('reactionBtn')?.addEventListener('click', () => launch('focus'));
    $('profileBtn')?.addEventListener('click', () => window.popUser ? openProfile() : openAuth());
    $('authBtn')?.addEventListener('click', () => window.popUser ? openProfile() : openAuth());
    $('closeProfile')?.addEventListener('click', closeProfile);
    $('closeAuth')?.addEventListener('click', closeAuth);
    authModal?.addEventListener('click', e => { if (e.target === authModal) closeAuth(); });
    $('signOut')?.addEventListener('click', async () => { await window.popSignOut?.(); closeProfile(); updateAuthUI(); });
    $('switchAuth')?.addEventListener('click', e => { e.preventDefault(); authMode = authMode === 'signup' ? 'signin' : 'signup'; renderAuth(); });
    $('googleAuth')?.addEventListener('click', async () => {
      if (!window.popSupabase) { $('authMessage').textContent = 'Supabase is not configured.'; return; }
      $('authMessage').textContent = 'Connecting to Google…';
      try { await window.popGoogleSignIn(); } catch (err) { $('authMessage').textContent = err?.message || 'Google sign-in failed.'; }
    });
    authForm?.addEventListener('submit', handleAuth);
  }

  window.addEventListener('pop-auth-ready', () => {
    updateAuthUI();
    if (window.popUser) loadProfile();
  });

  document.addEventListener('DOMContentLoaded', () => {
    bind();
    updateAuthUI();
    renderAuth();
    if (window.popAuthInit) window.popAuthInit();
  }, { once: true });
})();
