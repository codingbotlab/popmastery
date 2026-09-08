/* PopMastery authentication: Google + email/password + Supabase profile sync. */
(function () {
  const configured = Boolean(
    window.supabase &&
    window.POPMASTERY_SUPABASE_URL &&
    window.POPMASTERY_SUPABASE_ANON_KEY &&
    !window.POPMASTERY_SUPABASE_URL.includes('YOUR_') &&
    !window.POPMASTERY_SUPABASE_ANON_KEY.includes('YOUR_')
  );

  const POP = configured
    ? window.supabase.createClient(window.POPMASTERY_SUPABASE_URL, window.POPMASTERY_SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  window.popSupabase = POP;
  window.popUser = null;
  let lastSyncedUserId = null;

  function liveRedirect() {
    return 'https://popmastery.pages.dev/';
  }

  async function syncProfile(user, eventType) {
    if (!POP || !user) return;
    const metadata = user.user_metadata || {};
    const displayName = metadata.display_name || metadata.full_name || metadata.name || user.email?.split('@')[0] || 'Learner';
    const avatarUrl = metadata.avatar_url || metadata.picture || null;
    const provider = user.app_metadata?.provider || 'email';

    const { error: profileError } = await POP.from('profiles').upsert({
      id: user.id,
      display_name: displayName,
      email: user.email || null,
      avatar_url: avatarUrl,
      provider,
      metadata,
      updated_at: new Date().toISOString(),
      last_login_at: eventType === 'SIGNED_IN' ? new Date().toISOString() : undefined
    }, { onConflict: 'id' });

    if (profileError) console.warn('Profile sync failed:', profileError.message);

    if (eventType && eventType !== 'INITIAL_SESSION' && user.id !== lastSyncedUserId) {
      const { error } = await POP.from('activity_events').insert({
        user_id: user.id,
        event_type: eventType === 'SIGNED_IN' ? 'login' : eventType.toLowerCase(),
        payload: { provider, email: user.email || null }
      });
      if (error) console.warn('Activity save failed:', error.message);
      lastSyncedUserId = user.id;
    }
  }

  async function consumeOAuthHash() {
    if (!POP || !location.hash.includes('access_token=')) return;
    const hash = new URLSearchParams(location.hash.slice(1));
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    if (!accessToken || !refreshToken) return;
    const { error } = await POP.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) console.warn('OAuth session restore failed:', error.message);
    history.replaceState({}, document.title, location.pathname + location.search);
  }

  window.popGoogleSignIn = async function () {
    if (!POP) throw new Error('Supabase is not configured.');
    const { data, error } = await POP.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: liveRedirect() }
    });
    if (error) throw error;
    return data;
  };

  window.popSignUp = async function (name, email, password) {
    if (!POP) throw new Error('Supabase is not configured.');
    return POP.auth.signUp({ email, password, options: { emailRedirectTo: liveRedirect(), data: { display_name: name || email.split('@')[0] } } });
  };

  window.popSignIn = async function (email, password) {
    if (!POP) throw new Error('Supabase is not configured.');
    return POP.auth.signInWithPassword({ email, password });
  };

  window.popSignOut = async function () {
    if (!POP) return;
    const user = window.popUser;
    if (user) {
      const { error } = await POP.from('activity_events').insert({ user_id: user.id, event_type: 'logout', payload: {} });
      if (error) console.warn('Logout activity save failed:', error.message);
    }
    return POP.auth.signOut();
  };

  window.popSaveActivity = async function (eventType, game, payload = {}) {
    if (!POP || !window.popUser) return;
    const { error } = await POP.from('activity_events').insert({ user_id: window.popUser.id, event_type: eventType, game: game || null, payload });
    if (error) console.warn('Activity save failed:', error.message);
  };

  window.popSaveResult = async function (game, result = {}) {
    if (!POP || !window.popUser) return;
    const userId = window.popUser.id;
    const row = {
      user_id: userId,
      game,
      score: result.score ?? null,
      accuracy: result.accuracy ?? null,
      wpm: result.wpm ?? null,
      reaction_ms: result.reaction_ms ?? null,
      level: result.level ?? null,
      duration_seconds: result.duration_seconds ?? null,
      metadata: result.metadata || {}
    };
    const { error } = await POP.from('game_results').insert(row);
    if (error) console.warn('Result save failed:', error.message);

    const { error: activityError } = await POP.from('activity_events').insert({
      user_id: userId,
      event_type: 'game_completed',
      game,
      payload: result
    });
    if (activityError) console.warn('Activity save failed:', activityError.message);

    const { data: interest } = await POP.from('user_interests').select('score').eq('user_id', userId).eq('interest', game).maybeSingle();
    const nextScore = (interest?.score || 0) + 1;
    const { error: interestError } = await POP.from('user_interests').upsert({
      user_id: userId,
      interest: game,
      score: nextScore,
      last_seen_at: new Date().toISOString()
    }, { onConflict: 'user_id,interest' });
    if (interestError) console.warn('Interest save failed:', interestError.message);
  };

  window.popGetProfile = async function () {
    if (!POP || !window.popUser) return null;
    const userId = window.popUser.id;
    const [profile, results, activities, interests] = await Promise.all([
      POP.from('profiles').select('*').eq('id', userId).maybeSingle(),
      POP.from('game_results').select('*').eq('user_id', userId).order('played_at', { ascending: false }).limit(200),
      POP.from('activity_events').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
      POP.from('user_interests').select('*').eq('user_id', userId).order('score', { ascending: false })
    ]);
    return {
      profile: profile.data,
      results: results.data || [],
      activities: activities.data || [],
      interests: interests.data || []
    };
  };

  async function init() {
    if (!POP) {
      window.dispatchEvent(new CustomEvent('pop-auth-ready', { detail: { user: null, configured: false } }));
      return;
    }
    await consumeOAuthHash();
    const { data, error } = await POP.auth.getSession();
    if (error) console.warn('Session read failed:', error.message);
    window.popUser = data.session?.user || null;
    if (window.popUser) await syncProfile(window.popUser, 'INITIAL_SESSION');
    window.dispatchEvent(new CustomEvent('pop-auth-ready', { detail: { user: window.popUser, configured: true } }));

    POP.auth.onAuthStateChange(async (event, session) => {
      window.popUser = session?.user || null;
      if (window.popUser) await syncProfile(window.popUser, event);
      window.dispatchEvent(new CustomEvent('pop-auth-ready', { detail: { user: window.popUser, event, configured: true } }));
    });
  }

  window.popAuthInit = init;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
