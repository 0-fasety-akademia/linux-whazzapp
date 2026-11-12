// linux-whazzapp: diagnostyka układu strony (pozycja tray „Diagnostyka układu”).
// Zwraca tekst z opisem cienkich, wysokich elementów (kandydaci na „smugę”) i położeniem lewej kolumny.
(() => {
  const H = window.innerHeight, W = window.innerWidth;
  const desc = (el) => {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return {
      el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
        (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''),
      rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
      pos: cs.position, bg: cs.backgroundColor, bl: cs.borderLeftWidth + ' ' + cs.borderLeftColor,
      br: cs.borderRightWidth + ' ' + cs.borderRightColor, shadow: cs.boxShadow.slice(0, 60),
      parent: el.parentElement ? el.parentElement.tagName.toLowerCase() + (el.parentElement.id ? '#' + el.parentElement.id : '') : '',
    };
  };
  const out = { window: [W, H], scrollX: window.scrollX, docScrollW: document.documentElement.scrollWidth };
  const side = document.querySelector('#side');
  if (side) {
    let el = side; const chain = [];
    while (el && el !== document.body && chain.length < 8) { chain.push(desc(el)); el = el.parentElement; }
    out.sideChain = chain;
  }
  // układ kontenera nadrzędnego lewej kolumny: typ wyświetlania i jego dzieci (do poprawki podziału)
  if (side && side.parentElement && side.parentElement.parentElement) {
    const host = side.parentElement.parentElement;
    const hs = getComputedStyle(host);
    out.host = Object.assign(desc(host), { display: hs.display, gridCols: hs.gridTemplateColumns, flexDir: hs.flexDirection });
    out.hostChildren = Array.from(host.children).map((c) => {
      const cs = getComputedStyle(c);
      return Object.assign(desc(c), { display: cs.display, flex: cs.flex, w: cs.width, minW: cs.minWidth, maxW: cs.maxWidth, gridCol: cs.gridColumn });
    });
    out.leftChildren = Array.from(side.parentElement.children).map(desc);
  }
  const thin = [], pseudo = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.id === 'whazzapp-resizer') continue;
    const r = el.getBoundingClientRect();
    if (r.height >= H * 0.5 && r.right > 0 && r.left < W) {
      const cs = getComputedStyle(el);
      const bw = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
      if (r.width <= 4 || bw > 0) thin.push(desc(el));
    }
    for (const ps of ['::before', '::after']) {
      const p = getComputedStyle(el, ps);
      if (p.content && p.content !== 'none' && p.content !== 'normal' &&
          (parseFloat(p.width) <= 4 && parseFloat(p.height) > 100)) {
        pseudo.push({ host: desc(el), ps, w: p.width, h: p.height, left: p.left, bg: p.backgroundColor });
      }
    }
  }
  out.thinFullHeight = thin.slice(0, 25);
  out.pseudo = pseudo.slice(0, 10);
  return JSON.stringify(out, null, 1);
})();
