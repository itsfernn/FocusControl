import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import Pango from "gi://Pango";

import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class Preferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._settings = this.getSettings('org.gnome.shell.extensions.focuscontrol');

        window.set_default_size(600, 400);
        window.set_search_enabled(true);

        window.add(this._buildKeybindingsPage());
    }

    _buildKeybindingsPage() {
        const page = new Adw.PreferencesPage({
            title: "Focus Keybindings",
            icon_name: "preferences-desktop-keyboard-shortcuts-symbolic",
        });

        const group = new Adw.PreferencesGroup({
            title: "Window Focus Shortcuts",
            description: "Configure directional focus movement shortcuts.",
        });
        page.add(group);

        group.add(this._shortcutRow("focus-up"));
        group.add(this._shortcutRow("focus-left"));
        group.add(this._shortcutRow("focus-right"));
        group.add(this._shortcutRow("focus-down"));

        return page;
    }

    /* ---------------------------
     * ShortcutRow helper
     * --------------------------- */
    _shortcutRow(key) {
        const settings = this._settings;
        const schemaKey = settings.settings_schema.get_key(key);

        const row = new Adw.ActionRow({
            title: schemaKey.get_summary() || key,
            activatable: true,
        });

        const label = new Gtk.Label({
            label: "<Unset>",
            xalign: 0,
            ellipsize: Pango.EllipsizeMode.END,
            use_markup: true,
        });

        row.add_suffix(label);

        const updateLabel = () => {
            const val = settings.get_strv(key);

            if (val.length) {
                // Escape Pango markup characters in the shortcut string
                const escaped_val = val.map(shortcut =>
                    shortcut.replace(/&/g, '&amp;') // Escape & first
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                );

                label.label = `<b>${escaped_val.join(", ")}</b>`;
            } else {
                label.label = "<Unset>";
            }
        };

        updateLabel();

        row.connect("activated", () => {
            const dialog = new Adw.MessageDialog({
                heading: "Set shortcut",
                body: "Press the new shortcut, ESC to cancel, or Backspace to clear.",
                modal: true,
            });

            const controller = new Gtk.EventControllerKey();
            dialog.add_controller(controller);


            controller.connect("key-pressed", (_ec, keyval, keycode, mask) => {


                mask = mask & Gtk.accelerator_get_default_mod_mask();

                if (mask === 0) {
                    switch (keyval) {
                        case Gdk.KEY_Escape:
                            dialog.close();
                            return Gdk.EVENT_STOP;
                        case Gdk.KEY_BackSpace:
                            this._settings.set_strv(key, []);
                            updateLabel();
                            dialog.close();
                            return Gdk.EVENT_STOP;
                    }
                }

                const selectedShortcut = Gtk.accelerator_name_with_keycode(
                    null,
                    keyval,
                    keycode,
                    mask
                );

                this._settings.set_strv(key, [selectedShortcut]);
                dialog.close();
                updateLabel();
                return Gdk.EVENT_STOP;

            });
            dialog.present();

        });
        return row;
    }
}

