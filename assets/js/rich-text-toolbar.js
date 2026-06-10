/* =========================================================
   Marvah — Rich text toolbar
   Floating toolbar appears when admin selects text inside a
   contenteditable element. Supports B/I/U, font size (3 levels),
   color, alignment, and clear formatting.
   ========================================================= */
(function () {
  'use strict';

  let toolbar = null;
  let suppressHide = false;
  // When the user manually drags the toolbar, we stop auto-repositioning it
  // so it stays where they put it. Resets when the toolbar hides.
  let toolbarManuallyMoved = false;
  // Last selection range inside an editable. We save it because clicking the
  // numeric font-size input moves focus out of the contenteditable and the
  // browser collapses the visible selection — but we still want to apply the
  // size to the originally-selected text.
  let savedRange = null;
  let savedEditable = null;

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  // Strip a specific inline style property from every descendant of an element.
  // Used after wrapping a selection so any nested span (e.g. from a Word paste)
  // doesn't override the new wrapper's font-family/color/size.
  function clearInlineProp(rootEl, propName) {
    rootEl.querySelectorAll('[style]').forEach(el => {
      if (el.style[propName]) {
        el.style[propName] = '';
        if (!el.getAttribute('style')) el.removeAttribute('style');
      }
    });
  }

  // Hebrew font families available in the toolbar's font picker. Loaded
  // lazily when the toolbar first appears so non-admin pages don't pay the
  // page-load cost. The CSS family stack always falls back to Heebo + system.
  // Decorative shapes/symbols available in the "shapes" picker. All are
  // single Unicode characters so they're inserted as plain text — no special
  // HTML, no fonts to load.
  // Each direction-bearing symbol is paired with its mirror so the user has
  // a left-pointing match for every right-pointing arrow/finger/triangle.
  const SHAPES = [
    '★', '☆', '✦', '✧', '✱', '✸', '✶', '✺',
    '❋', '✿', '❀', '❁', '✤', '✥', '❖', '⊛',
    '◆', '◇', '◊', '▲', '▼', '●', '○', '◯',
    '▶', '◀', '➡', '⬅', '☞', '☜', '✓', '✗',
  ];

  const FONT_OPTIONS = [
    { label: 'ברירת מחדל', value: '' },
    { label: 'Heebo', value: '"Heebo", sans-serif', google: false },
    { label: 'Assistant', value: '"Assistant", sans-serif', google: 'Assistant:wght@300;400;500;600;700' },
    { label: 'Rubik', value: '"Rubik", sans-serif', google: 'Rubik:wght@300;400;500;600;700' },
    { label: 'Frank Ruhl Libre', value: '"Frank Ruhl Libre", serif', google: false },
    { label: 'David Libre', value: '"David Libre", serif', google: 'David+Libre:wght@400;500;700' },
    { label: 'Suez One', value: '"Suez One", serif', google: 'Suez+One' },
    { label: 'Cormorant Garamond', value: '"Cormorant Garamond", serif', google: false },
    /* גופני Windows מקומיים (ללא טעינה מהרשת) */
    { label: 'דוד (David)', value: '"David", serif', google: false },
    { label: 'נרקיסים', value: '"Narkisim", sans-serif', google: false },
    { label: 'פרנק-רוהל', value: '"FrankRuehl", serif', google: false },
    { label: 'מרים', value: '"Miriam", sans-serif', google: false },
    { label: 'לבנים', value: '"Levenim MT", sans-serif', google: false },
    { label: 'גישה', value: '"Gisha", sans-serif', google: false },
    { label: 'רוד', value: '"Rod", monospace', google: false },
    { label: 'אהרוני', value: '"Aharoni", sans-serif', google: false },
    { label: 'גוטמן יד', value: '"Guttman Yad", serif', google: false },
    { label: 'Arial', value: '"Arial", sans-serif', google: false },
    { label: 'Tahoma', value: '"Tahoma", sans-serif', google: false },
    { label: 'Segoe UI', value: '"Segoe UI", sans-serif', google: false },
    { label: 'Calibri', value: '"Calibri", sans-serif', google: false },
    { label: 'Cambria', value: '"Cambria", serif', google: false },
    { label: 'Times New Roman', value: '"Times New Roman", serif', google: false },
    { label: 'Georgia', value: '"Georgia", serif', google: false },
    { label: 'Verdana', value: '"Verdana", sans-serif', google: false },
    { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif', google: false },
    { label: 'Courier New', value: '"Courier New", monospace', google: false },
    { label: 'Impact', value: '"Impact", sans-serif', google: false },
  ];

  // Mutable list backing the searchable font combobox (built-ins first; the
  // user's installed fonts get appended when they choose to load them).
  const fontList = FONT_OPTIONS.map(f => ({ label: f.label, value: f.value }));

  let extraFontsLoaded = false;
  function loadExtraFonts() {
    if (extraFontsLoaded) return;
    extraFontsLoaded = true;
    const families = FONT_OPTIONS.filter(f => f.google).map(f => 'family=' + f.google).join('&');
    if (!families) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?' + families + '&display=swap';
    document.head.appendChild(link);
  }

  function ensureToolbar() {
    if (toolbar) return toolbar;
    loadExtraFonts();
    toolbar = document.createElement('div');
    toolbar.className = 'rich-toolbar';
    toolbar.setAttribute('dir', 'rtl');
    toolbar.innerHTML = `
      <span class="rt-drag-handle" title="גרור להזזה" aria-label="גרור"></span>
      <button type="button" data-cmd="bold" title="הדגשה (Ctrl+B)"><b>B</b></button>
      <button type="button" data-cmd="italic" title="הטיה (Ctrl+I)"><em>I</em></button>
      <button type="button" data-cmd="underline" title="קו תחתי (Ctrl+U)"><u>U</u></button>
      <span class="rt-sep"></span>
      <span class="rt-font" title="גופן — הקלידו לחיפוש">
        <input type="text" class="rt-font-input" placeholder="גופן…" aria-label="חיפוש גופן" autocomplete="off">
        <div class="rt-font-list" role="listbox"></div>
      </span>
      <span class="rt-sep"></span>
      <span class="rt-size-wrap" title="גודל גופן (8-72)">
        <input type="number" min="8" max="72" step="1" value="16" class="rt-size-input" inputmode="numeric" aria-label="גודל גופן">
        <span class="rt-size-unit">px</span>
      </span>
      <select class="rt-leading-select" aria-label="מרווח בין שורות" title="מרווח בין שורות">
        <option value="">מרווח שורות</option>
        <option value="1">1.0 (צפוף)</option>
        <option value="1.15">1.15</option>
        <option value="1.3">1.3</option>
        <option value="1.5">1.5</option>
        <option value="1.75">1.75</option>
        <option value="2">2.0 (רחב)</option>
      </select>
      <span class="rt-sep"></span>
      <span class="rt-color">
        <button type="button" class="rt-color-btn" title="צבע גופן">
          <span class="rt-color-letter">A</span>
          <span class="rt-color-bar" id="rtColorBar"></span>
        </button>
        <div class="rt-palette" role="dialog" aria-label="בחר צבע">
          <div class="rt-palette-grid">
            <button type="button" data-color="" title="ברירת מחדל" class="rt-swatch rt-swatch-default"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="3" x2="21" y2="21"/><line x1="21" y1="3" x2="3" y2="21"/></svg></button>
            <button type="button" data-color="#1F2A33" title="שחור" class="rt-swatch" style="background:#1F2A33;"></button>
            <button type="button" data-color="#6B7280" title="אפור" class="rt-swatch" style="background:#6B7280;"></button>
            <button type="button" data-color="#FFFFFF" title="לבן" class="rt-swatch rt-swatch-light" style="background:#FFFFFF;"></button>
            <button type="button" data-color="#695C4B" title="חום" class="rt-swatch" style="background:#695C4B;"></button>
            <button type="button" data-color="#B59A77" title="חול" class="rt-swatch" style="background:#B59A77;"></button>
            <button type="button" data-color="#D4A847" title="זהב" class="rt-swatch" style="background:#D4A847;"></button>
            <button type="button" data-color="#D9743F" title="כתום" class="rt-swatch" style="background:#D9743F;"></button>

            <button type="button" data-color="#913232" title="ארגמן" class="rt-swatch" style="background:#913232;"></button>
            <button type="button" data-color="#B07070" title="ורוד עפר" class="rt-swatch" style="background:#B07070;"></button>
            <button type="button" data-color="#6B4A6E" title="שזיף" class="rt-swatch" style="background:#6B4A6E;"></button>
            <button type="button" data-color="#41576A" title="כחול אבק" class="rt-swatch" style="background:#41576A;"></button>
            <button type="button" data-color="#5E89B0" title="תכלת" class="rt-swatch" style="background:#5E89B0;"></button>
            <button type="button" data-color="#4A8B8B" title="טורקיז" class="rt-swatch" style="background:#4A8B8B;"></button>
            <button type="button" data-color="#7C8E73" title="ירוק מרווה" class="rt-swatch" style="background:#7C8E73;"></button>
            <button type="button" data-color="#5A8F5A" title="ירוק יער" class="rt-swatch" style="background:#5A8F5A;"></button>
          </div>
          <label class="rt-color-custom" title="צבע מותאם">
            <input type="color" class="rt-color-custom-input" value="#7C8E73" aria-label="בחר צבע מותאם">
            <span class="rt-color-custom-label">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              צבע מותאם
            </span>
          </label>
        </div>
      </span>
      <span class="rt-sep"></span>
      <span class="rt-bg">
        <button type="button" class="rt-bg-btn" title="רקע הטקסט (צבע + אטימות)">
          <span class="rt-bg-letter">▦</span>
          <span class="rt-bg-bar" id="rtBgBar"></span>
        </button>
        <div class="rt-palette rt-bg-palette" role="dialog" aria-label="רקע הטקסט">
          <div class="rt-palette-grid">
            <button type="button" data-bg="" title="ללא רקע" class="rt-swatch rt-swatch-default"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="3" x2="21" y2="21"/><line x1="21" y1="3" x2="3" y2="21"/></svg></button>
            <button type="button" data-bg="#1F2A33" title="שחור" class="rt-swatch" style="background:#1F2A33;"></button>
            <button type="button" data-bg="#FFFFFF" title="לבן" class="rt-swatch rt-swatch-light" style="background:#FFFFFF;"></button>
            <button type="button" data-bg="#695C4B" title="חום" class="rt-swatch" style="background:#695C4B;"></button>
            <button type="button" data-bg="#B59A77" title="חול" class="rt-swatch" style="background:#B59A77;"></button>
            <button type="button" data-bg="#D4A847" title="זהב" class="rt-swatch" style="background:#D4A847;"></button>
            <button type="button" data-bg="#41576A" title="כחול אבק" class="rt-swatch" style="background:#41576A;"></button>
            <button type="button" data-bg="#7C8E73" title="ירוק מרווה" class="rt-swatch" style="background:#7C8E73;"></button>
          </div>
          <label class="rt-bg-opacity-row">
            <span class="rt-bg-opacity-label">אטימות</span>
            <input type="range" class="rt-bg-opacity" min="0" max="100" step="5" value="100">
            <span class="rt-bg-opacity-val">100%</span>
          </label>
          <label class="rt-color-custom" title="צבע רקע מותאם">
            <input type="color" class="rt-bg-custom-input" value="#FFFFFF" aria-label="בחר צבע רקע">
            <span class="rt-color-custom-label">צבע מותאם</span>
          </label>
        </div>
      </span>
      <span class="rt-sep"></span>
      <button type="button" data-align="right" title="יישור לימין">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="12" x2="9" y2="12"/><line x1="21" y1="18" x2="6" y2="18"/></svg>
      </button>
      <button type="button" data-align="center" title="מרכז">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="6" x2="3" y2="6"/><line x1="18" y1="12" x2="6" y2="12"/><line x1="20" y1="18" x2="4" y2="18"/></svg>
      </button>
      <button type="button" data-align="left" title="יישור לשמאל">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="6" x2="3" y2="6"/><line x1="15" y1="12" x2="3" y2="12"/><line x1="18" y1="18" x2="3" y2="18"/></svg>
      </button>
      <span class="rt-sep"></span>
      <span class="rt-shapes">
        <button type="button" class="rt-shapes-btn" title="הוסף סמל / צורה">✦</button>
        <div class="rt-shapes-palette" role="dialog" aria-label="בחר סמל">
          <div class="rt-shapes-grid">
            ${SHAPES.map(s => `<button type="button" class="rt-shape" data-shape="${s}" title="${s}">${s}</button>`).join('')}
          </div>
        </div>
      </span>
      <span class="rt-sep"></span>
      <button type="button" data-cmd="removeFormat" title="נקה עיצוב">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="7" x2="20" y2="7"/><line x1="10" y1="11" x2="14" y2="11"/><line x1="6" y1="15" x2="18" y2="15"/><line x1="3" y1="3" x2="21" y2="21"/></svg>
      </button>
    `;
    document.body.appendChild(toolbar);

    // ---- Drag the toolbar by its handle ----
    const dragHandle = toolbar.querySelector('.rt-drag-handle');
    if (dragHandle) {
      dragHandle.addEventListener('pointerdown', e => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const rect = toolbar.getBoundingClientRect();
        const origLeft = rect.left + window.scrollX;
        const origTop = rect.top + window.scrollY;
        toolbar.classList.add('is-dragging');

        function onMove(ev) {
          const left = origLeft + (ev.clientX - startX);
          const top = origTop + (ev.clientY - startY);
          toolbar.style.left = Math.max(8, left) + 'px';
          toolbar.style.top = Math.max(8, top) + 'px';
          toolbarManuallyMoved = true;
        }
        function onUp() {
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
          toolbar.classList.remove('is-dragging');
        }
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      });
    }

    // Prevent toolbar interactions from blurring the selection
    toolbar.addEventListener('mousedown', e => {
      // Don't preventDefault on inputs (number input + color picker) so the
      // user can actually focus and type into them. We restore the selection
      // when they apply the change.
      if (e.target.closest('button')) e.preventDefault();
    });

    // ----- Shapes picker (click-to-toggle) -----
    const shapesWrap = toolbar.querySelector('.rt-shapes');
    const shapesBtn = toolbar.querySelector('.rt-shapes-btn');
    if (shapesBtn && shapesWrap) {
      shapesBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        shapesWrap.classList.toggle('is-open');
      });
      // Insert the chosen shape at the current selection position
      shapesWrap.querySelectorAll('.rt-shape').forEach(btn => {
        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          insertShape(btn.dataset.shape);
          shapesWrap.classList.remove('is-open');
        });
      });
      document.addEventListener('mousedown', e => {
        if (!shapesWrap.contains(e.target)) {
          shapesWrap.classList.remove('is-open');
        }
      });
    }

    // ----- Color picker (click-to-toggle, not hover) -----
    // Hover-based palette closes when the cursor crosses the gap to a swatch,
    // which is exactly the bug the user hit. Switching to click-toggle fixes it
    // and also works on touch devices.
    const colorWrap = toolbar.querySelector('.rt-color');
    const colorBtn = toolbar.querySelector('.rt-color-btn');
    if (colorBtn && colorWrap) {
      colorBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        colorWrap.classList.toggle('is-open');
      });

      // Close palette when clicking anywhere outside it
      document.addEventListener('mousedown', e => {
        if (!colorWrap.contains(e.target)) {
          colorWrap.classList.remove('is-open');
        }
      });
    }

    // Native color picker — apply on input (live as user drags) and on change
    const customInput = toolbar.querySelector('.rt-color-custom-input');
    if (customInput) {
      // Don't preventDefault on the input itself (would block focus)
      customInput.addEventListener('mousedown', e => e.stopPropagation());
      customInput.addEventListener('input', () => {
        applyColor(customInput.value);
        const bar = document.getElementById('rtColorBar');
        if (bar) bar.style.background = customInput.value;
      });
      customInput.addEventListener('change', () => {
        // Closing the system picker — keep palette open so user sees result
      });
    }

    // ----- Text background color + opacity (block-level rectangle) -----
    const bgWrap = toolbar.querySelector('.rt-bg');
    const bgBtn = toolbar.querySelector('.rt-bg-btn');
    if (bgBtn && bgWrap) {
      bgBtn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        bgWrap.classList.toggle('is-open');
      });
      document.addEventListener('mousedown', e => {
        if (!bgWrap.contains(e.target)) bgWrap.classList.remove('is-open');
      });
    }
    let bgColor = '#FFFFFF';
    const bgOpacity = toolbar.querySelector('.rt-bg-opacity');
    const bgOpacityVal = toolbar.querySelector('.rt-bg-opacity-val');
    const bgCustom = toolbar.querySelector('.rt-bg-custom-input');
    function applyCurrentBg() {
      const op = bgOpacity ? bgOpacity.value : 100;
      applyBgColor(bgColor, op, false);
      const bar = document.getElementById('rtBgBar');
      if (bar) bar.style.background = bgColor;
    }
    if (bgOpacity) {
      bgOpacity.addEventListener('mousedown', e => e.stopPropagation());
      bgOpacity.addEventListener('input', () => {
        if (bgOpacityVal) bgOpacityVal.textContent = bgOpacity.value + '%';
        applyCurrentBg();
      });
    }
    if (bgCustom) {
      bgCustom.addEventListener('mousedown', e => e.stopPropagation());
      bgCustom.addEventListener('input', () => { bgColor = bgCustom.value; applyCurrentBg(); });
    }
    if (bgWrap) {
      bgWrap.querySelectorAll('[data-bg]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation();
          const c = btn.dataset.bg;
          if (!c) {
            applyBgColor('', 0, true);
            const bar = document.getElementById('rtBgBar'); if (bar) bar.style.background = 'transparent';
          } else {
            bgColor = c;
            if (bgCustom) bgCustom.value = c;
            applyCurrentBg();
          }
        });
      });
    }

    // Line height (leading) select — applies to nearest block ancestors
    const leadingSelect = toolbar.querySelector('.rt-leading-select');
    if (leadingSelect) {
      leadingSelect.addEventListener('change', () => {
        applyLineHeight(leadingSelect.value);
        leadingSelect.value = '';
      });
      leadingSelect.addEventListener('mousedown', e => e.stopPropagation());
      leadingSelect.addEventListener('focus', () => { suppressHide = true; });
      leadingSelect.addEventListener('blur', () => {
        setTimeout(() => { suppressHide = false; }, 150);
      });
    }

    // Font family combobox — type to filter the list
    const fontWrap = toolbar.querySelector('.rt-font');
    const fontInput = toolbar.querySelector('.rt-font-input');
    const fontListEl = toolbar.querySelector('.rt-font-list');
    if (fontWrap && fontInput) {
      fontInput.addEventListener('mousedown', e => e.stopPropagation());
      fontInput.addEventListener('focus', () => {
        suppressHide = true;
        fontWrap.classList.add('is-open');
        renderFontList(fontInput.value);
      });
      fontInput.addEventListener('input', () => {
        fontWrap.classList.add('is-open');
        renderFontList(fontInput.value);
      });
      fontInput.addEventListener('keydown', e => {
        if (e.key === 'Escape') { fontWrap.classList.remove('is-open'); fontInput.blur(); }
        else if (e.key === 'Enter') {
          e.preventDefault();
          const first = fontListEl && fontListEl.querySelector('.rt-font-opt:not(.rt-font-load)');
          if (first) first.click();
        }
      });
      fontInput.addEventListener('blur', () => {
        setTimeout(() => { suppressHide = false; fontWrap.classList.remove('is-open'); }, 200);
      });
      if (fontListEl) fontListEl.addEventListener('mousedown', e => e.stopPropagation());
      document.addEventListener('mousedown', e => {
        if (!fontWrap.contains(e.target)) fontWrap.classList.remove('is-open');
      });
    }

    // Number input — apply font size on change/Enter
    const sizeInput = toolbar.querySelector('.rt-size-input');
    if (sizeInput) {
      const apply = () => {
        const v = clamp(parseInt(sizeInput.value, 10) || 16, 8, 72);
        sizeInput.value = v;
        applyFontSize(v);
      };
      sizeInput.addEventListener('change', apply);
      sizeInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); apply(); sizeInput.blur(); }
      });
      // Hold the toolbar open while the user fiddles with the input
      sizeInput.addEventListener('focus', () => { suppressHide = true; });
      sizeInput.addEventListener('blur', () => {
        setTimeout(() => { suppressHide = false; }, 150);
      });
    }

    toolbar.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      e.stopPropagation();

      const editable = currentEditable();
      if (!editable) return;
      // Re-focus to ensure the selection is restored
      // (handled by mousedown preventDefault)

      const cmd = btn.dataset.cmd;
      const color = btn.dataset.color;
      const align = btn.dataset.align;

      try {
        if (cmd) {
          document.execCommand(cmd, false);
        } else if (color !== undefined) {
          applyColor(color);
          // Close the palette after picking a swatch
          const wrap = toolbar.querySelector('.rt-color');
          if (wrap) wrap.classList.remove('is-open');
        } else if (align) {
          const map = { right: 'justifyRight', center: 'justifyCenter', left: 'justifyLeft' };
          document.execCommand(map[align], false);
        }
      } catch (err) {
        console.warn('Format command failed:', err);
      }

      // Trigger input event so page handlers save the new HTML
      editable.dispatchEvent(new Event('input', { bubbles: true }));
      updateActiveStates();
    });

    return toolbar;
  }

  function currentEditable() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const node = sel.anchorNode;
    if (!node) return null;
    const elem = node.nodeType === 1 ? node : node.parentElement;
    return elem ? elem.closest('[contenteditable="true"]') : null;
  }

  // Apply line-height to all block ancestors (P, H1..H6, LI, DIV) that
  // intersect the saved selection. Block-level is the right scope for
  // line-height because inline spans don't always respect it visually.
  // Empty value = remove inline line-height.
  function applyLineHeight(value) {
    if (!savedRange || !savedEditable) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);

    const range = sel.getRangeAt(0);
    const blocks = new Set();

    function nearestBlock(node) {
      if (node && node.nodeType === 3) node = node.parentElement;
      while (node && node !== savedEditable) {
        if (['P','H1','H2','H3','H4','H5','H6','LI','DIV','BLOCKQUOTE'].includes(node.tagName)) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    }

    const startBlock = nearestBlock(range.startContainer);
    const endBlock = nearestBlock(range.endContainer);
    if (startBlock) blocks.add(startBlock);
    if (endBlock) blocks.add(endBlock);

    if (!range.collapsed) {
      // Sweep all blocks the range crosses
      savedEditable.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, div, blockquote').forEach(el => {
        try { if (range.intersectsNode(el)) blocks.add(el); } catch (e) {}
      });
    }

    // If there was nothing block-level (e.g. raw text node directly inside
    // contenteditable), apply to the contenteditable itself as a fallback.
    if (blocks.size === 0) blocks.add(savedEditable);

    blocks.forEach(b => {
      if (value) b.style.lineHeight = value;
      else b.style.lineHeight = '';
      if (b !== savedEditable && !b.getAttribute('style')) b.removeAttribute('style');
    });

    savedEditable.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Load EVERY font installed on the user's computer via the Local Font Access
  // API. Works in Chrome/Edge over localhost or https and asks for a one-time
  // permission. If unavailable, the built-in list stays in place.
  let localFontsLoaded = false;

  // Render the combobox list, filtered by the typed query (substring, case-insensitive).
  function renderFontList(filter) {
    if (!toolbar) return;
    const list = toolbar.querySelector('.rt-font-list');
    if (!list) return;
    const q = (filter || '').trim().toLowerCase();
    list.innerHTML = '';
    if (!localFontsLoaded) {
      const load = document.createElement('button');
      load.type = 'button';
      load.className = 'rt-font-opt rt-font-load';
      load.textContent = '⋯ טען את כל הגופנים שלי';
      load.addEventListener('mousedown', e => e.preventDefault());
      load.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); loadLocalFonts(); });
      list.appendChild(load);
    }
    let shown = 0;
    fontList.forEach(f => {
      if (q && !f.label.toLowerCase().includes(q)) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rt-font-opt';
      b.textContent = f.label;
      if (f.value) { try { b.style.fontFamily = f.value; } catch (e) {} }
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        applyFontFamily(f.value);
        const input = toolbar.querySelector('.rt-font-input');
        if (input) input.value = f.label;
        const wrap = toolbar.querySelector('.rt-font');
        if (wrap) wrap.classList.remove('is-open');
      });
      list.appendChild(b);
      shown++;
    });
    if (!shown) {
      const none = document.createElement('div');
      none.className = 'rt-font-none';
      none.textContent = 'לא נמצא גופן בשם הזה';
      list.appendChild(none);
    }
  }

  // Load EVERY font installed on the user's computer via the Local Font Access
  // API (Chrome/Edge over localhost/https; one-time permission). Falls back to
  // the built-in list if unsupported or denied. The new families become
  // searchable in the combobox.
  async function loadLocalFonts() {
    if (localFontsLoaded) { renderFontList(''); return; }
    if (!window.queryLocalFonts) {
      alert('טעינת כל גופני המחשב נתמכת ב-Chrome / Edge בלבד (ומצריכה אישור). הגופנים שברשימה זמינים בכל מקרה.');
      return;
    }
    try {
      const fonts = await window.queryLocalFonts();
      const have = new Set(fontList.map(f => f.label));
      const fams = Array.from(new Set(fonts.map(f => f.family))).sort((a, b) => a.localeCompare(b, 'he'));
      fams.forEach(fam => {
        if (have.has(fam)) return;
        fontList.push({ label: fam, value: '"' + fam + '"' });
      });
      localFontsLoaded = true;
      renderFontList('');
      const input = toolbar && toolbar.querySelector('.rt-font-input');
      if (input) input.focus();
    } catch (e) {
      // permission denied / unavailable — keep the built-in list
    }
  }

  // Apply a background color with opacity to every block-level element that
  // intersects the selection (P/H1-6/LI/DIV/...). Produces a clean rectangle
  // behind the whole text block — ideal for laying text over an image.
  // clear=true removes the background. opacityPct: 0..100.
  function applyBgColor(hex, opacityPct, clear) {
    if (!savedRange || !savedEditable) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
    const range = sel.getRangeAt(0);

    const blocks = new Set();
    function nearestBlock(node) {
      if (node && node.nodeType === 3) node = node.parentElement;
      while (node && node !== savedEditable) {
        if (['P','H1','H2','H3','H4','H5','H6','LI','DIV','BLOCKQUOTE','FIGCAPTION'].includes(node.tagName)) return node;
        node = node.parentElement;
      }
      return null;
    }
    const sb = nearestBlock(range.startContainer);
    const eb = nearestBlock(range.endContainer);
    if (sb) blocks.add(sb);
    if (eb) blocks.add(eb);
    if (!range.collapsed) {
      savedEditable.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,div,blockquote,figcaption').forEach(el => {
        try { if (range.intersectsNode(el)) blocks.add(el); } catch (e) {}
      });
    }
    if (blocks.size === 0) blocks.add(savedEditable);

    let rgba = '';
    if (!clear && hex) {
      const a = clamp(parseInt(opacityPct, 10), 0, 100) / 100;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      rgba = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    }
    // Persistence note: the page saves the editable's innerHTML, which does NOT
    // include the editable element's OWN style attribute. So if the only target
    // is the editable itself, we wrap its content in a styled <div class="rt-bg-box">
    // that lives INSIDE innerHTML — otherwise the background (incl. 0% opacity)
    // is lost on reload and reverts to the default opaque background.
    const onlyEditable = (blocks.size === 1 && blocks.has(savedEditable));
    if (onlyEditable) {
      let box = savedEditable.querySelector(':scope > .rt-bg-box');
      if (clear) {
        if (box) { while (box.firstChild) savedEditable.insertBefore(box.firstChild, box); box.remove(); }
        savedEditable.style.backgroundColor = '';
      } else {
        if (!box) {
          // span (not div) so it's valid inside <p>/<h1> etc.; display:block makes
          // it a full-width rectangle behind the whole text.
          box = document.createElement('span');
          box.className = 'rt-bg-box';
          box.style.display = 'block';
          while (savedEditable.firstChild) box.appendChild(savedEditable.firstChild);
          savedEditable.appendChild(box);
        }
        box.style.backgroundColor = rgba;
      }
    } else {
      blocks.forEach(b => {
        b.style.backgroundColor = clear ? '' : rgba;
        if (b !== savedEditable && !b.getAttribute('style')) b.removeAttribute('style');
      });
    }
    savedEditable.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Insert a single shape character at the saved cursor position. We restore
  // the saved range first (the shapes button steals focus visually).
  function insertShape(ch) {
    if (!savedRange || !savedEditable) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
    document.execCommand('insertText', false, ch);
    if (sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
    savedEditable.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Apply a foreground color to the saved selection.
  // Uses `execCommand` because it correctly *splits* any ancestor styled
  // span (e.g. a Word/Google-Docs paste wrapper) so our new color isn't just
  // nested inside the existing one. styleWithCSS makes the output inline
  // `style="color:..."` instead of legacy <font color>.
  function applyColor(color) {
    if (!savedRange || !savedEditable) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);

    if (sel.getRangeAt(0).collapsed) return;

    try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
    if (color) {
      document.execCommand('foreColor', false, color);
      const bar = document.getElementById('rtColorBar');
      if (bar) bar.style.background = color;
    } else {
      document.execCommand('foreColor', false, 'inherit');
      const bar = document.getElementById('rtColorBar');
      if (bar) bar.style.background = 'var(--color-sage-500, #7C8E73)';
    }

    if (sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
    savedEditable.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Apply font-family using execCommand so ancestor styled spans get split
  // properly (the same reason as applyColor — Word/Docs pastes wrap text in
  // an outer span with their own font-family).
  function applyFontFamily(family) {
    if (!savedRange || !savedEditable) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);

    if (sel.getRangeAt(0).collapsed) return;

    try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
    if (family) {
      document.execCommand('fontName', false, family);
    } else {
      // "Reset" — apply an explicit `inherit` so the browser drops earlier inline values
      document.execCommand('fontName', false, 'inherit');
    }

    if (sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
    savedEditable.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Apply font-size in pixels. execCommand("fontSize") only accepts values
  // 1–7 (which map to keyword sizes), so we use it as a "marker": apply a
  // unique keyword, then post-process every span/font that just got that
  // keyword and replace it with our exact px size. This way the BROWSER
  // handles the splitting of ancestor styled spans, and we just override
  // the resulting element's font-size.
  function applyFontSize(px) {
    if (!savedRange || !savedEditable) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);

    if (sel.getRangeAt(0).collapsed) return;

    try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
    document.execCommand('fontSize', false, '7'); // produces inline font-size: xx-large

    // Replace every just-created xx-large with our target px size
    savedEditable.querySelectorAll('[style*="xx-large"]').forEach(el => {
      el.style.fontSize = px + 'px';
    });

    if (sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
    savedEditable.dispatchEvent(new Event('input', { bubbles: true }));
    updateActiveStates();
  }

  function updateActiveStates() {
    if (!toolbar) return;
    ['bold', 'italic', 'underline'].forEach(c => {
      const btn = toolbar.querySelector(`[data-cmd="${c}"]`);
      if (btn) btn.classList.toggle('is-active', document.queryCommandState(c));
    });

    // Reflect the selection's computed font-size in the input (unless the
    // user is currently typing into it).
    const sizeInput = toolbar.querySelector('.rt-size-input');
    if (sizeInput && document.activeElement !== sizeInput && savedRange) {
      let node = savedRange.startContainer;
      if (node && node.nodeType === 3) node = node.parentElement;
      if (node && node.nodeType === 1) {
        const fs = parseFloat(getComputedStyle(node).fontSize);
        if (!isNaN(fs)) sizeInput.value = clamp(Math.round(fs), 8, 72);
      }
    }

    // Reflect current font-family in the select. We try to match the computed
    // font-family against one of our known options; if no match, leave the
    // select on "default".
    const fontInput = toolbar.querySelector('.rt-font-input');
    if (fontInput && document.activeElement !== fontInput && savedRange) {
      let node = savedRange.startContainer;
      if (node && node.nodeType === 3) node = node.parentElement;
      if (node && node.nodeType === 1) {
        const ff = getComputedStyle(node).fontFamily.toLowerCase();
        let matchedLabel = '';
        for (const opt of fontList) {
          if (!opt.value) continue;
          const name = opt.value.split(',')[0].replace(/"/g, '').trim().toLowerCase();
          if (ff.includes(name)) { matchedLabel = opt.label; break; }
        }
        fontInput.value = matchedLabel;
      }
    }
  }

  function showToolbar() {
    if (!document.body.classList.contains('admin-mode')) {
      hideToolbar();
      return;
    }
    // If the user is currently interacting with the toolbar (e.g., typing in
    // the size input), don't recompute visibility from selection — selection
    // appears collapsed when focus moves to a non-contenteditable input.
    if (toolbar && toolbar.contains(document.activeElement)) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { hideToolbar(); return; }
    const range = sel.getRangeAt(0);
    const editable = currentEditable();
    if (!editable) { hideToolbar(); return; }

    // Save the live selection (collapsed cursor or selection) so toolbar
    // controls can apply at the saved position. We show the toolbar even
    // for a bare cursor so insert-shape and similar work without requiring
    // the user to select text first.
    savedRange = range.cloneRange();
    savedEditable = editable;

    ensureToolbar();
    toolbar.classList.add('is-visible');

    // If the user has manually dragged the toolbar, leave it where they put it
    // and just refresh the active states. Auto-positioning resumes after the
    // toolbar hides (see hideToolbar — it resets toolbarManuallyMoved).
    if (toolbarManuallyMoved) {
      updateActiveStates();
      return;
    }

    // Get position rect — for a collapsed range modern browsers return a
    // rect with width=0 but valid x/y (the caret). Some return all-zeros at
    // the start of an empty paragraph; fall back to the editable's rect.
    let rect = range.getBoundingClientRect();
    if (rect.top === 0 && rect.left === 0 && rect.width === 0 && rect.height === 0) {
      const er = editable.getBoundingClientRect();
      rect = { top: er.top, bottom: er.top + 24, left: er.left + er.width / 2, right: er.left + er.width / 2, width: 0, height: 24 };
    }
    const tbHeight = toolbar.offsetHeight || 40;
    const tbWidth = toolbar.offsetWidth || 380;
    let top = window.scrollY + rect.top - tbHeight - 12;
    let left = window.scrollX + rect.left + rect.width / 2 - tbWidth / 2;
    if (top < window.scrollY + 8) top = window.scrollY + rect.bottom + 12;
    if (left < 8) left = 8;
    if (left + tbWidth > window.innerWidth - 8) left = window.innerWidth - tbWidth - 8;

    toolbar.style.top = top + 'px';
    toolbar.style.left = left + 'px';
    updateActiveStates();
  }

  function hideToolbar() {
    if (toolbar && !suppressHide) {
      toolbar.classList.remove('is-visible');
      // Next time the toolbar opens, return to auto-positioning
      toolbarManuallyMoved = false;
    }
  }

  // -------------------------------------------------------------------
  // Paste sanitizer
  // -------------------------------------------------------------------
  // When a user pastes from Word/Google Docs/a web page, the clipboard
  // brings rich HTML with inline `font-family`, `font-size`, `color`, and
  // `class` attributes that override anything the toolbar later applies
  // (both are inline styles → the inner one wins for the text it directly
  // wraps). We strip all that down to a small whitelist of semantic tags
  // and drop every attribute, so pasted text inherits the editor defaults
  // and toolbar controls work normally.
  const PASTE_KEEP_TAGS = new Set([
    'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U',
    'OL', 'UL', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A',
  ]);

  function sanitizePastedHtml(html) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    // Hard-drop these whole subtrees
    wrapper.querySelectorAll('script, style, meta, link, head, title, object, embed').forEach(el => el.remove());

    function unwrap(el) {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    }

    function process(el) {
      // Depth-first: process originals before deciding what to do with `el`.
      // Take a snapshot — children may be unwrapped during recursion.
      Array.from(el.children).forEach(process);

      if (el === wrapper) return;

      if (!PASTE_KEEP_TAGS.has(el.tagName)) {
        unwrap(el);
        return;
      }

      // Allowed tag — strip every attribute except `href` on anchors
      const isAnchor = el.tagName === 'A';
      Array.from(el.attributes).forEach(attr => {
        if (isAnchor && attr.name === 'href') return;
        el.removeAttribute(attr.name);
      });
    }

    process(wrapper);

    // Collapse runs of empty paragraphs (Word loves these)
    wrapper.querySelectorAll('p').forEach(p => {
      if (!p.textContent.trim() && !p.querySelector('br, img')) p.remove();
    });

    return wrapper.innerHTML;
  }

  document.addEventListener('paste', (e) => {
    if (!document.body.classList.contains('admin-mode')) return;
    const editable = e.target && e.target.closest && e.target.closest('[contenteditable="true"]');
    if (!editable) return;

    const cd = e.clipboardData || window.clipboardData;
    if (!cd) return;

    // If the clipboard contains an image, let the page-level handler create
    // an image block instead of pasting raw text into the editable.
    const items = cd.items ? Array.from(cd.items) : [];
    const hasImageFile = items.some(it => it.kind === 'file' && it.type && it.type.startsWith('image/'));
    if (hasImageFile) return;

    e.preventDefault();
    const html = cd.getData('text/html');
    const text = cd.getData('text/plain');

    if (html) {
      const cleaned = sanitizePastedHtml(html);
      // insertHTML inserts at the current selection. The text now inherits
      // the editor's default font/color, so the toolbar can override it.
      document.execCommand('insertHTML', false, cleaned);
    } else if (text) {
      document.execCommand('insertText', false, text);
    }

    editable.dispatchEvent(new Event('input', { bubbles: true }));
  }, true);

  // Show toolbar on selection change — debounced so it settles after you stop
  // moving the selection instead of "dancing" during the drag.
  let _selTimer = null;
  document.addEventListener('selectionchange', () => {
    clearTimeout(_selTimer);
    _selTimer = setTimeout(showToolbar, 140);
  });

  // Hide on click outside
  document.addEventListener('mousedown', e => {
    if (toolbar && toolbar.contains(e.target)) {
      suppressHide = true;
      setTimeout(() => { suppressHide = false; }, 50);
      return;
    }
  });

  // Re-position on scroll/resize
  window.addEventListener('scroll', () => {
    if (toolbar && toolbar.classList.contains('is-visible')) showToolbar();
  }, true);
  window.addEventListener('resize', () => {
    if (toolbar && toolbar.classList.contains('is-visible')) showToolbar();
  });
})();
