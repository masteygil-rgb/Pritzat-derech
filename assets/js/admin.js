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

  var STORE_KEY  = 'pd_admin_overrides_v1';
  var THEME_KEY  = 'pd_admin_theme_v1';
  var BLOCKS_KEY = 'pd_admin_blocks_v1';
  var PASS_KEY   = 'pd_admin_pass_v1';
  var DEFAULT_PASS = 'derech2050';          /* ניתן לשינוי בסרגל האדמין */

  /* תמונת placeholder לבלוק תמונה חדש */
  var IMG_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='360'%3E%3Crect width='600' height='360' fill='%23eaf1f5'/%3E%3Cg fill='none' stroke='%231f87b0' stroke-width='3' opacity='.55'%3E%3Crect x='30' y='30' width='540' height='300' rx='12'/%3E%3Ccircle cx='160' cy='150' r='40'/%3E%3Cpath d='M60 300 L230 170 L330 250 L430 160 L540 270'/%3E%3C/g%3E%3Ctext x='300' y='335' text-anchor='middle' font-family='Arial' font-size='20' fill='%237c8e9a'%3E%D7%9C%D7%97%D7%A6%D7%95 %D7%9C%D7%94%D7%A2%D7%9C%D7%90%D7%AA %D7%AA%D7%9E%D7%95%D7%A0%D7%94%3C/text%3E%3C/svg%3E";

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
  var blocks    = load(BLOCKS_KEY) || {};  /* { pageId: [ {id,type,html,img,caption} ] } */
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
    renderBlocks();          /* בלוקים מותאמים אישית — תמיד מוצגים */
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
      '<div class="ab-logo"><i>פד</i> מצב עריכה <b style="background:#1f87b0;color:#fff;border-radius:5px;padding:1px 7px;font-size:.72rem;margin-inline-start:6px">v17</b></div>' +
      '<button class="admin-btn primary" data-act="add">➕ הוסף בלוק</button>' +
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
      if (act==='add') addBlockFlow();
      else if (act==='theme') toggleTheme();
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
      '<select data-font title="גופן">' +
        '<option value="">גופן</option>' +
        '<option value="Heebo">Heebo</option>' +
        '<option value="Assistant">Assistant</option>' +
        '<option value="Arial">Arial</option>' +
        '<option value="Times New Roman">Times</option>' +
        '<option value="Georgia">Georgia</option>' +
        '<option value="Courier New">Courier</option>' +
      '</select>' +
      '<select data-size title="גודל גופן">' +
        '<option value="">גודל</option>' +
        '<option value="1">זעיר</option><option value="2">קטן</option>' +
        '<option value="3">רגיל</option><option value="4">בינוני</option>' +
        '<option value="5">גדול</option><option value="6">גדול מאוד</option><option value="7">ענק</option>' +
      '</select>' +
      '<span class="sep"></span>' +
      '<button data-cmd="bold" title="מודגש">B</button>' +
      '<button data-cmd="italic" title="נטוי" style="font-style:italic">I</button>' +
      '<button data-cmd="underline" title="קו תחתי" style="text-decoration:underline">U</button>' +
      '<input type="color" data-color title="צבע גופן" value="#16293a" />' +
      '<span class="sep"></span>' +
      '<button data-cmd="justifyRight" title="יישור לימין">⇥</button>' +
      '<button data-cmd="justifyCenter" title="מרכוז">≡</button>' +
      '<button data-cmd="justifyLeft" title="יישור לשמאל">⇤</button>' +
      '<button data-cmd="justifyFull" title="יישור דו-צדדי">☰</button>' +
      '<span class="sep"></span>' +
      '<button data-cmd="insertUnorderedList" title="רשימת נקודות">•≡</button>' +
      '<button data-cmd="insertOrderedList" title="רשימה ממוספרת">1.≡</button>' +
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
    fmt.querySelector('[data-font]').addEventListener('change', function(e){
      if (e.target.value){ document.execCommand('fontName', false, e.target.value); markDirtyFromActive(); }
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
    renderBlocks();          /* רינדור מחדש עם כלי עריכה לבלוקים */
    setStatus('מצב עריכה פעיל');
    try { sessionStorage.setItem('pd_admin_session','1'); } catch(e){}
  }
  function exitAdmin(){
    if (dirty) flush();
    adminOn = false;
    document.body.classList.remove('admin-on');
    enableEditing(false);
    renderBlocks();          /* רינדור מחדש ללא כלי עריכה */
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
    if (!sel || !sel.rangeCount){ hideFmt(); return; }
    var range = sel.getRangeAt(0);
    var rect = range.getBoundingClientRect();
    /* גם כשהסמן בלבד (בלי סימון) — מציגים מעל האלמנט הנערך */
    if (!rect.width && !rect.height){
      rect = activeEditable.getBoundingClientRect();
    }
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
  var blockImgTarget = null;   /* { pid, id, el } — תמונה בתוך בלוק מותאם */
  function onImgClick(e){
    e.preventDefault(); e.stopPropagation();
    blockImgTarget = null;
    imgTarget = e.currentTarget;
    document.getElementById('admImgInput').click();
  }
  function initImgInput(){
    var fi = document.getElementById('admImgInput');
    fi.addEventListener('change', function(){
      var f = fi.files && fi.files[0]; if (!f) return;
      var reader = new FileReader();
      reader.onload = function(){
        var data = reader.result;
        /* תמונה בתוך בלוק מותאם */
        if (blockImgTarget){
          var rec = findBlock(blockImgTarget.pid, blockImgTarget.id);
          if (rec){
            var field = blockImgTarget.field || 'img';
            rec.b[field] = data;
            blockImgTarget.el.src = data;
            saveBlocks(); setStatus('התמונה הוחלפה', true);
          }
          blockImgTarget = null; fi.value=''; return;
        }
        if (!imgTarget) { fi.value=''; return; }
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
    var payload = { overrides: overrides, theme: theme, blocks: blocks, exportedAt: new Date().toISOString() };
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
          if (d.blocks) blocks = d.blocks;
          save(STORE_KEY, overrides); save(THEME_KEY, theme); save(BLOCKS_KEY, blocks);
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
      '<h3>איפוס כל השינויים</h3><p>הפעולה תמחק את כל העריכות (טקסט, תמונות, צבעים ובלוקים שנוספו) ותחזיר את האתר למקור. לא ניתן לבטל.</p>' +
      '<div class="am-actions"><button class="admin-btn" data-close>ביטול</button>' +
      '<button class="admin-btn danger" id="resetGo">מחק הכול</button></div>',
      function(box){
        box.querySelector('#resetGo').addEventListener('click', function(){
          localStorage.removeItem(STORE_KEY); localStorage.removeItem(THEME_KEY); localStorage.removeItem(BLOCKS_KEY);
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

  /* ===================================================================
     בלוקים מותאמים אישית — הוספת שדות טקסט/תמונה חדשים
     =================================================================== */
  function uid(){ return 'b' + Date.now().toString(36) + Math.floor(Math.random()*1e4).toString(36); }
  function saveBlocks(){ var ok = save(BLOCKS_KEY, blocks); setStatus(ok?'נשמר ✓':'שגיאת שמירה', ok); }

  /* יצירת אזור-תוספות בראש התוכן של כל פרק (פעם אחת) */
  function ensureAddZones(){
    document.querySelectorAll('.page').forEach(function(page){
      if (page.querySelector(':scope > .admin-blocks')) return;
      var zone = el('div', 'container admin-blocks');
      zone.setAttribute('data-addzone', page.id);
      /* ממקמים מיד אחרי כותרת הפרק (page-head) או אחרי ה-hero — בראש התוכן */
      var anchor = page.querySelector(':scope > .page-head') || page.querySelector(':scope > .hero');
      if (anchor && anchor.nextSibling) page.insertBefore(zone, anchor.nextSibling);
      else if (anchor) page.appendChild(zone);
      else page.insertBefore(zone, page.firstChild);
    });
  }

  /* רינדור כל הבלוקים השמורים */
  function renderBlocks(){
    ensureAddZones();
    /* הסרת בלוקים צפים קודמים */
    document.querySelectorAll('.custom-block.cb-free').forEach(function(n){ n.remove(); });
    document.querySelectorAll('.admin-blocks').forEach(function(zone){
      var pid = zone.getAttribute('data-addzone');
      var list = blocks[pid] || [];
      zone.innerHTML = '';
      list.forEach(function(b, i){
        var node = renderBlock(b, pid, i, list.length);
        if (b.free){
          var page = document.getElementById(pid);
          if (page){ applyFreePos(node, b); page.appendChild(node); }
          else zone.appendChild(node);
        } else {
          zone.appendChild(node);
        }
      });
    });
  }

  function applyFreePos(node, b){
    node.classList.add('cb-free');
    node.style.position = 'absolute';
    node.style.left = (b.x != null ? b.x : 50) + '%';   /* left רגיל — לא RTL-aware, כדי שלא יתהפך */
    node.style.right = 'auto';
    node.style.top = (b.y != null ? b.y : 18) + '%';
    node.style.width = (b.w ? b.w + 'px' : 'min(420px,80vw)');
    node.style.zIndex = 30;
  }

  function renderBlock(b, pid, idx, total){
    var wrap = el('div','custom-block');
    wrap.setAttribute('data-block-id', b.id);
    if (!b.type) b.type = 'text-image';
    wrap.setAttribute('data-type', b.type);
    if (!b.free && b.w) wrap.style.maxWidth = b.w + 'px';
    var textHTML = b.html || '<h3>כותרת חדשה</h3><p>כאן אפשר לכתוב טקסט חופשי…</p>';
    var imgSrc  = b.img || IMG_PLACEHOLDER;
    /* שקיפות תמונה שמורה */
    var op = (b.imgOpacity != null ? b.imgOpacity : 1);
    var opStyle = 'opacity:' + op + ';';
    var hStyle = b.h ? 'height:'+b.h+'px;' : '';
    var imgStyleAttr = ' style="'+opStyle+hStyle+'"';
    var T = '<div class="cb-text">'+textHTML+'</div>';
    var inner = '';

    if (b.type === 'text'){
      inner = T;
    } else if (b.type === 'image'){
      inner = '<figure class="cb-figure"><img class="cb-img" src="'+imgSrc+'" alt=""'+imgStyleAttr+' />' +
              '<figcaption class="cb-cap">'+(b.caption||'כיתוב תמונה')+'</figcaption></figure>';
    } else if (b.type === 'text-side'){
      /* טקסט בצד התמונה */
      inner = '<div class="cb-split"><div class="cb-col">'+T+'</div>' +
              '<figure class="cb-figure"><img class="cb-img" src="'+imgSrc+'" alt=""'+imgStyleAttr+' /></figure></div>';
    } else if (b.type === 'text-below'){
      /* תמונה למעלה, טקסט מתחת (ממורכז) */
      inner = '<figure class="cb-figure"><img class="cb-img" src="'+imgSrc+'" alt=""'+imgStyleAttr+' /></figure>' +
              '<div class="cb-text cb-center">'+textHTML+'</div>';
    } else if (b.type === 'text-over'){
      /* טקסט מעל התמונה */
      inner = '<div class="cb-over">' +
                '<img class="cb-img" src="'+imgSrc+'" alt=""'+imgStyleAttr+' />' +
                '<div class="cb-over-text"><div class="cb-text">'+textHTML+'</div></div>' +
              '</div>';
    } else if (b.type === 'before-after'){
      /* השוואת לפני/אחרי עם וילון נגרר */
      var imgA = b.imgA || IMG_PLACEHOLDER;   /* אחרי (תמונת בסיס, מתחת) */
      var imgB = b.imgB || IMG_PLACEHOLDER;   /* לפני (נחשפת ע"י הווילון) */
      var labA = b.labelA || 'אחרי';
      var labB = b.labelB || 'לפני';
      var pos  = (b.split != null ? b.split : 50);
      var hPx  = b.h ? b.h : 380;
      var titleHTML = b.html || '<h3>לפני ואחרי</h3>';
      inner = '<div class="cb-text cb-center cb-ba-title">'+titleHTML+'</div>' +
        '<div class="cb-ba" style="height:'+hPx+'px">' +
          '<img class="cb-ba-img cb-ba-after" data-baimg="A" src="'+imgA+'" alt="" />' +
          '<img class="cb-ba-img cb-ba-before" data-baimg="B" src="'+imgB+'" alt="" style="clip-path:inset(0 '+(100-pos)+'% 0 0)" />' +
          '<span class="cb-ba-lab cb-ba-lab-b">'+labB+'</span>' +
          '<span class="cb-ba-lab cb-ba-lab-a">'+labA+'</span>' +
          '<div class="cb-ba-handle" style="left:'+pos+'%"><span>⇄</span></div>' +
        '</div>';
    } else { /* text-image (ברירת מחדל = טקסט בצד) */
      b.type = 'text-side';
      wrap.setAttribute('data-type','text-side');
      inner = '<div class="cb-split"><div class="cb-col">'+T+'</div>' +
              '<figure class="cb-figure"><img class="cb-img" src="'+imgSrc+'" alt=""'+imgStyleAttr+' /></figure></div>';
    }
    wrap.innerHTML = '<div class="cb-inner">'+inner+'</div>';
    if (b.type === 'before-after') wireBeforeAfter(wrap, b);   /* וילון — פעיל גם למבקר */
    if (adminOn) addBlockControls(wrap, b, pid, idx, total);
    return wrap;
  }

  /* ---------- וילון "לפני/אחרי" ---------- */
  function wireBeforeAfter(wrap, b){
    var ba = wrap.querySelector('.cb-ba'); if (!ba) return;
    var beforeImg = ba.querySelector('.cb-ba-before');
    var handle = ba.querySelector('.cb-ba-handle');
    function setSplit(pct){
      pct = Math.max(0, Math.min(100, pct));
      b.split = pct;
      beforeImg.style.clipPath = 'inset(0 ' + (100-pct) + '% 0 0)';
      handle.style.left = pct + '%';
    }
    function startDrag(e){
      e.preventDefault();
      var rect = ba.getBoundingClientRect();
      function move(ev){
        var cx = (ev.touches ? ev.touches[0].clientX : ev.clientX);
        setSplit(((cx - rect.left) / rect.width) * 100);
      }
      function end(){
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', end);
        if (adminOn) { clearTimeout(wrap._st); wrap._st = setTimeout(saveBlocks, 300); }
      }
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', end);
    }
    handle.addEventListener('pointerdown', startDrag);
    /* קליק על הפס מזיז ישירות */
    ba.addEventListener('pointerdown', function(e){
      if (e.target.closest('.cb-ba-handle')) return;
      if (e.target.closest('.cb-ba-img') && adminOn) return; /* באדמין: קליק על תמונה = העלאה */
      var rect = ba.getBoundingClientRect();
      setSplit(((e.clientX - rect.left) / rect.width) * 100);
      startDrag(e);
    });
  }

  function addBlockControls(wrap, b, pid, idx, total){
    wrap.classList.add('cb-editing');

    /* סרגל כלים עליון: ידית-גרירה · בורר סוג · עיגון · מחיקה */
    var TYPES = [
      {t:'text',       i:'¶',  l:'טקסט'},
      {t:'image',      i:'🖼', l:'תמונה'},
      {t:'text-side',  i:'⊟',  l:'טקסט בצד'},
      {t:'text-below', i:'⊏',  l:'טקסט למטה'},
      {t:'text-over',  i:'▦',  l:'טקסט על התמונה'},
      {t:'before-after', i:'⇄', l:'לפני / אחרי'}
    ];
    var typeBtns = TYPES.map(function(o){
      return '<button class="cb-tbtn'+(b.type===o.t?' on':'')+'" data-type="'+o.t+'" title="'+o.l+'">'+o.i+'</button>';
    }).join('');
    var hasImg = (b.type !== 'text');
    var opVal = (b.imgOpacity != null ? b.imgOpacity : 1);
    var opCtl = hasImg ?
      '<span class="cb-op" title="שקיפות התמונה">🌫' +
        '<input type="range" class="cb-op-range" min="0" max="100" value="'+Math.round(opVal*100)+'" />' +
      '</span>' : '';
    /* בלוק לפני/אחרי — שני כפתורי העלאה מפורשים */
    var baCtl = (b.type === 'before-after') ?
      '<button class="cb-ctl" data-baup="imgB" title="העלאת התמונה הראשונה">📷 לפני</button>' +
      '<button class="cb-ctl" data-baup="imgA" title="העלאת התמונה השנייה">📷 אחרי</button>' : '';
    var bar = el('div','cb-bar');
    bar.innerHTML =
      '<button class="cb-ctl cb-drag" data-drag title="גררו כדי להזיז">✥ הזז</button>' +
      '<span class="cb-types-inline">' + typeBtns + '</span>' +
      baCtl + opCtl +
      '<span class="cb-bar-sp"></span>' +
      (b.free ? '<button class="cb-ctl" data-anchor title="החזר לזרימת העמוד">📌 עגן</button>' : '') +
      '<button class="cb-ctl danger" data-del title="מחיקת הבלוק">🗑 מחק</button>';
    wrap.appendChild(bar);
    bar.addEventListener('click', function(e){
      var tb = e.target.closest('[data-type]');
      if (tb){ b.type = tb.dataset.type; saveBlocks(); renderBlocks(); return; }
      var up = e.target.closest('[data-baup]');
      if (up){
        var field = up.dataset.baup;
        var sel = field === 'A' || field === 'imgA' ? '.cb-ba-after' : '.cb-ba-before';
        blockImgTarget = { pid: pid, id: b.id, el: wrap.querySelector(sel), field: field };
        document.getElementById('admImgInput').click();
        return;
      }
      if (e.target.closest('[data-del]')){ deleteBlock(pid, b.id); return; }
      if (e.target.closest('[data-anchor]')){ b.free=false; b.x=null; b.y=null; saveBlocks(); renderBlocks(); return; }
    });
    /* מחוון שקיפות תמונה — חי, בלי רינדור מחדש */
    var opRange = bar.querySelector('.cb-op-range');
    if (opRange){
      opRange.addEventListener('input', function(){
        b.imgOpacity = (+opRange.value) / 100;
        wrap.querySelectorAll('.cb-img').forEach(function(im){ im.style.opacity = b.imgOpacity; });
        clearTimeout(wrap._ot); wrap._ot = setTimeout(saveBlocks, 400);
      });
      /* לא לגרור את הבלוק כששולטים במחוון */
      opRange.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
    }

    /* גרירה חופשית — מהידית בלבד */
    var handle = bar.querySelector('[data-drag]');
    if (handle) enableDrag(handle, wrap, b, pid);

    /* טקסט נערך */
    wrap.querySelectorAll('.cb-text, .cb-cap').forEach(function(t){
      t.setAttribute('contenteditable','true');
      t.setAttribute('data-editable','');
      t.addEventListener('input', function(){
        if (t.classList.contains('cb-cap')) b.caption = t.textContent;
        else b.html = t.innerHTML;
        markBlocksDirty();
      });
      t.addEventListener('mouseup', onSelect);
      t.addEventListener('keyup', onSelect);
    });

    /* תמונה רגילה ניתנת להחלפה */
    var img = wrap.querySelector('.cb-img');
    if (img){
      img.setAttribute('data-img','');
      img.addEventListener('click', function(e){
        e.preventDefault();
        blockImgTarget = { pid: pid, id: b.id, el: img, field: 'img' };
        document.getElementById('admImgInput').click();
      });
    }
    /* שתי תמונות בבלוק לפני/אחרי */
    wrap.querySelectorAll('.cb-ba-img').forEach(function(bimg){
      bimg.setAttribute('data-img','');
      bimg.style.cursor = 'pointer';
      bimg.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        var field = bimg.getAttribute('data-baimg') === 'A' ? 'imgA' : 'imgB';
        blockImgTarget = { pid: pid, id: b.id, el: bimg, field: field };
        document.getElementById('admImgInput').click();
      });
    });
    /* תוויות לפני/אחרי ניתנות לעריכה */
    var labA = wrap.querySelector('.cb-ba-lab-a'), labB = wrap.querySelector('.cb-ba-lab-b');
    if (labA){ labA.setAttribute('contenteditable','true'); labA.addEventListener('input', function(){ b.labelA = labA.textContent; markBlocksDirty(); }); labA.addEventListener('pointerdown', function(e){ e.stopPropagation(); }); }
    if (labB){ labB.setAttribute('contenteditable','true'); labB.addEventListener('input', function(){ b.labelB = labB.textContent; markBlocksDirty(); }); labB.addEventListener('pointerdown', function(e){ e.stopPropagation(); }); }

    /* שמירת גודל לאחר שינוי (גרירת פינה) */
    if (window.ResizeObserver){
      var ro = new ResizeObserver(function(){
        if (!wrap.offsetWidth) return;
        b.w = Math.round(wrap.offsetWidth);
        clearTimeout(wrap._rt); wrap._rt = setTimeout(saveBlocks, 500);
      });
      ro.observe(wrap);
    }
  }

  /* ---------- מנגנון גרירה חופשית ---------- */
  function enableDrag(handle, wrap, b, pid){
    handle.style.touchAction = 'none';
    handle.addEventListener('pointerdown', function(e){
      e.preventDefault(); e.stopPropagation();
      var page = document.getElementById(pid);
      if (!page) return;

      /* בפעם הראשונה — הופכים לצף וממקמים במיקום הנוכחי */
      if (!b.free){
        var pr0 = page.getBoundingClientRect();
        var wr0 = wrap.getBoundingClientRect();
        b.free = true;
        b.x = ((wr0.left - pr0.left) / pr0.width) * 100;
        b.y = ((wr0.top  - pr0.top ) / pr0.height) * 100;
        b.w = Math.round(wr0.width);
        page.appendChild(wrap);
        applyFreePos(wrap, b);
      }

      wrap.classList.add('cb-dragging');
      var pr = page.getBoundingClientRect();
      var wr = wrap.getBoundingClientRect();
      var offX = e.clientX - wr.left;
      var offY = e.clientY - wr.top;

      function move(ev){
        var x = ev.clientX - pr.left - offX;
        var y = ev.clientY - pr.top  - offY;
        /* גבולות */
        x = Math.max(0, Math.min(x, pr.width  - wr.width));
        y = Math.max(0, Math.min(y, pr.height - wr.height));
        b.x = (x / pr.width)  * 100;
        b.y = (y / pr.height) * 100;
        wrap.style.left = b.x + '%';
        wrap.style.right = 'auto';
        wrap.style.top = b.y + '%';
      }
      function up(){
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        wrap.classList.remove('cb-dragging');
        saveBlocks();
      }
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });
  }

  var blocksDirtyTimer = null;
  function markBlocksDirty(){
    setStatus('עריכה…');
    clearTimeout(blocksDirtyTimer);
    blocksDirtyTimer = setTimeout(saveBlocks, 700);
  }

  function findBlock(pid, id){
    var list = blocks[pid] || [];
    for (var i=0;i<list.length;i++) if (list[i].id===id) return {list:list, i:i, b:list[i]};
    return null;
  }
  function deleteBlock(pid, id){
    var f = findBlock(pid, id); if(!f) return;
    if (!window.confirm('למחוק את הבלוק הזה? לא ניתן לבטל.')) return;
    f.list.splice(f.i, 1);
    saveBlocks();
    renderBlocks();
    setStatus('הבלוק נמחק', true);
  }
  function moveBlock(pid, id, dir){
    var f = findBlock(pid, id); if(!f) return;
    var j = dir==='up' ? f.i-1 : f.i+1;
    if (j<0 || j>=f.list.length) return;
    var tmp = f.list[j]; f.list[j]=f.list[f.i]; f.list[f.i]=tmp;
    saveBlocks(); renderBlocks();
  }

  /* הוספת בלוק — מיידי, גלוי בראש הפרק הנוכחי */
  function addBlockFlow(){
    var active = document.querySelector('.page.active');
    addBlock(active ? active.id : 'home');
  }
  function addBlock(pid){
    blocks[pid] = blocks[pid] || [];
    var nb = { id: uid(), type: 'text-image', html:'', img:'', caption:'' };
    blocks[pid].unshift(nb);     /* חדש בראש — גלוי מיד */
    saveBlocks();
    renderBlocks();
    setTimeout(function(){
      var node = document.querySelector('[data-block-id="'+nb.id+'"]');
      if (node){
        node.scrollIntoView({behavior:'smooth', block:'center'});
        node.classList.add('cb-flash');
        setTimeout(function(){ node.classList.remove('cb-flash'); }, 1400);
      }
    }, 60);
    setStatus('בלוק נוסף — גררו ב"✥ הזז" למיקום הרצוי', true);
  }

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
