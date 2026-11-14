Copies of `assets/icon.png` and `assets/icon-dark.png` for `icon-watch.sh` (installed to
`/opt/linux-whazzapp/icons/` via `extraFiles`). They must be separate copies: electron-builder leaves out of
`app.asar` any file that is also an `extraFiles` source, and the app needs the originals in `assets/`.
Keep them identical to the files in `assets/` when the icons change.
