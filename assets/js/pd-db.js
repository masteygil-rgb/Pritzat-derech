/* =========================================================
   פריצת דרך — חיבור Supabase (REST בלבד, ללא תלויות)
   התוכן נשמר בטבלת site_content (אותו פרויקט כמו marvah.co.il)
   תחת המפתח 'pritzat-derech'.
   ה-anon key בטוח לחשיפה — האבטחה היא ב-RLS בצד השרת:
   קריאה ציבורית, כתיבה רק למשתמש מחובר (אימייל+סיסמה).
   ========================================================= */
(function () {
  'use strict';

  var URL_ = 'https://rtuobiaocojeefspkcez.supabase.co';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0dW9iaWFvY29qZWVmc3BrY2V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMjIwMzQsImV4cCI6MjA5MzU5ODAzNH0.IbzqNQ2mTJ1ADTKMhCT7wuoScyrobsiGCIaYLFKVOTs';
  var KEY  = 'pritzat-derech';
  var SESSION_KEY = 'pd_sb_session_v1';

  function getSession(){
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch(e){ return null; }
  }
  function setSession(s){
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch(e){}
  }

  function headers(bearer){
    return {
      'apikey': ANON,
      'Authorization': 'Bearer ' + (bearer || ANON),
      'Content-Type': 'application/json'
    };
  }

  /* קריאת התוכן שפורסם — ציבורי, לכל מבקר */
  function load(){
    return fetch(URL_ + '/rest/v1/site_content?key=eq.' + KEY + '&select=data', {
      headers: headers()
    }).then(function(r){
      if (!r.ok) throw new Error('load ' + r.status);
      return r.json();
    }).then(function(rows){
      return (rows && rows[0]) ? rows[0].data : null;
    });
  }

  /* התחברות בחשבון הניהול (כמו ב-marvah.co.il) */
  function signIn(email, password){
    return fetch(URL_ + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email: email, password: password })
    }).then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
      .then(function(res){
        if (!res.ok || !res.j.access_token) throw new Error(res.j.error_description || res.j.msg || 'התחברות נכשלה');
        setSession({
          access_token:  res.j.access_token,
          refresh_token: res.j.refresh_token,
          expires_at:    Date.now() + ((res.j.expires_in || 3600) - 60) * 1000
        });
        return true;
      });
  }

  function refresh(){
    var s = getSession();
    if (!s || !s.refresh_token) return Promise.reject(new Error('no session'));
    return fetch(URL_ + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ refresh_token: s.refresh_token })
    }).then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
      .then(function(res){
        if (!res.ok || !res.j.access_token){ setSession(null); throw new Error('פג תוקף החיבור'); }
        setSession({
          access_token:  res.j.access_token,
          refresh_token: res.j.refresh_token || s.refresh_token,
          expires_at:    Date.now() + ((res.j.expires_in || 3600) - 60) * 1000
        });
        return true;
      });
  }

  /* אסימון תקף — מרענן אוטומטית אם פג */
  function freshToken(){
    var s = getSession();
    if (!s) return Promise.reject(new Error('not signed in'));
    if (Date.now() < (s.expires_at || 0)) return Promise.resolve(s.access_token);
    return refresh().then(function(){ return getSession().access_token; });
  }

  /* פרסום התוכן — upsert; דורש התחברות */
  function save(payload){
    return freshToken().then(function(tok){
      return fetch(URL_ + '/rest/v1/site_content', {
        method: 'POST',
        headers: Object.assign(headers(tok), { 'Prefer': 'resolution=merge-duplicates' }),
        body: JSON.stringify([{ key: KEY, data: payload }])
      });
    }).then(function(r){
      if (r.status === 401){ /* אסימון נדחה — ניסיון רענון אחד */
        return refresh().then(function(){ return save(payload); });
      }
      if (!r.ok) return r.text().then(function(t){ throw new Error('save ' + r.status + ': ' + t.slice(0,200)); });
      return true;
    });
  }

  window.PDDB = {
    load: load,
    save: save,
    signIn: signIn,
    signOut: function(){ setSession(null); },
    isAuthed: function(){ return !!getSession(); }
  };
})();
