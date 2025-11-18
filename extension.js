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


export default class FocusControl extends Extension {

    enable() {
        this._settings = this.getSettings();
        this.highlightRect = null;

        this.registerHotkey('focus-up', () => this.changeFocus(Direction.UP));
        this.registerHotkey('focus-down', () => this.changeFocus(Direction.DOWN));
        this.registerHotkey('focus-left', () => this.changeFocus(Direction.LEFT));
        this.registerHotkey('focus-right', () => this.changeFocus(Direction.RIGHT));
    }

    disable() {
        if (this.timeoutId) {
            GLib.source_remove(this.timeoutId);
            this.timeoutId = null;
        }

        if (this.highlightRect) {
            Main.uiGroup.remove_child(this.highlightRect);
            this.highlightRect.destroy();
            this.highlightRect = null;
        }

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

            if (bestDistance - dist > threshold) {
                bestDistance = dist;
                best = win;
            } else if (dist - bestDistance < threshold) {
                // Tie-breaker: prefer more recent windows
                if (win.get_user_time() > best.get_user_time()) {
                    bestDistance = dist;
                    best = win;
                }
            }
        }

        if (best) {
            best.activate(global.get_current_time());
            this.drawHighlightAroundWindow(best);
        } else {
            this.drawHighlightAroundWindow(currentWindow);
        }
    }

    drawHighlightAroundWindow(window) {
        if (this.highlightRect) {
            Main.uiGroup.remove_child(this.highlightRect);
            this.highlightRect.destroy();
            this.highlightRect = null;
        }

        if (!window) {
            log("No focused window found to highlight.");
            return;
        }

        const cw = window.get_frame_rect();


        const border_color = this._settings.get_string('border-color') || "#3caadc";
        const corner_radius = this._settings.get_int('corner-radius') || 10;
        const border_width = this._settings.get_int('border-width') || 4;

        const style = 'border: ' + border_width + 'px solid ' + border_color + '; ' +
            'border-radius: ' + corner_radius + 'px; ';


        this.highlightRect = new St.Widget({
            x: cw.x,
            y: cw.y,
            width: cw.width,
            height: cw.height,
            style: style,
            reactive: false,
        });

        Main.uiGroup.add_child(this.highlightRect);

        if (this.timeoutId) {
            GLib.source_remove(this.timeoutId);
            this.timeoutId = null;
        }

        const highlight_duration = this._settings.get_int('highlight-duration') || 350;

        this.timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, highlight_duration, () => {
            if (this.highlightRect) {
                Main.uiGroup.remove_child(this.highlightRect);
                this.highlightRect.destroy();
                this.highlightRect = null;
            }
            return GLib.SOURCE_REMOVE
        });
    }
}






