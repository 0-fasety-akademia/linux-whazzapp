const {
  app, BrowserWindow, Tray, Menu, shell, session, nativeImage, nativeTheme, dialog, clipboard,
} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const photos = require('./photos');

const WA_URL = 'https://web.whatsapp.com/';
// WhatsApp Web odrzuca "Electron" w UA, więc udajemy zwykłego Chrome.
const CHROME_UA =
  `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ` +
  `Chrome/${process.versions.chrome} Safari/537.36`;

app.commandLine.appendSwitch('ozone-platform-hint', 'auto'); // Wayland/X11
app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');
app.setName('linux-whazzapp');

// Dane użytkownika: stały katalog ~/.config/linux-whazzapp. Przy zmianie nazwy z
// WhazzApp przenosimy starą sesję i ustawienia, żeby nie skanować ponownie kodu QR.
const appData = app.getPath('appData');
const dataDir = path.join(appData, 'linux-whazzapp');
try {
  if (!fs.existsSync(dataDir)) {
    for (const old of ['whazzapp', 'WhazzApp']) {
      const oldDir = path.join(appData, old);
      if (fs.existsSync(oldDir)) { fs.renameSync(oldDir, dataDir); break; }
    }
  }
} catch {}
app.setPath('userData', dataDir);

// ---------- ustawienia ----------
const settingsFile = path.join(app.getPath('userData'), 'settings.json');
const defaults = {
  closeToTray: true, startMinimized: false, autostart: false, notifications: true, theme: 'system',
  photosAsk: true,  // pytaj o źródło zdjęć (iCloud Photos / komputer), gdy linux-icloud-photos jest zainstalowany
};
let settings = { ...defaults };
try { settings = { ...defaults, ...JSON.parse(fs.readFileSync(settingsFile, 'utf8')) }; } catch {}
const saveSettings = () => {
  try {
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  } catch {}
};

// motyw: 'system' = automatyczny dzień/noc zgodnie z ustawieniem Ubuntu
if (!['system', 'light', 'dark', 'aurora'].includes(settings.theme)) settings.theme = 'system';
// Aurora jasna/ciemna idzie za systemem, więc dla Electrona to „system”
const themeSource = () => (settings.theme === 'aurora' ? 'system' : settings.theme);
nativeTheme.themeSource = themeSource();
const bgColor = () => (settings.theme === 'aurora'
  ? (nativeTheme.shouldUseDarkColors ? '#0c0e1a' : '#f4f1ff')
  : (nativeTheme.shouldUseDarkColors ? '#111b21' : '#f0f2f5'));

// Motyw Aurora: jeden arkusz (assets/aurora.css) wstrzykiwany do strony i zdejmowany przy zmianie motywu
let auroraKey = null;
async function applyAurora() {
  if (!win || win.isDestroyed()) return;
  const wc = win.webContents;
  if (settings.theme === 'aurora' && !auroraKey) {
    try { auroraKey = await wc.insertCSS(fs.readFileSync(asset('aurora.css'), 'utf8')); } catch {}
  } else if (settings.theme !== 'aurora' && auroraKey) {
    const k = auroraKey; auroraKey = null;
    try { await wc.removeInsertedCSS(k); } catch {}
  }
  win.setBackgroundColor(bgColor());
}

// ---------- autostart (~/.config/autostart) ----------
function applyAutostart() {
  const dir = path.join(os.homedir(), '.config', 'autostart');
  const file = path.join(dir, 'linux-whazzapp.desktop');
  try { fs.unlinkSync(path.join(dir, 'whazzapp.desktop')); } catch {} // stary wpis (WhazzApp)
  if (!settings.autostart) { try { fs.unlinkSync(file); } catch {} return; }
  const exec = process.env.APPIMAGE || process.execPath;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file,
`[Desktop Entry]
Type=Application
Name=linux-whazzapp
Exec="${exec}" --hidden
X-GNOME-Autostart-enabled=true
`);
}

// ---------- stan ----------
let win = null, tray = null, quitting = false, unread = 0;
let photosApp = null, picking = false;  // wykryty linux-icloud-photos; trwa wybór zdjęć
const startHidden = process.argv.includes('--hidden') || settings.startMinimized;
const asset = (f) => path.join(__dirname, 'assets', f);

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => showWindow());

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
}

function toggleWindow() { win.isVisible() && win.isFocused() ? win.hide() : showWindow(); }

// ---------- tray ----------
// Ikona w panelu = ta sama co ikona aplikacji, w wariancie pod jasny/ciemny motyw.
function trayImage() {
  const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  return nativeImage.createFromPath(asset(`tray-${theme}${unread > 0 ? '-unread' : ''}.png`))
    .resize({ width: 24, height: 24 });
}

// Ikona aplikacji (menu aplikacji, dock, okno) też przełącza się z motywem:
// podmieniamy ją w użytkownika ~/.local/share/icons (ma pierwszeństwo przed ikoną z paczki).
function applyAppIcon() {
  try {
    const file = asset(nativeTheme.shouldUseDarkColors ? 'icon-dark.png' : 'icon.png');
    if (win) win.setIcon(nativeImage.createFromPath(file));
    const root = path.join(os.homedir(), '.local', 'share', 'icons', 'hicolor');
    const dir = path.join(root, '512x512', 'apps');
    const dest = path.join(dir, 'linux-whazzapp.png');
    try { fs.unlinkSync(path.join(dir, 'whazzapp.png')); } catch {} // stara ikona (WhazzApp)
    const data = fs.readFileSync(file);
    let same = false;
    try { same = fs.readFileSync(dest).equals(data); } catch {}
    if (same) return;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dest, data);
    const now = new Date();
    fs.utimesSync(root, now, now); // odśwież cache ikon
  } catch {}
}

// O programie: podpis wymagany w każdej aplikacji z serii
function showAbout() {
  const icon = nativeImage
    .createFromPath(asset(nativeTheme.shouldUseDarkColors ? 'icon-dark.png' : 'icon.png'))
    .resize({ width: 96, height: 96 });
  const opts = {
    type: 'info',
    title: 'O programie linux-whazzapp',
    message: `linux-whazzapp ${app.getVersion()}`,
    detail: 'Created by: JGu\nSupported by Claude\n\nNieoficjalny klient WhatsApp Web dla Ubuntu.',
    icon,
    buttons: ['OK'],
  };
  if (win && win.isVisible()) dialog.showMessageBox(win, opts); else dialog.showMessageBox(opts);
}

// ---------- zdjęcia z iCloud Photos (linux-icloud-photos) ----------
function photosMenuItem(toggle) {
  if (!photosApp) return { label: 'Zdjęcia z iCloud Photos (nie wykryto linux-icloud-photos)', enabled: false };
  if (!photosApp.ok) {
    return { label: `Zdjęcia z iCloud Photos (zaktualizuj linux-icloud-photos do ${photos.MIN_VERSION}+)`, enabled: false };
  }
  return { label: 'Zdjęcia: pytaj o źródło (iCloud Photos)', type: 'checkbox', checked: settings.photosAsk,
           click: toggle('photosAsk', syncPhotosFlag) };
}

// Strona dostaje informację, czy ma przechwytywać „Zdjęcia i filmy” (assets/photos-hook.js).
function syncPhotosFlag() {
  if (!win) return;
  const on = !!(photosApp && photosApp.ok && settings.photosAsk);
  win.webContents.executeJavaScript(`window.__whazzappPhotos = ${on};`).catch(() => {});
}

let lastPhotosCheck = 0;
function refreshPhotosApp(force = false) {
  if (!force && Date.now() - lastPhotosCheck < 15000) return;  // focus bywa częsty
  lastPhotosCheck = Date.now();
  try { photosApp = photos.detect(); } catch { photosApp = null; }
  syncPhotosFlag();
  refreshTray();
}

function photosError(message, detail) {
  return dialog.showMessageBox(win, { type: 'error', title: 'Zdjęcia z iCloud Photos', message, detail: detail || '', buttons: ['OK'] });
}

// „Zdjęcia i filmy” w WhatsApp: pytamy, skąd wybrać; z iCloud Photos pliki trafiają do rozmowy
// z ekranem podglądu WhatsApp (opis i „Wyślij”).
async function onPhotosRequest() {
  if (picking || !win) return;
  const icon = nativeImage.createFromPath(asset(nativeTheme.shouldUseDarkColors ? 'icon-dark.png' : 'icon.png'))
    .resize({ width: 64, height: 64 });
  const { response } = await dialog.showMessageBox(win, {
    type: 'question', title: 'Zdjęcia i filmy', message: 'Skąd wybrać zdjęcia i filmy?',
    buttons: ['Z iCloud Photos', 'Z komputera', 'Anuluj'], defaultId: 0, cancelId: 2, noLink: true, icon,
  });
  if (response === 1) {  // zwykłe okno plików
    win.webContents.executeJavaScript(
      'window.__whazzappBypass = true; window.__whazzappLastInput && window.__whazzappLastInput.click();', true,
    ).catch(() => {});
    return;
  }
  if (response !== 0) return;

  picking = true;
  try {
    const res = await photos.runPicker(photosApp, { max: photos.MAX_FILES });
    showWindow();
    if (res.status === 'error') {
      await photosError('Nie udało się uruchomić linux-icloud-photos.', res.detail);
    } else if (res.status === 'ok') {
      try {
        await photos.attachFiles(win.webContents, res.files.map((f) => f.path));
      } catch (e) {
        await photosError('Nie udało się dołączyć plików do rozmowy.',
          `${e.message}\nOtwórz rozmowę, kliknij spinacz i spróbuj ponownie.`);
      }
      if (res.errors.length) {
        await dialog.showMessageBox(win, {
          type: 'warning', title: 'Zdjęcia z iCloud Photos', buttons: ['OK'],
          message: `Nie udało się przygotować części plików (${res.errors.length}).`,
          detail: res.errors.slice(0, 8).join('\n'),
        });
      }
    }
  } finally {
    picking = false;
  }
}

// Diagnostyka układu: kopiuje do schowka opis elementów strony (do wklejenia w zgłoszeniu błędu)
async function layoutDiag() {
  try {
    const text = await win.webContents.executeJavaScript(fs.readFileSync(asset('layout-diag.js'), 'utf8'));
    clipboard.writeText(text);
    dialog.showMessageBox(win, { type: 'info', title: 'Diagnostyka układu', message: 'Skopiowano do schowka.',
      detail: 'Wklej zawartość schowka (Ctrl+V) do wiadomości z opisem problemu.' });
  } catch (e) {
    dialog.showErrorBox('Diagnostyka układu', String(e && e.message || e));
  }
}

function buildTray() {
  tray = new Tray(trayImage());
  tray.on('click', toggleWindow);
  refreshTray();
}

function refreshTray() {
  if (!tray) return;
  tray.setImage(trayImage());
  tray.setToolTip(unread > 0 ? `linux-whazzapp — nieprzeczytane: ${unread}` : 'linux-whazzapp');
  const toggle = (key, after) => (item) => { settings[key] = item.checked; saveSettings(); after && after(); };
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: win && win.isVisible() ? 'Ukryj okno' : 'Pokaż okno', click: toggleWindow },
    { type: 'separator' },
    { label: 'Zamykaj do zasobnika', type: 'checkbox', checked: settings.closeToTray, click: toggle('closeToTray') },
    { label: 'Powiadomienia', type: 'checkbox', checked: settings.notifications, click: toggle('notifications') },
    { label: 'Uruchamiaj z systemem', type: 'checkbox', checked: settings.autostart, click: toggle('autostart', applyAutostart) },
    { label: 'Startuj zminimalizowany', type: 'checkbox', checked: settings.startMinimized, click: toggle('startMinimized') },
    photosMenuItem(toggle),
    { label: 'Motyw', submenu: [
        ['system', 'Automatyczny (jak system)'], ['light', 'Jasny'], ['dark', 'Ciemny'],
        ['aurora', 'Aurora (jasny / ciemny)'],
      ].map(([val, label]) => ({
        label, type: 'radio', checked: settings.theme === val,
        click: () => { settings.theme = val; nativeTheme.themeSource = themeSource(); saveSettings(); applyAurora(); },
      })) },
    { type: 'separator' },
    { label: 'Przeładuj', click: () => win.webContents.reload() },
    { label: 'Diagnostyka układu (do schowka)', click: layoutDiag },
    { label: 'O programie', click: showAbout },
    { label: 'Zakończ', click: () => { quitting = true; app.quit(); } },
  ]));
}

// zmiana motywu systemu → odśwież tło okna i ikonę w panelu
nativeTheme.on('updated', () => {
  if (win) win.setBackgroundColor(bgColor());
  refreshTray();
  applyAppIcon();
});

function setUnread(n) {
  if (n === unread) return;
  unread = n;
  app.setBadgeCount(n); // licznik na ikonie w docku
  refreshTray();
}

// Po kliknięciu w powiadomienie otwórz właściwą rozmowę: WhatsApp zwykle robi to sam,
// a to jest zabezpieczenie — szukamy na liście czatów wiersza o tytule z powiadomienia.
function openChat({ title }) {
  if (!win || !title) return;
  const code = `
    (() => {
      const raw = ${JSON.stringify(title)};
      // w grupach tytuł bywa "Nadawca @ Grupa"
      const names = [raw];
      if (raw.includes(' @ ')) names.push(raw.split(' @ ').pop());
      const pane = document.querySelector('#pane-side') || document;
      const spans = Array.from(pane.querySelectorAll('span[title]'));
      let el = null;
      for (const n of names) {
        el = spans.find((s) => s.getAttribute('title') === n);
        if (el) break;
      }
      if (!el) return false;
      const row = el.closest('[role="listitem"]') || el.closest('[role="row"]')
        || el.closest('[data-testid="cell-frame-container"]') || el;
      for (const type of ['mousedown', 'mouseup', 'click']) {
        row.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      }
      return true;
    })();
  `;
  // krótkie opóźnienie, żeby okno zdążyło się pokazać i WhatsApp zrobił własną obsługę
  setTimeout(() => win.webContents.executeJavaScript(code).catch(() => {}), 250);
}

// ---------- okno ----------
function createWindow() {
  win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 700, minHeight: 500,
    show: false, autoHideMenuBar: true,
    icon: asset('icon.png'), title: 'linux-whazzapp',
    backgroundColor: bgColor(),
    webPreferences: {
      partition: 'persist:whatsapp', // sesja przetrwa restart (zostajesz zalogowany)
      contextIsolation: true, sandbox: true, nodeIntegration: false,
      spellcheck: true,
    },
  });
  win.removeMenu();
  win.webContents.setUserAgent(CHROME_UA);
  win.loadURL(WA_URL, { userAgent: CHROME_UA });

  win.once('ready-to-show', () => { if (!startHidden) win.show(); });

  // licznik nieprzeczytanych z tytułu: "(3) WhatsApp"
  win.webContents.on('page-title-updated', (e, title) => {
    const m = /^\((\d+)\)/.exec(title);
    setUnread(m ? parseInt(m[1], 10) : 0);
  });

  // klik w powiadomienie → pokaż okno (opakowujemy Notification na stronie)
  win.webContents.on('dom-ready', () => {
    // nowy dokument (start / przeładowanie) nie ma wstrzykniętego CSS: wstaw Aurorę ponownie
    auroraKey = null;
    applyAurora();
    // powiadomienia: klik otwiera rozmowę, przeczytane znikają (assets/notify-hook.js)
    try {
      win.webContents.executeJavaScript(fs.readFileSync(asset('notify-hook.js'), 'utf8')).catch(() => {});
    } catch {}

    // ruchomy podział lista czatów / rozmowa (assets/resizer.js)
    try {
      win.webContents.executeJavaScript(fs.readFileSync(asset('resizer.js'), 'utf8')).catch(() => {});
    } catch {}

    // „Zdjęcia i filmy” → wybór źródła, w tym iCloud Photos (assets/photos-hook.js)
    try {
      win.webContents.executeJavaScript(fs.readFileSync(asset('photos-hook.js'), 'utf8'))
        .then(syncPhotosFlag).catch(() => {});
    } catch {}
  });
  win.webContents.on('console-message', (e, ...args) => {
    const msg = (e && typeof e.message === 'string') ? e.message
      : (typeof args[0] === 'object' && args[0] ? args[0].message : args[1]);
    if (msg === '__WHAZZAPP_PHOTOS__') { onPhotosRequest(); return; }
    if (typeof msg !== 'string' || !msg.startsWith('__WHAZZAPP_NOTIF_CLICK__')) return;
    let info = {};
    try { info = JSON.parse(msg.slice('__WHAZZAPP_NOTIF_CLICK__'.length) || '{}'); } catch {}
    showWindow();
    openChat(info);
  });

  // linki zewnętrzne → przeglądarka systemowa
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!new URL(url).hostname.endsWith('whatsapp.com')) { e.preventDefault(); shell.openExternal(url); }
  });

  // menu kontekstowe (kopiuj/wklej + pisownia)
  win.webContents.on('context-menu', (_e, p) => {
    const items = [];
    if (p.misspelledWord) {
      p.dictionarySuggestions.slice(0, 5).forEach((s) =>
        items.push({ label: s, click: () => win.webContents.replaceMisspelling(s) }));
      if (items.length) items.push({ type: 'separator' });
    }
    if (p.isEditable) items.push({ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' });
    if (p.isEditable || p.selectionText) items.push({ role: 'copy' });
    if (p.isEditable) items.push({ role: 'paste' }, { role: 'selectAll' });
    if (p.linkURL) items.push({ label: 'Otwórz link w przeglądarce', click: () => shell.openExternal(p.linkURL) });
    if (items.length) Menu.buildFromTemplate(items).popup();
  });

  // zamknięcie → do zasobnika
  win.on('close', (e) => {
    if (!quitting && settings.closeToTray) { e.preventDefault(); win.hide(); }
  });
  win.on('focus', () => refreshPhotosApp());
  win.on('show', refreshTray);
  win.on('hide', refreshTray);
}

// ---------- start ----------
app.whenReady().then(() => {
  const ses = session.fromPartition('persist:whatsapp');
  ses.setUserAgent(CHROME_UA);
  ses.setSpellCheckerLanguages(['pl', 'en-US']);

  ses.setPermissionRequestHandler((_wc, permission, cb) => {
    const ok = ['media', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen', 'mediaKeySystem'];
    cb(permission === 'notifications' ? settings.notifications : ok.includes(permission));
  });

  photos.cleanupOld();
  photosApp = (() => { try { return photos.detect(); } catch { return null; } })();
  createWindow();
  buildTray();
  applyAppIcon();
  applyAutostart();
  app.on('activate', showWindow);
});

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { /* zostajemy w tray */ });
