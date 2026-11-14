# linux-whazzapp

A light, unofficial WhatsApp Web client for Ubuntu (Electron) in the style of ZapZap,
with its own icon, a system tray icon and an automatic light/dark theme.

Created by: JGu  
Supported by Claude

**Version:** 1.3.11 · **License:** Freeware License (No Modifications), see `LICENSE` · **Platform:** Ubuntu (GNOME), x86_64

> This project is not affiliated with WhatsApp or Meta. The icon is original and contains
> no WhatsApp logo. The app loads the official `web.whatsapp.com` site, so it works as long
> as WhatsApp Web works.

## Features

- **System tray:** closing the window hides it to the tray, clicking the icon shows or hides
  the window. Menu: close to tray, notifications, autostart, start minimized, theme, reload, quit.
- **Desktop notifications** for new messages (sender and text).
- **Clicking a notification opens the window and the right chat**, and the notification disappears.
- **Read notifications disappear:** when you open a chat in the active window, that chat's
  notifications are closed (also from the Ubuntu notification list). When the unread counter
  drops to zero (for example after reading on your phone), all of them disappear.
- **Photos and videos from iCloud Photos:** when `linux-icloud-photos` (version 0.14.0 or newer)
  is installed, clicking "Photos & videos" in the attach menu asks "From iCloud Photos" /
  "From computer" / "Cancel". The iCloud choice opens linux-icloud-photos in read-only mode;
  you select photos and videos and click "Choose", and the files go into the open chat through
  WhatsApp's normal preview screen, where you can add a caption before sending. A Live Photo is
  sent as a still photo. HEIC photos are converted to JPEG.
- **Unread counter:** a red dot on the tray icon, the number in the tooltip and a badge on the
  dock icon (if your dock supports it).
- **Automatic day/night theme** following the Ubuntu setting, with a manual choice in the tray
  menu (Automatic / Light / Dark / Aurora). Switching the system theme takes effect live.
- **Aurora theme:** the shared look of the JGu Linux Apps series (lavender / deep navy, violet
  accents, violet outgoing bubbles), light or dark following the system. It only recolours
  WhatsApp's own colour variables, so a WhatsApp update can at most bring back some default colours.
- **Theme-dependent icons:** the tray icon and the app icon (menu, dock, window) have a light
  and a dark variant.
- **Resizable divider** between the chat list (left) and the conversation (right): drag the
  vertical edge of the chat list. The width is remembered, a double click on the edge restores
  the default. In very narrow windows (below 760 px, when WhatsApp switches to a single
  column) the divider switches itself off.
- **About** in the tray menu: version and author credit.
- **Autostart** with the system (optional; with *start minimized* it stays in the tray).
  Opening the app from the app menu always shows the window.
- Spell checking PL/EN, context menu, links open in the system browser.
- Single instance, session remembered between runs, camera and microphone for calls.

## Installation (Ubuntu)

1. Download the newest `linux-whazzapp_<version>_amd64.deb` from the [Releases page](https://github.com/jgu-linux-apps/linux-whazzapp/releases/latest).
2. Install it (apt pulls in the dependencies). Copy the file to `/tmp` first so apt does not
   print a warning about the `_apt` user having no access:
   ```
   cp ~/Downloads/linux-whazzapp_<version>_amd64.deb /tmp/
   sudo apt install /tmp/linux-whazzapp_<version>_amd64.deb
   ```
3. Start it: press Super and type "linux-whazzapp", or run `linux-whazzapp` in a terminal.
4. Sign in: on your phone open WhatsApp → Settings → Linked devices → Link a device and scan
   the QR code.
5. Optional: right-click the tray icon → start with the system.

### Upgrading

Quit the app (tray → Quit, or `pkill linux-whazzapp`) and install the newer file with the same
command. You do not need to uninstall the old version, and the session (QR login) is kept.

### Moving from the old name (WhazzApp)

Versions up to 1.2.0 were called `whazzapp`. Installing `linux-whazzapp` replaces the old package
(apt removes it by itself), and on first start the app moves the existing session and settings
to `~/.config/linux-whazzapp`, so you do not have to scan the QR code again. Old autostart
entries and icons in the user directory are removed. If you have to sign in again after the
upgrade, the old data folder may have had a different name than assumed (the app looks for
`~/.config/whazzapp` and `~/.config/WhazzApp`).

### Uninstalling

```
sudo apt remove linux-whazzapp
rm -rf ~/.config/linux-whazzapp
rm -f ~/.local/share/icons/hicolor/512x512/apps/linux-whazzapp.png
rm -f ~/.config/autostart/linux-whazzapp.desktop
```

`rm -rf ~/.config/linux-whazzapp` also removes the saved login. The last two lines clean up the
icon the app swaps and the autostart entry.

## Building from source

The source code is in the `src/` folder of this repository; the `.deb` packages are not kept in git but
attached to [GitHub Releases](https://github.com/jgu-linux-apps/linux-whazzapp/releases). Requires Node.js 18+ and npm. Run inside `src/`:

```
npm install
npm start          # run in test mode
npm run dist       # dist/linux-whazzapp_<version>_amd64.deb + AppImage
```

If `electron-builder` ends with `Cannot read properties of null (reading 'channel')` but the
`.deb` file is written to `dist/`, only the generation of update information failed. The package
itself is fine (`dpkg-deb -I dist/linux-whazzapp_<version>_amd64.deb`).

## Theme and icons

- By default the theme follows the system (Settings → Appearance). Manually: tray → Theme.
- In WhatsApp itself (Settings → Theme) choose "System default", otherwise the site ignores
  the app theme.
- Icons in the Aurora style of the series: a chat bubble with double "read" ticks on a green → cyan →
  violet tile (light), or a gradient bubble on a deep navy tile (dark). The tray icon is the same,
  with a pink dot when there are unread messages.
- The app icon is swapped in `~/.local/share/icons/hicolor/512x512/apps/linux-whazzapp.png`, also
  while the app is closed: the app starts the small helper `/opt/linux-whazzapp/icon-watch.sh`
  and adds it to the session autostart (`~/.config/autostart/linux-whazzapp-icon.desktop`).
  The application menu (Activities) may refresh it only after a while or after you log in again.
- **Aurora title bar:** in Aurora the window has its own title bar in the theme colours (the system
  one stays white); WhatsApp sits in a separate view below it. Other themes keep the system bar.
- Icon sources: `assets/icon.svg`, `assets/icon-dark.svg`, `assets/tray-*.svg`.

## Integration with linux-icloud-photos

Requirements: `linux-icloud-photos` 0.14.0+ (`.deb` or the Flatpak `local.linuxicloudphotos.Photos`),
signed in to iCloud. The app checks this at start-up and every time the window is activated, so
you do not need to restart it after installing. When linux-icloud-photos is missing or too old,
"Photos & videos" works as before (the system file dialog).

Step by step: open a chat → paperclip → "Photos & videos" → "From iCloud Photos" → select up to
30 files → "Choose" → WhatsApp preview with the caption field → Send.
The chosen files are stored temporarily in `~/.cache/linux-whazzapp/pick` and deleted after
24 hours (WhatsApp reads them only when you send). The integration can be turned off in the tray
menu. Advanced: the `WHAZZAPP_PHOTOS_CMD` variable points to a custom picker program.

## Troubleshooting

| Symptom | What to do |
|---|---|
| No icon in the top panel | `sudo apt install gnome-shell-extension-appindicator`, then log out and in. Without it "close to tray" hides the window with no easy way back, so turn that option off until it is fixed. |
| No notifications | Check Ubuntu's Do Not Disturb mode, the "Notifications" switch in the tray and Settings → Notifications inside WhatsApp. |
| Clicking a notification only shows the window | Opening the chat relies on the structure of the WhatsApp Web page, which Meta may change. Report it and the selectors will be fixed. |
| A notification does not disappear | Make sure version 1.3.x is running (tray → About); after installing, quit the app from the tray and start it again. Recognising the open chat relies on the WhatsApp page header; if Meta changes it, closing on click and when the counter reaches zero still works. |
| The chat list / conversation divider cannot be dragged | The edge of the chat list turns green on mouse-over. If it does not, WhatsApp changed the page structure and `assets/resizer.js` needs a fix. Report it. In windows narrower than 760 px the divider is switched off on purpose. |
| "Photos & videos" does not ask about iCloud | Check that `linux-icloud-photos` is version 0.14.0+ (`dpkg -s linux-icloud-photos`) and that the iCloud Photos option in the tray menu is on. If WhatsApp changed the attach menu, the app falls back to the normal file dialog. |
| Nothing happens after "Choose" | Open a chat first. Photos are passed to the field WhatsApp opened when you clicked; if you switch chats while choosing, choose again. |
| No number on the dock icon | Depends on the dock and on the window being tied to the `.desktop` entry (`desktopName` is set). The counter is also visible in the tray icon tooltip. |
| Old icon in the application menu | Log out and in to refresh the icon cache. |
| The page asks to update the browser | The app identifies itself as Chrome of the bundled engine's version. Update linux-whazzapp to a newer version. |

## Limitations

- The unread counter comes from the page title, e.g. "(3) WhatsApp". It therefore counts chats,
  not single messages, and skips muted chats. WhatsApp counts the same way in a browser.
- The tray icon in standard GNOME shows a dot, not a number.
- The resizable divider finds the left column in the WhatsApp Web page (through `#side`), so it
  may stop working if Meta changes the page layout.
- Opening the chat after clicking a notification, closing read notifications and swapping the
  app icon on theme change are new and may need fixes on different Ubuntu versions.

## Files

Paths relative to `src/`:

```
main.js                logic of the app (window, tray, notifications, theme, about)
assets/                app and tray icons (SVG + PNG, light and dark variants)
assets/titlebar.html   the window's own page: Aurora title bar, reports the window size
packaging/icon-watch.sh  keeps the dock icon light/dark while the app is closed
assets/notify-hook.js  notifications: click opens the chat, read ones disappear
assets/photos-hook.js  intercepts "Photos & videos" in the attach menu
assets/resizer.js      resizable chat list / conversation divider (injected into the page)
photos.js              linux-icloud-photos integration (detection, --pick mode, passing files)
test/                  unit tests (node --test test/photos.test.js)
build/icon.png         icon used by electron-builder
package.json           metadata and the .deb / AppImage package configuration
```

User data: `~/.config/linux-whazzapp` (session and `settings.json`).

## Version history

- **1.3.11** packaging fix: the 1.3.10 package left the app icons (`assets/icon.png`, `assets/icon-dark.png`) out of the app, so the window had no icon and the app could not switch the dock icon itself. No other changes.
- **1.3.10** Aurora title bar: in Aurora the window gets its own bar in the theme colours instead of the white system one (WhatsApp now lives in a separate view under it, and fills the window correctly when maximised). New light / dark icons in the Aurora style of the series; the dock icon follows the theme also while the app is closed. *Start minimized* now applies only to autostart: opening the app from the menu always shows the window.
- **1.3.7** Aurora now actually recolours WhatsApp: it targets the colour tokens of WhatsApp's current design (`--WDS-*`); 1.3.6 used older names that WhatsApp no longer has. Light/dark follows the system, so set WhatsApp's own theme (Settings → Theme) to *System default*.
- **1.3.6** new **Aurora** theme (tray → Theme): lavender / deep navy with violet accents, light or dark following the system. Choosing another theme removes it instantly.
- **1.3.5** license: the app is now published under the Freeware License (No Modifications), see `LICENSE`; free to use and share unmodified, modification is not permitted. No other changes in the app.
- **1.3.4** fix: the stripe left behind after shrinking the chat list (the divider now moves WhatsApp's own
  divider line together with the list)
- **1.3.3 / 1.3.2** tray item "Layout diagnostics" (copies a description of the page layout to the clipboard)
- **1.3.1** fix: in a very narrow window a leftover stripe of the resizable divider remained
  (the divider now switches off below 760 px width)
- **1.3.0** photos and videos from iCloud Photos (linux-icloud-photos 0.14.0+) in the attach
  menu, notifications disappear after reading or clicking
- **1.2.1** renamed to **linux-whazzapp** (like the rest of the series), session migration from
  the old name
- **1.2.0** resizable chat list / conversation divider, "About" with the credit
  "Created by: JGu / Supported by Claude"
- **1.1.5** theme-dependent app icon, clicking a notification opens the chat
- **1.1.4** dark tray icon variant (dark bubble)
- **1.1.3** tray icon the same as the app icon, light/dark variants
- **1.1.2** red dot removed from the app icon, `desktopName`
- **1.1.1** renamed to WhazzApp
- **1.1.0** automatic day/night theme
- **1.0.0** first version: tray, notifications, autostart

---

Created by: JGu  
Supported by Claude
