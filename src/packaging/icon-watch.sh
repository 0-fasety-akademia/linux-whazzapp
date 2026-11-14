#!/bin/sh
# linux-whazzapp: small background helper that keeps the app icon (dock, app menu) in step with the system
# light/dark theme, also while the app is closed. It does nothing else and does not start the app.
# Dark: the dark icon is copied to ~/.local/share/icons (wins over /usr/share). Light: the copy is removed,
# so the light icon of the package is used. The app starts it (and adds it to the login autostart).
DIR=$(dirname "$(readlink -f "$0")")
[ -f "$DIR/icons/icon-dark.png" ] || exit 0
# one helper per user session
LOCK="${XDG_RUNTIME_DIR:-/tmp}/linux-whazzapp-icon.lock"
exec 9>"$LOCK" && flock -n 9 || exit 0
BASE="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor"
DST="$BASE/512x512/apps/linux-whazzapp.png"

is_dark() {
    case "$(gsettings get org.gnome.desktop.interface color-scheme 2>/dev/null)" in *dark*) return 0 ;; esac
    case "$(gsettings get org.gnome.desktop.interface gtk-theme 2>/dev/null)" in *-dark*|*-Dark*) return 0 ;; esac
    return 1
}

apply() {
    if is_dark; then
        cmp -s "$DIR/icons/icon-dark.png" "$DST" 2>/dev/null || { mkdir -p "$(dirname "$DST")" && cp "$DIR/icons/icon-dark.png" "$DST"; }
    else
        rm -f "$DST"
    fi
    touch "$BASE" "$BASE/.." 2>/dev/null || true  # make the shell re-read the icon theme
}

apply
gsettings monitor org.gnome.desktop.interface 2>/dev/null | while read -r line; do
    case "$line" in *color-scheme*|*gtk-theme*) [ -f "$DIR/icons/icon-dark.png" ] || exit 0; apply ;; esac
done
