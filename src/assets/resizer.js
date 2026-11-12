// WhazzApp: ruchomy podział między listą czatów (lewo) a rozmową (prawo).
// Wstrzykiwany do web.whatsapp.com. Uchwyt jest osobnym elementem na <body>,
// więc nie ingeruje w drzewo DOM zarządzane przez WhatsApp (React).
// Przeciągnij uchwyt, aby zmienić szerokość. Podwójne kliknięcie przywraca domyślną.
(() => {
  if (window.__whazzappResizer) return;
  window.__whazzappResizer = true;

  const KEY = 'whazzapp.sideWidth';
  const MIN_LEFT = 280;   // minimalna szerokość listy czatów
  const MIN_MAIN = 360;   // minimalna szerokość rozmowy
  const NARROW = 760;     // węższe okno: WhatsApp przechodzi na jedną kolumnę, nie ingerujemy
  const GRIP = 10;        // szerokość obszaru chwytania (px)
  const PROPS = ['width', 'min-width', 'max-width', 'flex-basis'];

  let width = null;
  try { width = parseInt(localStorage.getItem(KEY), 10) || null; } catch (e) {}
  let left = null;
  let dragging = false;

  const grip = document.createElement('div');
  grip.id = 'whazzapp-resizer';
  grip.title = 'Przeciągnij, aby zmienić szerokość (dwuklik: reset)';
  grip.style.cssText =
    `position:fixed;z-index:2147483647;width:${GRIP}px;cursor:col-resize;` +
    'background:transparent;display:none;transition:background .15s;';
  grip.addEventListener('mouseenter', () => { grip.style.background = 'rgba(18,184,134,.45)'; });
  grip.addEventListener('mouseleave', () => { if (!dragging) grip.style.background = 'transparent'; });
  (document.body || document.documentElement).appendChild(grip);

  // lewa kolumna = przodek #side, którego rodzic jest wierszem flex z kolumną rozmowy obok
  function findLeft() {
    const side = document.querySelector('#side');
    if (!side) return null;
    let el = side;
    while (el.parentElement && el.parentElement !== document.body) {
      const p = el.parentElement;
      const cs = getComputedStyle(p);
      if (cs.display === 'flex' && cs.flexDirection.startsWith('row') &&
          p.children.length >= 2 &&
          p.getBoundingClientRect().width > el.getBoundingClientRect().width * 1.4) {
        return el;
      }
      el = p;
    }
    return null;
  }

  const clamp = (w) => Math.max(MIN_LEFT, Math.min(w, window.innerWidth - MIN_MAIN));

  // oryginalne style inline strony zapamiętujemy, żeby reset ich nie skasował
  const ALL = PROPS.concat(['flex-grow', 'flex-shrink']);
  const origs = new Map();   // element -> { właściwość: [wartość, priorytet] }
  const remember = (el) => {
    if (origs.has(el)) return;
    const o = {};
    ALL.forEach((p) => { o[p] = [el.style.getPropertyValue(p), el.style.getPropertyPriority(p)]; });
    origs.set(el, o);
  };
  const restore = () => {
    origs.forEach((o, el) => {
      ALL.forEach((p) => {
        const [v, pr] = o[p];
        if (v) el.style.setProperty(p, v, pr); else el.style.removeProperty(p);
      });
    });
    origs.clear();
  };

  // WhatsApp rysuje cienkie linie podziału w osobnym, przezroczystym elemencie o natywnej szerokości listy
  // (ma lewą ramkę i zaczyna się w tym samym miejscu co lista). Gdy zmieniamy tylko listę, linia zostaje
  // w starym miejscu jako „smuga”, więc taki element dostaje tę samą szerokość.
  let mirror = null;
  function findMirror() {
    if (!left) return null;
    const lr = left.getBoundingClientRect();
    const side = document.querySelector('#side');
    for (const el of document.querySelectorAll('div')) {
      if (el === left || el.contains(left) || (side && el.contains(side)) || el === grip) continue;
      const r = el.getBoundingClientRect();
      if (r.height < window.innerHeight * 0.8 || Math.abs(r.left - lr.left) > 3 || r.width < lr.width - 1) continue;
      if (parseFloat(getComputedStyle(el).borderLeftWidth) > 0) return el;
    }
    return null;
  }

  function apply() {
    if (!left) return;
    if (width == null) { restore(); mirror = null; return; }
    if (!mirror || !mirror.isConnected) mirror = findMirror();
    const w = clamp(width) + 'px';
    [left, mirror].forEach((el, i) => {
      if (!el) return;
      remember(el);
      PROPS.forEach((p) => el.style.setProperty(p, w, 'important'));
      el.style.setProperty('flex-grow', '0', 'important');
      el.style.setProperty('flex-shrink', '0', 'important');
    });
  }

  function place() {
    if (!left || !left.isConnected) { left = findLeft(); origs.clear(); mirror = null; }
    if (!left) { grip.style.display = 'none'; return; }
    if (window.innerWidth < NARROW) {   // wąskie okno: oddajemy układ stronie, bez uchwytu i wymuszonej szerokości
      restore(); mirror = null;
      grip.style.display = 'none';
      return;
    }
    apply();
    const r = left.getBoundingClientRect();
    grip.style.display = 'block';
    grip.style.left = (r.right - GRIP / 2) + 'px';
    grip.style.top = r.top + 'px';
    grip.style.height = r.height + 'px';
  }

  function save() {
    try {
      if (width == null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(Math.round(width)));
    } catch (e) {}
  }

  grip.addEventListener('mousedown', (e) => {
    if (!left) return;
    dragging = true;
    e.preventDefault();
    document.documentElement.style.cursor = 'col-resize';
    document.documentElement.style.userSelect = 'none';
    grip.style.background = 'rgba(18,184,134,.7)';
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging || !left) return;
    width = clamp(e.clientX - left.getBoundingClientRect().left);
    place();
  }, true);
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.documentElement.style.cursor = '';
    document.documentElement.style.userSelect = '';
    grip.style.background = 'transparent';
    save();
  }, true);
  grip.addEventListener('dblclick', () => { width = null; apply(); save(); setTimeout(place, 50); });

  window.addEventListener('resize', place);
  setInterval(place, 400); // SPA: układ może się przebudować, więc pilnujemy lewej kolumny
  place();
})();
