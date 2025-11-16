import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import St from 'gi://St';
import GLib from 'gi://GLib';

const Direction = {
    UP: 'up',
    DOWN: 'down',
    LEFT: 'left',
    RIGHT: 'right',
};



let highlightRect = null;
let highlightWindow = null;


function drawHighlightAroundWindow(window) {
    if (highlightRect) {
        Main.uiGroup.remove_child(highlightRect);
        highlightRect.destroy();
        highlightRect = null;
        highlightWindow = null;
    }


    if (!window) {
        log("No focused window found to highlight.");
        return;
    }

    const cw = window.get_frame_rect();

    highlightRect = new St.Widget({
        x: cw.x,
        y: cw.y,
        width: cw.width,
        height: cw.height,
        style: 'border: 4px rgba(60, 170, 220, 0.8) solid; border-radius: 10px;',
        reactive: false,
    });

    highlightWindow = window;

    Main.uiGroup.add_child(highlightRect);

    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 350, () => {
        if (highlightRect &&
            highlightWindow &&
            highlightWindow === window) {
            Main.uiGroup.remove_child(highlightRect);
            highlightRect.destroy();
            highlightRect = null;
        }
        return GLib.SOURCE_REMOVE
    });
}


export default class FocusControl extends Extension {

    enable() {
        this._settings = this.getSettings('org.gnome.shell.extensions.focuscontrol');
        this.registerHotkey('focus-up', () => this.changeFocus(Direction.UP));
        this.registerHotkey('focus-down', () => this.changeFocus(Direction.DOWN));
        this.registerHotkey('focus-left', () => this.changeFocus(Direction.LEFT));
        this.registerHotkey('focus-right', () => this.changeFocus(Direction.RIGHT));

    }

    disable() {
        this._settings = null;
        this.unregisterHotkey('focus-up');
        this.unregisterHotkey('focus-down');
        this.unregisterHotkey('focus-left');
        this.unregisterHotkey('focus-right');
    }

    registerHotkey(name, callback) {
        Main.wm.addKeybinding(
            name,                         // GSettings key
            this._settings,                     // Where the keybinding is stored
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL,      // Hotkeys work in normal mode
            callback                      // THIS FUNCTION RUNS ON KEY PRESS
        );
    }

    unregisterHotkey(name) {
        Main.wm.removeKeybinding(name);
    }

    changeFocus(dir) {
        const currentWindow = global.display.get_focus_window();

        const workspace = global.workspace_manager.get_active_workspace();
        const windows = workspace.list_windows().filter(win => !(
            win === currentWindow ||
            win.minimized ||
            win.get_frame_type() !== Meta.FrameType.NORMAL
        ));

        const cw = currentWindow.get_frame_rect();
        const cx = cw.x + cw.width / 2;
        const cy = cw.y + cw.height / 2;

        let best = null;
        let bestDistance = Infinity;

        const threshold = 10; // pixels

        for (const win of windows) {
            const fw = win.get_frame_rect();
            const fx = fw.x + fw.width / 2;
            const fy = fw.y + fw.height / 2;

            // Direction filter
            switch (dir) {
                case Direction.RIGHT:
                    if (fx <= cx + threshold) continue;
                    break;
                case Direction.LEFT:
                    if (fx >= cx - threshold) continue;
                    break;
                case Direction.UP:
                    if (fy >= cy - threshold) continue;
                    break;
                case Direction.DOWN:
                    if (fy <= cy + threshold) continue;
                    break;
            }

            // Distance
            const dist = Math.hypot(fx - cx, fy - cy);

            if (dist < bestDistance) {
                bestDistance = dist;
                best = win;
            }
        }

        if (best) {
            best.activate(global.get_current_time());
            drawHighlightAroundWindow(best);
        }
    }
}






