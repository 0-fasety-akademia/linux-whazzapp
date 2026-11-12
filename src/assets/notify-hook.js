// linux-whazzapp: powiadomienia o wiadomościach znikają po przeczytaniu.
// Wstrzykiwany do strony. Owija Notification z WhatsApp Web i:
//  - po kliknięciu w powiadomienie przekazuje procesowi głównemu tytuł (otworzy rozmowę) i zamyka je,
//  - zamyka powiadomienia rozmowy, która jest otwarta w oknie (okno aktywne, strona widoczna),
//  - zamyka wszystkie, gdy licznik nieprzeczytanych w tytule strony spadnie do zera
//    (np. po przeczytaniu na telefonie).
// Zamknięcie usuwa też wpis z listy powiadomień Ubuntu. Gdy WhatsApp zmieni strukturę strony,
// mechanizmy oparte na układzie przestaną działać, ale kliknięcie w powiadomienie nadal działa.
(() => {
  if (window.__whazzappPatched) return;
  window.__whazzappPatched = true;

  const Orig = window.Notification;
  const GRACE_MS = 3000;           // świeżych powiadomień nie zamykamy z powodu opóźnionej zmiany tytułu
  const active = new Set();        // { n, title, ts }

  const chatNames = (title) => {   // w grupach tytuł ma postać „Nadawca @ Grupa”
    const names = [title];
    if (title.includes(' @ ')) names.push(title.split(' @ ').pop());
    return names;
  };

  function dismiss(rec) {
    active.delete(rec);
    try { rec.n.close(); } catch (e) {}
  }

  function dismissChat(name, { exceptYoungerThan = 0 } = {}) {
    if (!name) return;
    for (const rec of Array.from(active)) {
      if (exceptYoungerThan && Date.now() - rec.ts < exceptYoungerThan) continue;
      if (chatNames(rec.title).includes(name)) dismiss(rec);
    }
  }

  function dismissAll(exceptYoungerThan = 0) {
    for (const rec of Array.from(active)) {
      if (exceptYoungerThan && Date.now() - rec.ts < exceptYoungerThan) continue;
      dismiss(rec);
    }
  }

  function P(title, opts) {
    const n = new Orig(title, opts);
    const rec = { n, title: String(title || ''), ts: Date.now() };
    active.add(rec);
    n.addEventListener('close', () => active.delete(rec));
    n.addEventListener('click', () => {
      try {
        console.log('__WHAZZAPP_NOTIF_CLICK__' + JSON.stringify({
          title: rec.title, tag: String((opts && opts.tag) || ''),
        }));
      } catch (e) { console.log('__WHAZZAPP_NOTIF_CLICK__{}'); }
      dismissChat(rec.title);   // zamyka to i pozostałe powiadomienia tej rozmowy
      dismiss(rec);
    });
    return n;
  }
  P.prototype = Orig.prototype;
  Object.defineProperty(P, 'permission', { get: () => Orig.permission });
  P.requestPermission = Orig.requestPermission.bind(Orig);
  window.Notification = P;

  // nazwa rozmowy otwartej w oknie (nagłówek prawego panelu)
  function openChatName() {
    const el = document.querySelector('#main header span[title]') || document.querySelector('#main header [title]');
    return el ? (el.getAttribute('title') || '').trim() : '';
  }

  const unreadCount = () => {
    const m = /^\((\d+)\)/.exec(document.title || '');
    return m ? parseInt(m[1], 10) : 0;
  };

  let prevUnread = unreadCount();
  function check() {
    if (!active.size) { prevUnread = unreadCount(); return; }
    // 1) rozmowa jest otwarta i okno jest aktywne = wiadomości są czytane
    if (document.hasFocus() && !document.hidden) dismissChat(openChatName());
    // 2) wszystko przeczytane (tu albo na telefonie)
    const now = unreadCount();
    if (prevUnread > 0 && now === 0) dismissAll(GRACE_MS);
    prevUnread = now;
  }
  setInterval(check, 1000);
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', check);
})();
