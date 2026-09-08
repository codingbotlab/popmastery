/* Supabase auth/profile helper for PopMastery. */
const POP = window.supabase && window.POPMASTERY_SUPABASE_URL && window.POPMASTERY_SUPABASE_ANON_KEY && !window.POPMASTERY_SUPABASE_URL.includes('YOUR_') && !window.POPMASTERY_SUPABASE_ANON_KEY.includes('YOUR_')
  ? window.supabase.createClient(window.POPMASTERY_SUPABASE_URL, window.POPMASTERY_SUPABASE_ANON_KEY) : null;
window.popSupabase = POP;
window.popUser = null;

window.popGoogleSignIn = async function() {
  if (!POP) throw new Error('Supabase is not configured.');
  return POP.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
};

function installGoogleButton() {
  const form = document.getElementById('authForm');
  if (!form || document.getElementById('googleAuth')) return;
  const divider = document.createElement('div');
  divider.innerHTML = '<span>or</span>';
  divider.style.cssText = 'display:flex;align-items:center;gap:10px;margin:16px 0;color:#7f879b;font-size:12px;';
  divider.style.setProperty('justify-content','center');
  const btn = document.createElement('button');
  btn.id = 'googleAuth'; btn.type = 'button'; btn.textContent = 'G  Continue with Google';
  btn.style.cssText = 'width:100%;padding:13px 16px;border-radius:12px;background:#fff;color:#111827;font-weight:800;display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid #d9dce5;';
  btn.addEventListener('click', async () => {
    const message = document.getElementById('authMessage');
    if (message) message.textContent = 'Connecting to Google…';
    try {
      const result = await window.popGoogleSignIn();
      if (result?.error) throw result.error;
    } catch (err) {
      if (message) message.textContent = err?.message || 'Google sign-in could not start.';
    }
  });
  form.insertAdjacentElement('afterend', divider);
  divider.insertAdjacentElement('afterend', btn);
}

window.popSaveResult = async function(game, result = {}) {
  if (!POP || !window.popUser) return;
  const row = { user_id: window.popUser.id, game, score: result.score ?? null, accuracy: result.accuracy ?? null, wpm: result.wpm ?? null, reaction_ms: result.reaction_ms ?? null, level: result.level ?? null, duration_seconds: result.duration_seconds ?? null, metadata: result.metadata || {} };
  const { error } = await POP.from('game_results').insert(row);
  if (error) console.warn('Result save failed:', error.message);
  await POP.from('activity_events').insert({ user_id: window.popUser.id, event_type: 'game_completed', game, payload: result });
  const { data: interest } = await POP.from('user_interests').select('score').eq('user_id', window.popUser.id).eq('interest', game).maybeSingle();
  await POP.from('user_interests').upsert({ user_id: window.popUser.id, interest: game, score: (interest?.score || 0) + 1, last_seen_at: new Date().toISOString() }, { onConflict: 'user_id,interest' });
};

window.popGetProfile = async function() {
  if (!POP || !window.popUser) return null;
  const [profile, results, activities, interests] = await Promise.all([
    POP.from('profiles').select('*').eq('id', window.popUser.id).maybeSingle(),
    POP.from('game_results').select('*').eq('user_id', window.popUser.id).order('played_at', { ascending: false }).limit(100),
    POP.from('activity_events').select('*').eq('user_id', window.popUser.id).order('created_at', { ascending: false }).limit(20),
    POP.from('user_interests').select('*').eq('user_id', window.popUser.id).order('score', { ascending: false })
  ]);
  return { profile: profile.data, results: results.data || [], activities: activities.data || [], interests: interests.data || [] };
};
window.popSignUp = async function(name, email, password) { if (!POP) throw new Error('Supabase is not configured.'); return POP.auth.signUp({ email, password, options: { data: { display_name: name || email.split('@')[0] } } }); };
window.popSignIn = async function(email, password) { if (!POP) throw new Error('Supabase is not configured.'); return POP.auth.signInWithPassword({ email, password }); };
window.popSignOut = async function() { if (POP) return POP.auth.signOut(); };

if (POP) {
  POP.auth.getSession().then(({ data }) => { window.popUser = data.session?.user || null; installGoogleButton(); window.dispatchEvent(new Event('pop-auth-ready')); });
  POP.auth.onAuthStateChange((_event, session) => { window.popUser = session?.user || null; installGoogleButton(); window.dispatchEvent(new Event('pop-auth-ready')); });
}
installGoogleButton();
