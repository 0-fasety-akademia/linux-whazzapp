// Integracja z linux-icloud-photos: wykrycie aplikacji, uruchomienie jej trybu wyboru (--pick)
// i podanie wybranych plików do pola wyboru plików na stronie WhatsApp Web.
// Moduł nie używa Electrona poza obiektem webContents przekazanym do attachFiles(),
// więc większość da się testować zwykłym Node.js.
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIN_VERSION = '0.14.0';              // pierwsza wersja linux-icloud-photos z trybem --pick
const DEB_BIN = '/usr/bin/linux-icloud-photos';
const FLATPAK_ID = 'local.linuxicloudphotos.Photos';
const MAX_FILES = 30;                      // tyle plików naraz pozwala wysłać WhatsApp Web
const KEEP_MS = 24 * 3600 * 1000;          // tyle trzymamy wybrane pliki (WhatsApp czyta je przy wysyłaniu)

const pickBase = () => path.join(os.homedir(), '.cache', 'linux-whazzapp', 'pick');

function compareVersions(a, b) {
  const pa = String(a).split(/[.\-+~]/).map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(/[.\-+~]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

// Zwraca null (brak aplikacji) albo { kind, cmd, args, version, ok }.
// ok = false, gdy aplikacja jest zainstalowana, ale zbyt stara na tryb wyboru.
function detect({ env = process.env, spawnSync = cp.spawnSync, exists = fs.existsSync } = {}) {
  const custom = env.WHAZZAPP_PHOTOS_CMD;   // zaawansowane: własna ścieżka do aplikacji (też do testów)
  if (custom && exists(custom)) return { kind: 'custom', cmd: custom, args: [], version: null, ok: true };

  const withVersion = (info) => ({ ...info, ok: info.version == null || compareVersions(info.version, MIN_VERSION) >= 0 });
  if (exists(DEB_BIN)) {
    const q = spawnSync('dpkg-query', ['-W', '-f=${Version}', 'linux-icloud-photos'], { encoding: 'utf8', timeout: 4000 });
    const version = q && q.status === 0 && q.stdout ? q.stdout.trim() : null;
    return withVersion({ kind: 'deb', cmd: DEB_BIN, args: [], version });
  }
  const fp = spawnSync('flatpak', ['info', FLATPAK_ID], { encoding: 'utf8', timeout: 5000 });
  if (fp && fp.status === 0) {
    const m = /Version:\s*(\S+)/.exec(fp.stdout || '');
    return withVersion({ kind: 'flatpak', cmd: 'flatpak', args: ['run'], version: m ? m[1] : null });
  }
  return null;
}

function removeDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

// Usuwa stare foldery z wybranymi plikami (zostają do 24 h, bo WhatsApp czyta je dopiero przy wysyłaniu).
function cleanupOld(maxAgeMs = KEEP_MS, now = Date.now()) {
  const base = pickBase();
  let names = [];
  try { names = fs.readdirSync(base); } catch { return; }
  for (const n of names) {
    const dir = path.join(base, n);
    try { if (now - fs.statSync(dir).mtimeMs > maxAgeMs) removeDir(dir); } catch {}
  }
}

// Uruchamia linux-icloud-photos w trybie wyboru i czeka na zamknięcie jego okna.
// Zwraca { status: 'ok' | 'cancelled' | 'error', files, errors, detail }.
function runPicker(app, { max = MAX_FILES, spawn = cp.spawn } = {}) {
  return new Promise((resolve) => {
    let dir, filesDir, out;
    try {
      const base = pickBase();
      fs.mkdirSync(base, { recursive: true });
      dir = fs.mkdtempSync(path.join(base, 'p-'));
      filesDir = path.join(dir, 'files');
      out = path.join(dir, 'result.json');
    } catch (e) {
      return resolve({ status: 'error', files: [], errors: [], detail: String(e.message || e) });
    }
    const pickArgs = ['--pick', '--pick-out', out, '--pick-dir', filesDir, '--pick-max', String(max)];
    const args = app.kind === 'flatpak'
      ? ['run', `--filesystem=${path.dirname(pickBase())}`, FLATPAK_ID, ...pickArgs]  // piaskownica musi widzieć folder
      : [...app.args, ...pickArgs];
    const t0 = Date.now();
    let done = false;
    const finish = (r) => {
      if (done) return;
      done = true;
      if (r.status !== 'ok') removeDir(dir);
      resolve({ files: [], errors: [], ...r });
    };

    let child;
    try { child = spawn(app.cmd, args, { stdio: 'ignore' }); } catch (e) { return finish({ status: 'error', detail: String(e.message || e) }); }
    child.on('error', (e) => finish({ status: 'error', detail: e.message }));
    child.on('exit', (code) => {
      let result = null;
      try { result = JSON.parse(fs.readFileSync(out, 'utf8')); } catch {}
      if (result && !result.cancelled && Array.isArray(result.files) && result.files.length) {
        const root = path.resolve(filesDir) + path.sep;   // przyjmujemy tylko pliki z naszego folderu
        const files = result.files.filter((f) => f && typeof f.path === 'string'
          && path.resolve(f.path).startsWith(root) && fs.existsSync(f.path));
        const errors = Array.isArray(result.errors) ? result.errors.map(String) : [];
        return finish(files.length ? { status: 'ok', files, errors } : { status: 'error', errors, detail: 'brak plików' });
      }
      if (result && result.cancelled) return finish({ status: 'cancelled' });
      // bez pliku wyniku: szybkie wyjście z błędem = aplikacja nie wystartowała; późne = zamknięte okno
      finish({ status: code !== 0 && Date.now() - t0 < 5000 ? 'error' : 'cancelled', detail: `kod ${code}` });
    });
  });
}

// Podaje pliki do pola <input type=file>, które WhatsApp otworzył (zapamiętane w window.__whazzappLastInput).
// Używa protokołu DevTools (DOM.setFileInputFiles), czyli tak, jak zrobiłoby to systemowe okno wyboru:
// pole dostaje pliki i zdarzenia input/change, a WhatsApp pokazuje swój ekran podglądu z opisem.
async function attachFiles(webContents, paths) {
  const dbg = webContents.debugger;
  let attachedHere = false;
  if (!dbg.isAttached()) { dbg.attach('1.3'); attachedHere = true; }
  try {
    const ev = await dbg.sendCommand('Runtime.evaluate', { expression: 'window.__whazzappLastInput' });
    const objectId = ev && ev.result && ev.result.objectId;
    if (!objectId) throw new Error('nie znaleziono pola wyboru plików na stronie');
    await dbg.sendCommand('DOM.enable');
    await dbg.sendCommand('DOM.setFileInputFiles', { objectId, files: paths });
  } finally {
    if (attachedHere) { try { dbg.detach(); } catch {} }
  }
}

module.exports = {
  MIN_VERSION, MAX_FILES, FLATPAK_ID, pickBase, compareVersions, detect, cleanupOld, runPicker, attachFiles,
};
