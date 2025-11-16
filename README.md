# Focus Control

**Focus Control** — a small GNOME Shell extension that gives you directional
window focusing (like a tiling WM).

![cover](thumbnail.gif)

---

# Features

* Directional focusing: focus window **Left / Right / Up / Down**.
* Four **configurable** keybindings (one per direction).
* Brief blue border highlights the newly focused window.
* Lightweight and designed to complement tiling/snap extensions (e.g., gTile).

---

# Installation

1. Install via the GNOME Extensions website or your distro package (if available), or copy the extension folder to `~/.local/share/gnome-shell/extensions/focus-control@yourname/`.
2. Enable the extension using GNOME Extensions app or `gnome-extensions` CLI:

   ```
   gnome-extensions enable focus-control@yourname
   ```
3. (X11) To apply changes you can restart GNOME Shell with `Alt+F2`, type `r`, press Enter.
   (Wayland) Log out and log back in if needed.

---

# Usage

* Open the extension settings (Extensions app → Focus Control) to assign keybindings.
* There are four actions to bind: **Focus Left**, **Focus Right**, **Focus Up**, **Focus Down**.
* Press the bound key to move focus in that direction. The focused window will be outlined with a temporary blue border.

*Tip:* Pair Focus Control with [gTile](https://github.com/gTile) or other tiling helpers — gTile arranges windows, Focus Control lets you navigate them quickly.

