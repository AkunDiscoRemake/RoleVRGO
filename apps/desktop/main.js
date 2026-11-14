// RoleVRGO para PC: uma janela que abre o site do jogo (sempre a versão mais nova).
const { app, BrowserWindow, session, shell } = require('electron');
const URLc = globalThis.URL;
const URL = 'https://akundiscoremake.github.io/RoleVRGO/';
const nosso = (u) => { try { const x = new URLc(u); return x.host === 'akundiscoremake.github.io' && x.pathname.startsWith('/RoleVRGO') && !x.pathname.startsWith('/RoleVRGO/docs'); } catch (e) { return false; } };
function janela() {
  const w = new BrowserWindow({ width: 1280, height: 760, backgroundColor: '#000000', autoHideMenuBar: true, title: 'RoleVRGO', webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  w.webContents.setUserAgent(w.webContents.getUserAgent() + ' RoleVRGOApp/1.1');
  w.webContents.setWindowOpenHandler(({ url }) => { if (!nosso(url)) shell.openExternal(url); return { action: nosso(url) ? 'allow' : 'deny' }; });
  w.webContents.on('will-navigate', (ev, url) => { if (!nosso(url)) { ev.preventDefault(); shell.openExternal(url); } });
  w.webContents.on('before-input-event', (ev, i) => { if (i.type === 'keyDown' && i.key === 'F11') { w.setFullScreen(!w.isFullScreen()); ev.preventDefault(); } });
  w.loadURL(URL);
}
app.whenReady().then(() => {
  const ok = new Set(['media', 'fullscreen', 'pointerLock', 'clipboard-sanitized-write', 'xr-spatial-tracking']);
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(ok.has(perm)));
  session.defaultSession.setPermissionCheckHandler((wc, perm) => ok.has(perm));
  janela();
});
app.on('window-all-closed', () => app.quit());
