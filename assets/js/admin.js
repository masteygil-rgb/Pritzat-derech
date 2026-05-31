/* ===================================================================
   פריצת דרך · מנוע אדמין לעריכת האתר
   -------------------------------------------------------------------
   • עריכת טקסט inline (contentEditable)
   • עיצוב טקסט: מודגש/נטוי/קו תחתי, צבע, גודל, יישור
   • החלפת תמונות ורקעים (נשמר כ-dataURL)
   • עריכת ערכת הצבעים של האתר
   • שמירה אוטומטית ל-localStorage + ייצוא/ייבוא קובץ + איפוס
   • השינויים מוחלים על כל טעינה (גם למבקר רגיל באותו דפדפן)

   הערה: ההגנה בסיסמה היא שכבת נוחות בצד-לקוח בלבד, לא אבטחה אמיתית.
   =================================================================== */
(function () {
  'use strict';

  var STORE_KEY = 'pd_admin_overrides_v1';
  var THEME_KEY = 'pd_admin_theme_v1';
  var PASS_KEY  = 'pd_admin_pass_v1';
  var DEFAULT_PASS = 'derech2050';          /* ניתן לשינוי בסרגל האדמין */

  /* בוררים לאלמנטים הניתנים לעריכת טקסט */
  var TEXT_SELECTORS = [
    '.hero-title', '.hero-sub', '.eyebrow',
    '.lead h3', '.lead p',
    '.section-kicker',
    '.pillar h5', '.pillar p', '.pillar-num',
    '.mini h5', '.mini p',
    '.stat label',
    '.nav-card b', '.nav-card span',
    '.page-head h2', '.page-head p',
    '.subtab',
    '.subpanel > h3', '.subpanel > p',
    '.split-text h3', '.split-text p',
    '.ticks li',
    '.callout',
    '.layer b', '.layer p',
    '.corridor .node',
    '.spec b', '.spec span',
    '.tl-item b', '.tl-item p',
    '.rm b', '.rm p', '.rm-year',
    '.bar span',
    '.cta-form h4', '.field label',
    '.site-footer p', '.site-footer small',
    '.brand-text h1', '.brand-text p',
    '.nav-label', '.hero-scroll',
    '.sidebar-footer p', '.sidebar-footer small'
  ];

  /* תמונות הניתנות להחלפה (img) ורקעי split-visual */
  var IMG_SELECTORS = ['.brand-logo img'];
  var BG_SELECTORS  = ['.split-visual'];

  var THEME_VARS = [
    { var: '--olive',     label: 'ירוק דן (ראשי)' },
    { var: '--olive-deep',label: 'ירוק כהה' },
    { var: '--sea',       label: 'תכלת ים' },
    { var: '--sea-deep',  label: 'ים כהה' },
    { var: '--sand',      label: 'חום בקעה' },
    { var: '--sand-deep', label: 'חום כהה' },
    { var: '--ink',       label: 'צבע טקסט' },
    { var: '--paper',     label: 'רקע' }
  ];

  var overrides = load(STORE_KEY) || {};   /* { key: {html|text|src|bg|style} } */
  var theme     = load(THEME_KEY) || {};
  var adminOn   = false;
  var dirty     = false;

  /* ---------- עזרי אחסון ---------- */
  function load(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } }
  function save(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ return false; } }
  function getPass(){ return localStorage.getItem(PASS_KEY) || DEFAULT_PASS; }

  /* ---------- מפתח יציב לכל אלמנט (נתיב nth-child) ---------- */
  function keyOf(el){
    if (el.id) return '#' + el.id;
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1 && node !== document.body){
      var p = node.parentNode;
      if (!p) break;
      var idx = Array.prototype.indexOf.call(p.children, node) + 1;
      parts.unshift(node.tagName.toLowerCase() + ':nth-child(' + idx + ')');
      if (p.id){ parts.unshift('#' + p.id); break; }
      node = p;
    }
    return parts.join('>');
  }

  /* ---------- החלת שינויים שמורים (רץ תמיד) ---------- */
  function applyOverrides(){
    /* טקסט / HTML */
    eachText(function(el){
      var k = keyOf(el);
      var o = overrides[k];
      if (!o) return;
      if (o.html != null) el.innerHTML = o.html;
      if (o.style){ el.setAttribute('style', (el.getAttribute('style')||'') + ';' + o.style); }
    });
    /* תמונות */
    eachSel(IMG_SELECTORS, function(el){
      var o = overrides[keyOf(el)];
      if (o && o.src) el.src = o.src;
    });
    /* רקעים */
    eachSel(BG_SELECTORS, function(el){
      var o = overrides[keyOf(el)];
      if (o && o.bg){
        el.style.backgroundImage = 'url("' + o.bg + '")';
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.classList.add('has-custom-bg');
      }
    });
    applyTheme();
  }
  function applyTheme(){
    var root = document.documentElement;
    Object.keys(theme).forEach(function(v){ root.style.setProperty(v, theme[v]); });
  }

  function eachSel(sels, fn){
    sels.forEach(function(s){
      document.querySelectorAll(s).forEach(fn);
    });
  }
  function eachText(fn){ eachSel(TEXT_SELECTORS, fn); }

  /* ---------- בניית ממשק האדמין ---------- */
  function buildUI(){
    /* כפתור צף */
    var fab = el('button', 'admin-fab', '✎');
    fab.title = 'מצב עריכה (אדמין)';
    fab.addEventListener('click', requestLogin);
    document.body.appendChild(fab);

    /* סרגל עליון */
    var bar = el('div', 'admin-bar');
    bar.innerHTML =
      '<div class="ab-logo"><i>פד</i> מצב עריכה</div>' +
      '<button class="admin-btn" data-act="theme">🎨 עיצוב כללי</button>' +
      '<button class="admin-btn" data-act="export">⬇ ייצוא</button>' +
      '<button class="admin-btn" data-act="import">⬆ ייבוא</button>' +
      '<button class="admin-btn" data-act="pass">🔑 סיסמה</button>' +
      '<button class="admin-btn danger" data-act="reset">↺ איפוס</button>' +
      '<span class="ab-spacer"></span>' +
      '<span class="ab-status" id="abStatus">מוכן</span>' +
      '<button class="admin-btn exit" data-act="exit">✕ יציאה</button>';
    document.body.appendChild(bar);
    bar.addEventListener('click', function(e){
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.dataset.act;
      if (act==='theme') toggleTheme();
      else if (act==='export') doExport();
      else if (act==='import') doImport();
      else if (act==='pass') changePass();
      else if (act==='reset') doReset();
      else if (act==='exit') exitAdmin();
    });

    /* סרגל עיצוב טקסט */
    var fmt = el('div', 'fmt-toolbar');
    fmt.id = 'fmtToolbar';
    fmt.innerHTML =
      '<button data-cmd="bold" title="מודגש">B</button>' +
      '<button data-cmd="italic" title="נטוי" style="font-style:italic">I</button>' +
      '<button data-cmd="underline" title="קו תחתי" style="text-decoration:underline">U</button>' +
      '<span class="sep"></span>' +
      '<select data-size title="גודל"><option value="">גודל</option><option value="2">קטן</option><option value="3">רגיל</option><option value="5">גדול</option><option value="6">ענק</option></select>' +
      '<input type="color" data-color title="צבע טקסט" value="#23271b" />' +
      '<span class="sep"></span>' +
      '<button data-cmd="justifyRight" title="ימין">⇥</button>' +
      '<button data-cmd="justifyCenter" title="מרכז">≡</button>' +
      '<button data-cmd="justifyLeft" title="שמאל">⇤</button>' +
      '<span class="sep"></span>' +
      '<button data-cmd="removeFormat" title="נקה עיצוב">⌫</button>';
    document.body.appendChild(fmt);
    fmt.addEventListener('mousedown', function(e){ e.preventDefault(); }); /* שמירת הסימון */
    fmt.addEventListener('click', function(e){
      var b = e.target.closest('[data-cmd]'); if (!b) return;
      document.execCommand(b.dataset.cmd, false, null);
      markDirtyFromActive();
      refreshFmtState();
    });
    fmt.querySelector('[data-color]').addEventListener('input', function(e){
      document.execCommand('foreColor', false, e.target.value); markDirtyFromActive();
    });
    fmt.querySelector('[data-size]').addEventListener('change', function(e){
      if (e.target.value){ document.execCommand('fontSize', false, e.target.value); markDirtyFromActive(); }
    });

    /* פאנל ערכת צבעים */
    var tp = el('div', 'theme-panel'); tp.id = 'themePanel';
    var rows = THEME_VARS.map(function(t){
      var cur = (theme[t.var] || cssVar(t.var) || '#000000').trim();
      return '<div class="tp-row"><label>'+t.label+'</label>' +
             '<input type="color" data-tvar="'+t.var+'" value="'+toHex(cur)+'"></div>';
    }).join('');
    tp.innerHTML = '<h3>עיצוב כללי</h3><div class="tp-sub">ערכת הצבעים של האתר</div>' + rows +
      '<button class="admin-btn primary" id="themeReset" style="margin-top:18px;width:100%;justify-content:center">החזר צבעי ברירת מחדל</button>' +
      '<div class="tp-note">הצבעים נשמרים אוטומטית ומשפיעים על כל האתר. ה"ירוק דן" הוא צבע ההדגשה הראשי.</div>';
    document.body.appendChild(tp);
    tp.addEventListener('input', function(e){
      var v = e.target.dataset.tvar; if (!v) return;
      theme[v] = e.target.value;
      document.documentElement.style.setProperty(v, e.target.value);
      save(THEME_KEY, theme); setStatus('נשמר', true);
    });
    tp.querySelector('#themeReset').addEventListener('click', function(){
      theme = {}; save(THEME_KEY, theme);
      THEME_VARS.forEach(function(t){ document.documentElement.style.removeProperty(t.var); });
      setStatus('אופס', true); setTimeout(function(){ location.reload(); }, 400);
    });

    /* input נסתר להעלאת תמונות */
    var fileIn = el('input'); fileIn.type='file'; fileIn.accept='image/*'; fileIn.id='admImgInput'; fileIn.style.display='none';
    document.body.appendChild(fileIn);

    /* מודאל */
    var modal = el('div','admin-modal'); modal.id='admModal';
    document.body.appendChild(modal);
  }

  /* ---------- כניסה / יציאה ---------- */
  function requestLogin(){
    showModal(
      '<h3>כניסת אדמין</h3><p>הזינו סיסמה כדי לערוך את האתר.</p>' +
      '<div class="am-err" id="loginErr"></div>' +
      '<input type="password" id="loginPass" placeholder="סיסמה" autofocus />' +
      '<div class="am-actions">' +
        '<button class="admin-btn" data-close>ביטול</button>' +
        '<button class="admin-btn primary" id="loginGo">כניסה</button>' +
      '</div>',
      function(box){
        var inp = box.querySelector('#loginPass');
        var go = function(){
          if (inp.value === getPass()){ hideModal(); enterAdmin(); }
          else { box.querySelector('#loginErr').textContent = 'סיסמה שגויה'; inp.select(); }
        };
        box.querySelector('#loginGo').addEventListener('click', go);
        inp.addEventListener('keydown', function(e){ if(e.key==='Enter') go(); });
        inp.focus();
      }
    );
  }

  function enterAdmin(){
    adminOn = true;
    document.body.classList.add('admin-on');
    enableEditing(true);
    setStatus('מצב עריכה פעיל');
    try { sessionStorage.setItem('pd_admin_session','1'); } catch(e){}
  }
  function exitAdmin(){
    if (dirty) flush();
    adminOn = false;
    document.body.classList.remove('admin-on');
    enableEditing(false);
    hideFmt();
    document.getElementById('themePanel').classList.remove('show');
    try { sessionStorage.removeItem('pd_admin_session'); } catch(e){}
  }

  /* ---------- הפעלת עריכה ---------- */
  function enableEditing(on){
    eachText(function(el){
      if (on){
        el.setAttribute('data-editable','');
        el.setAttribute('contenteditable','true');
        el.addEventListener('input', onTextInput);
        el.addEventListener('mouseup', onSelect);
        el.addEventListener('keyup', onSelect);
        el.addEventListener('blur', onBlur);
      } else {
        el.removeAttribute('data-editable');
        el.removeAttribute('contenteditable');
        el.removeEventListener('input', onTextInput);
        el.removeEventListener('mouseup', onSelect);
        el.removeEventListener('keyup', onSelect);
        el.removeEventListener('blur', onBlur);
      }
    });
    eachSel(IMG_SELECTORS.concat(BG_SELECTORS), function(el){
      if (on){ el.setAttribute('data-img',''); el.addEventListener('click', onImgClick); }
      else { el.removeAttribute('data-img'); el.removeEventListener('click', onImgClick); }
    });
  }

  function onTextInput(e){
    var el = e.currentTarget;
    var k = keyOf(el);
    overrides[k] = overrides[k] || {};
    overrides[k].html = el.innerHTML;
    markDirty();
  }
  function onBlur(){ if (dirty) flush(); }

  /* ---------- סרגל עיצוב טקסט ---------- */
  var activeEditable = null;
  function onSelect(e){
    activeEditable = e.currentTarget;
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount){ hideFmt(); return; }
    var rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect.width && !rect.height){ hideFmt(); return; }
    var tb = document.getElementById('fmtToolbar');
    tb.classList.add('show');
    var top = rect.top - tb.offsetHeight - 8;
    if (top < 60) top = rect.bottom + 8;
    var left = rect.left + rect.width/2 - tb.offsetWidth/2;
    left = Math.max(8, Math.min(left, window.innerWidth - tb.offsetWidth - 8));
    tb.style.top = top + 'px';
    tb.style.left = left + 'px';
    refreshFmtState();
  }
  function refreshFmtState(){
    ['bold','italic','underline'].forEach(function(c){
      var b = document.querySelector('#fmtToolbar [data-cmd="'+c+'"]');
      if (b){ try { b.classList.toggle('on', document.queryCommandState(c)); } catch(e){} }
    });
  }
  function hideFmt(){ var t=document.getElementById('fmtToolbar'); if(t) t.classList.remove('show'); }
  function markDirtyFromActive(){
    if (activeEditable){
      var k = keyOf(activeEditable);
      overrides[k] = overrides[k] || {};
      overrides[k].html = activeEditable.innerHTML;
      markDirty();
    }
  }

  /* ---------- החלפת תמונות / רקעים ---------- */
  var imgTarget = null;
  function onImgClick(e){
    e.preventDefault(); e.stopPropagation();
    imgTarget = e.currentTarget;
    document.getElementById('admImgInput').click();
  }
  function initImgInput(){
    var fi = document.getElementById('admImgInput');
    fi.addEventListener('change', function(){
      var f = fi.files && fi.files[0]; if (!f || !imgTarget) return;
      var reader = new FileReader();
      reader.onload = function(){
        var data = reader.result;
        var k = keyOf(imgTarget);
        overrides[k] = overrides[k] || {};
        if (imgTarget.tagName === 'IMG'){ imgTarget.src = data; overrides[k].src = data; }
        else {
          imgTarget.style.backgroundImage = 'url("'+data+'")';
          imgTarget.style.backgroundSize = 'cover';
          imgTarget.style.backgroundPosition = 'center';
          imgTarget.classList.add('has-custom-bg');
          overrides[k].bg = data;
        }
        flush(); setStatus('התמונה הוחלפה', true);
      };
      reader.readAsDataURL(f);
      fi.value = '';
    });
  }

  /* ---------- שמירה / מצב ---------- */
  var saveTimer = null;
  function markDirty(){
    dirty = true; setStatus('עריכה…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 700);
  }
  function flush(){
    var ok = save(STORE_KEY, overrides);
    dirty = false;
    setStatus(ok ? 'נשמר ✓' : 'שגיאת שמירה (אולי גדול מדי)', ok);
  }
  function setStatus(t, saved){
    var s = document.getElementById('abStatus'); if(!s) return;
    s.textContent = t; s.classList.toggle('saved', !!saved);
  }

  /* ---------- ייצוא / ייבוא / איפוס ---------- */
  function doExport(){
    var payload = { overrides: overrides, theme: theme, exportedAt: new Date().toISOString() };
    var blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pricat-derech-content.json';
    a.click();
    setStatus('יוצא קובץ ✓', true);
  }
  function doImport(){
    var fi = el('input'); fi.type='file'; fi.accept='application/json,.json';
    fi.addEventListener('change', function(){
      var f = fi.files && fi.files[0]; if(!f) return;
      var r = new FileReader();
      r.onload = function(){
        try{
          var d = JSON.parse(r.result);
          if (d.overrides) overrides = d.overrides;
          if (d.theme) theme = d.theme;
          save(STORE_KEY, overrides); save(THEME_KEY, theme);
          setStatus('יובא ✓ טוען מחדש…', true);
          setTimeout(function(){ location.reload(); }, 500);
        }catch(e){ alert('קובץ לא תקין'); }
      };
      r.readAsText(f);
    });
    fi.click();
  }
  function doReset(){
    showModal(
      '<h3>איפוס כל השינויים</h3><p>הפעולה תמחק את כל העריכות (טקסט, תמונות וצבעים) ותחזיר את האתר למקור. לא ניתן לבטל.</p>' +
      '<div class="am-actions"><button class="admin-btn" data-close>ביטול</button>' +
      '<button class="admin-btn danger" id="resetGo">מחק הכול</button></div>',
      function(box){
        box.querySelector('#resetGo').addEventListener('click', function(){
          localStorage.removeItem(STORE_KEY); localStorage.removeItem(THEME_KEY);
          hideModal(); location.reload();
        });
      }
    );
  }
  function changePass(){
    showModal(
      '<h3>שינוי סיסמת אדמין</h3><p>בחרו סיסמה חדשה לכניסה למצב עריכה (נשמרת בדפדפן זה).</p>' +
      '<input type="text" id="newPass" placeholder="סיסמה חדשה" />' +
      '<div class="am-actions"><button class="admin-btn" data-close>ביטול</button>' +
      '<button class="admin-btn primary" id="passGo">שמירה</button></div>',
      function(box){
        box.querySelector('#passGo').addEventListener('click', function(){
          var v = box.querySelector('#newPass').value.trim();
          if (v.length < 4){ alert('הסיסמה קצרה מדי (לפחות 4 תווים)'); return; }
          localStorage.setItem(PASS_KEY, v); hideModal(); setStatus('הסיסמה עודכנה', true);
        });
      }
    );
  }

  function toggleTheme(){ document.getElementById('themePanel').classList.toggle('show'); }

  /* ---------- מודאל גנרי ---------- */
  function showModal(html, onReady){
    var m = document.getElementById('admModal');
    m.innerHTML = '<div class="am-box">' + html + '</div>';
    m.classList.add('show');
    m.addEventListener('click', function(e){ if (e.target===m || e.target.hasAttribute('data-close')) hideModal(); });
    if (onReady) onReady(m.querySelector('.am-box'));
  }
  function hideModal(){ var m=document.getElementById('admModal'); if(m){ m.classList.remove('show'); m.innerHTML=''; } }

  /* ---------- עזרי DOM ---------- */
  function el(tag, cls, text){ var e=document.createElement(tag); if(cls)e.className=cls; if(text!=null)e.textContent=text; return e; }
  function cssVar(v){ return getComputedStyle(document.documentElement).getPropertyValue(v); }
  function toHex(c){
    c = (c||'').trim();
    if (c[0]==='#'){ if(c.length===4) return '#'+c[1]+c[1]+c[2]+c[2]+c[3]+c[3]; return c.slice(0,7); }
    var m = c.match(/(\d+)/g);
    if (m && m.length>=3){ return '#'+m.slice(0,3).map(function(n){var h=(+n).toString(16);return h.length<2?'0'+h:h;}).join(''); }
    return '#000000';
  }

  /* ---------- אתחול ---------- */
  function init(){
    applyOverrides();        /* תמיד — גם למבקר רגיל */
    buildUI();
    initImgInput();

    /* קיצור מקלדת: Ctrl+Shift+E לפתיחת כניסה */
    document.addEventListener('keydown', function(e){
      if (e.ctrlKey && e.shiftKey && (e.key==='E'||e.key==='e')){ e.preventDefault(); adminOn?exitAdmin():requestLogin(); }
      if (e.key==='Escape'){ hideFmt(); }
    });

    /* כניסה אוטומטית אם ?admin=1 או אם כבר במהלך סשן */
    var qs = new URLSearchParams(location.search);
    if (qs.get('admin')==='1' || sessionStorage.getItem('pd_admin_session')==='1') requestLogin();

    /* שמירה לפני יציאה */
    window.addEventListener('beforeunload', function(){ if(dirty) save(STORE_KEY, overrides); });
    document.addEventListener('scroll', hideFmt, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
