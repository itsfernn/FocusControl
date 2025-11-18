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

let showHighlight = true;

let overviewSignalIds = [null, null];
let windowSignalIds = [null, null];
let focusSignalId = null;

let timerId = null;

let focusWindow = null;
let highlightRect = null;


export default class FocusControl extends Extension {

    enable() {
        this._settings = this.getSettings();

        this._registerHotkey('focus-up', () => this.changeFocus(Direction.UP));
        this._registerHotkey('focus-down', () => this.changeFocus(Direction.DOWN));
        this._registerHotkey('focus-left', () => this.changeFocus(Direction.LEFT));
        this._registerHotkey('focus-right', () => this.changeFocus(Direction.RIGHT));

        this._setupSignals();
    }


    disable() {
        this._settings = null;
        showHighlight = null;

        this._unregisterHotkey('focus-up');
        this._unregisterHotkey('focus-down');
        this._unregisterHotkey('focus-left');
        this._unregisterHotkey('focus-right');

        this._destroyHighlight();
        this._destroyTimer();

        this._disconnectSignals();
    }


    _setupSignals() {
        overviewSignalIds[0] = Main.overview.connect('shown', () => {
            showHighlight = false;
        });

        overviewSignalIds[1] = Main.overview.connect('hidden', () => {
            showHighlight = true;
            if (focusWindow) {
                this.drawHighlightAroundWindow(focusWindow);
            }
        });

        focusSignalId = global.display.connect('notify::focus-window', () => {
            if (focusWindow) {
                for (let i = 0; i < windowSignalIds.length; i++) {
                    if (windowSignalIds[i]) {
                        focusWindow.disconnect(windowSignalIds[i]);
                        windowSignalIds[i] = null;
                    }
                }
            }

            // update to new window
            focusWindow = global.display.get_focus_window();
            if (!focusWindow)
                return;

            // connect new signals
            windowSignalIds[0] = focusWindow.connect('size-changed', () => {
                this.drawHighlightAroundWindow(focusWindow);
            });
            windowSignalIds[1] = focusWindow.connect('position-changed', () => {
                this.drawHighlightAroundWindow(focusWindow);
            });

            this.drawHighlightAroundWindow(focusWindow);
        });

    }

    _disconnectSignals() {
        for (let i = 0; i < overviewSignalIds.length; i++) {
            if (overviewSignalIds[i]) {
                Main.overview.disconnect(overviewSignalIds[i]);
                overviewSignalIds[i] = null;
            }
        }

        if (focusSignalId) {
            global.display.disconnect(focusSignalId);
            focusSignalId = null;
        }

        if (focusWindow) {
            for (let i = 0; i < windowSignalIds.length; i++) {
                if (windowSignalIds[i]) {
                    focusWindow.disconnect(windowSignalIds[i]);
                    windowSignalIds[i] = null;
                }
            }
            focusWindow = null;
        }
    }

    _registerHotkey(name, callback) {
        Main.wm.addKeybinding(
            name,                         // GSettings key
            this._settings,                     // Where the keybinding is stored
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL,      // Hotkeys work in normal mode
            callback                      // THIS FUNCTION RUNS ON KEY PRESS
        );
    }

    _unregisterHotkey(name) {
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

        let best = null;
        let bestDistance = Infinity;

        const threshold = 10; // pixels

        for (const win of windows) {
            if (win === currentWindow) continue;
            const fw = win.get_frame_rect();

            // Direction filter
            switch (dir) {
                case Direction.RIGHT:
                    if (fw.x + fw.width < cw.x + cw.width) continue;
                    break;
                case Direction.LEFT:
                    if (fw.x > cw.x) continue;
                    break;
                case Direction.UP:
                    if (fw.y > cw.y) continue;
                    break;
                case Direction.DOWN:
                    if (fw.y + fw.height < cw.y + cw.height) continue;
                    break;
            }

            let dx = Math.max(cw.x - (fw.x + fw.width), fw.x - (cw.x + cw.width), 0);
            let dy = Math.max(cw.y - (fw.y + fw.height), fw.y - (cw.y + cw.height), 0);

            const overlapX = dx === 0;
            const overlapY = dy === 0;

            // skip windows that overlap only in movemnt axis (e.g. direcly above when moving to the side)
            if (dir == Direction.LEFT || dir == Direction.RIGHT) {
                if (!overlapY && overlapX) continue;
            }
            if (dir == Direction.UP || dir == Direction.DOWN) {
                if (!overlapX && overlapY) continue;
            }

            // clamp values for partial overlaps
            const partialOverlap = overlapX !== overlapY;
            if (partialOverlap) {
                if (overlapX) dx = 0;
                if (overlapY) dy = 0;
            }

            const dist = dx + dy;


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

        best?.activate(global.get_current_time());
        this.drawHighlightAroundWindow(best || currentWindow);
    }


    _destroyHighlight() {
        if (highlightRect) {
            Main.uiGroup.remove_child(highlightRect);
            highlightRect.destroy();
            highlightRect = null;
        }
    }

    _destroyTimer() {
        if (timerId) {
            GLib.source_remove(timerId);
            timerId = null;
        }
    }

    drawHighlightAroundWindow(window) {
        if (!showHighlight) {
            return;
        }

        if (!highlightRect) {
            highlightRect = new St.Widget({ reactive: false });
            Main.uiGroup.add_child(highlightRect);
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


        highlightRect.set_position(cw.x, cw.y);
        highlightRect.set_size(cw.width, cw.height);
        highlightRect.set_style(style);
        highlightRect.show();



        const duration = this._settings.get_int('highlight-duration') || 350;

        this._destroyTimer();

        timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, duration, () => {
            highlightRect.hide();
            timerId = null;
            return GLib.SOURCE_REMOVE
        });

    }
}






