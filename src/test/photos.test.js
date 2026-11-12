// Testy photos.js (Node.js, bez Electrona): node --test test/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'wz-home-'));
process.env.HOME = HOME;                     // pickBase() liczy od HOME
const photos = require('../photos');

test('compareVersions', () => {
  const c = photos.compareVersions;
  assert.strictEqual(c('0.14.0', '0.14.0'), 0);
  assert.strictEqual(c('0.13.9', '0.14.0'), -1);
  assert.strictEqual(c('0.14.1', '0.14.0'), 1);
  assert.strictEqual(c('0.14', '0.14.0'), 0);
  assert.strictEqual(c('1.0.0', '0.14.0'), 1);
  assert.strictEqual(c('0.14.0-1', '0.14.0'), 1);   // wersja z poprawką paczki
  assert.strictEqual(c('0.9.9', '0.14.0'), -1);     // porównanie liczbowe, nie tekstowe
});

const sync = (map) => (cmd) => map[cmd] || { status: 1, stdout: '' };

test('detect: nic nie zainstalowane', () => {
  assert.strictEqual(photos.detect({ env: {}, exists: () => false, spawnSync: sync({}) }), null);
});
test('detect: deb w nowej wersji', () => {
  const r = photos.detect({ env: {}, exists: (p) => p === '/usr/bin/linux-icloud-photos',
    spawnSync: sync({ 'dpkg-query': { status: 0, stdout: '0.14.0\n' } }) });
  assert.deepStrictEqual([r.kind, r.version, r.ok], ['deb', '0.14.0', true]);
});
test('detect: deb w starej wersji', () => {
  const r = photos.detect({ env: {}, exists: (p) => p === '/usr/bin/linux-icloud-photos',
    spawnSync: sync({ 'dpkg-query': { status: 0, stdout: '0.13.9' } }) });
  assert.deepStrictEqual([r.kind, r.version, r.ok], ['deb', '0.13.9', false]);
});
test('detect: deb bez dpkg-query (wersja nieznana) jest dopuszczony', () => {
  const r = photos.detect({ env: {}, exists: (p) => p === '/usr/bin/linux-icloud-photos', spawnSync: sync({}) });
  assert.deepStrictEqual([r.kind, r.version, r.ok], ['deb', null, true]);
});
test('detect: flatpak', () => {
  const r = photos.detect({ env: {}, exists: () => false,
    spawnSync: sync({ flatpak: { status: 0, stdout: 'ID: local.linuxicloudphotos.Photos\nVersion: 0.14.2\n' } }) });
  assert.deepStrictEqual([r.kind, r.cmd, r.version, r.ok], ['flatpak', 'flatpak', '0.14.2', true]);
});
test('detect: własna ścieżka z WHAZZAPP_PHOTOS_CMD ma pierwszeństwo', () => {
  const r = photos.detect({ env: { WHAZZAPP_PHOTOS_CMD: '/opt/x' }, exists: () => true, spawnSync: sync({}) });
  assert.deepStrictEqual([r.kind, r.cmd, r.ok], ['custom', '/opt/x', true]);
});

// Atrapa aplikacji: skrypt Node zapisujący wynik tak jak linux-icloud-photos --pick.
function fakeApp(body) {
  const file = path.join(HOME, `fake-${Math.random().toString(36).slice(2)}.js`);
  fs.writeFileSync(file, `
const a = process.argv.slice(2); const get = (k) => a[a.indexOf(k) + 1];
const fs = require('fs'); const path = require('path');
const out = get('--pick-out'), dir = get('--pick-dir'), max = get('--pick-max');
fs.mkdirSync(dir, { recursive: true });
${body}`);
  return { kind: 'custom', cmd: process.execPath, args: [file], version: null, ok: true };
}

test('runPicker: wybrano pliki', async () => {
  const app = fakeApp(`
    const p1 = path.join(dir, 'a.jpg'), p2 = path.join(dir, 'b.mp4');
    fs.writeFileSync(p1, 'x'); fs.writeFileSync(p2, 'y');
    fs.writeFileSync(out, JSON.stringify({ version: 1, cancelled: false, errors: ['c.heic: HTTP 500'],
      files: [{ path: p1, kind: 'photo' }, { path: p2, kind: 'video' }, { path: '/etc/passwd', kind: 'photo' }, { path: path.join(dir, 'missing.jpg') }] }));
    process.exit(Number(max) === 30 ? 0 : 9);`);
  const r = await photos.runPicker(app, { max: 30 });
  assert.strictEqual(r.status, 'ok');
  assert.deepStrictEqual(r.files.map((f) => path.basename(f.path)), ['a.jpg', 'b.mp4']);  // obce i brakujące odrzucone
  assert.deepStrictEqual(r.errors, ['c.heic: HTTP 500']);
  assert.ok(fs.existsSync(r.files[0].path), 'pliki zostają, bo WhatsApp czyta je przy wysyłaniu');
});
test('runPicker: anulowano (cancelled w JSON)', async () => {
  const app = fakeApp(`fs.writeFileSync(out, JSON.stringify({ version: 1, cancelled: true, errors: [], files: [] })); process.exit(1);`);
  const r = await photos.runPicker(app);
  assert.strictEqual(r.status, 'cancelled');
});
test('runPicker: szybki błąd bez wyniku = error', async () => {
  const r = await photos.runPicker(fakeApp(`process.exit(1);`));
  assert.strictEqual(r.status, 'error');
});
test('runPicker: brak pliku wykonywalnego = error', async () => {
  const r = await photos.runPicker({ kind: 'custom', cmd: '/nie/ma/takiego', args: [], ok: true });
  assert.strictEqual(r.status, 'error');
});
test('runPicker: puste zaznaczenie z poprawnym JSON = error, nie wysyła niczego', async () => {
  const app = fakeApp(`fs.writeFileSync(out, JSON.stringify({ version: 1, cancelled: false, errors: [], files: [{ path: '/etc/hostname' }] })); process.exit(0);`);
  const r = await photos.runPicker(app);
  assert.strictEqual(r.status, 'error');   // plik spoza folderu wyboru jest odrzucany
});
test('runPicker: flatpak dostaje dostęp do folderu', async () => {
  let seen;
  const fakeSpawn = (cmd, args) => { seen = [cmd, args]; const { EventEmitter } = require('events'); const e = new EventEmitter(); setImmediate(() => e.emit('exit', 1)); return e; };
  await photos.runPicker({ kind: 'flatpak', cmd: 'flatpak', args: ['run'], ok: true }, { spawn: fakeSpawn });
  assert.strictEqual(seen[0], 'flatpak');
  assert.deepStrictEqual(seen[1].slice(0, 3), ['run', `--filesystem=${path.dirname(photos.pickBase())}`, photos.FLATPAK_ID]);
  assert.ok(seen[1].includes('--pick') && seen[1].includes('--pick-out') && seen[1].includes('--pick-dir'));
});

test('cleanupOld usuwa tylko stare foldery', () => {
  const base = photos.pickBase(); fs.mkdirSync(base, { recursive: true });
  const oldDir = path.join(base, 'p-old'), newDir = path.join(base, 'p-new');
  fs.mkdirSync(oldDir, { recursive: true }); fs.mkdirSync(newDir, { recursive: true });
  const past = new Date(Date.now() - 48 * 3600 * 1000); fs.utimesSync(oldDir, past, past);
  photos.cleanupOld();
  assert.ok(!fs.existsSync(oldDir)); assert.ok(fs.existsSync(newDir));
});

test('attachFiles: używa DOM.setFileInputFiles na zapamiętanym polu i odpina debugger', async () => {
  const calls = []; let attached = false;
  const wc = { debugger: {
    isAttached: () => attached, attach: () => { attached = true; }, detach: () => { attached = false; },
    sendCommand: async (m, p) => { calls.push([m, p]); return m === 'Runtime.evaluate' ? { result: { objectId: 'obj1' } } : {}; },
  } };
  await photos.attachFiles(wc, ['/x/a.jpg', '/x/b.jpg']);
  assert.deepStrictEqual(calls.map((c) => c[0]), ['Runtime.evaluate', 'DOM.enable', 'DOM.setFileInputFiles']);
  assert.deepStrictEqual(calls[2][1], { objectId: 'obj1', files: ['/x/a.jpg', '/x/b.jpg'] });
  assert.strictEqual(attached, false);
});
test('attachFiles: brak pola na stronie = błąd i odpięty debugger', async () => {
  let attached = false;
  const wc = { debugger: { isAttached: () => attached, attach: () => { attached = true; }, detach: () => { attached = false; },
    sendCommand: async () => ({ result: { type: 'object', subtype: 'null' } }) } };
  await assert.rejects(() => photos.attachFiles(wc, ['/x/a.jpg']), /nie znaleziono pola/);
  assert.strictEqual(attached, false);
});
