// linux-whazzapp: przechwycenie „Zdjęcia i filmy” z menu załączników WhatsApp Web.
// Wstrzykiwany do strony. Gdy aplikacja linux-icloud-photos jest dostępna (flaga ustawia proces główny),
// kliknięcie pola wyboru zdjęć i filmów nie otwiera od razu systemowego okna, tylko prosi aplikację
// o wybór źródła (iCloud Photos albo komputer). Inne pola (dokumenty, naklejki, zdjęcie profilu) zostają
// bez zmian. Gdy WhatsApp zmieni strukturę strony, hak po prostu nie zadziała i wraca zwykłe okno plików.
(() => {
  if (window.__whazzappPhotosHook) return;
  window.__whazzappPhotosHook = true;
  window.__whazzappPhotos = false;   // true ustawia proces główny, gdy wykryje linux-icloud-photos
  window.__whazzappBypass = false;   // true = następne kliknięcie ma otworzyć zwykłe okno (wybór „Z komputera”)
  window.__whazzappLastInput = null; // pole, na które trafią pliki z iCloud Photos

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t || t.tagName !== 'INPUT' || t.type !== 'file') return;
    const accept = (t.getAttribute('accept') || '').toLowerCase();
    if (!(accept.includes('image') && accept.includes('video'))) return;  // tylko „Zdjęcia i filmy”
    if (window.__whazzappBypass) { window.__whazzappBypass = false; return; }
    if (!window.__whazzappPhotos) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    window.__whazzappLastInput = t;
    console.log('__WHAZZAPP_PHOTOS__');
  }, true);
})();
