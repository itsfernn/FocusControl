import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import Pango from "gi://Pango";
import Gdk from "gi://Gdk";

import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class Preferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._settings = this.getSettings('org.gnome.shell.extensions.focuscontrol');

        window.set_default_size(600, 650);
        window.set_search_enabled(true);

        window.add(this._buildKeybindingsPage());
    }

    _buildKeybindingsPage() {
        const page = new Adw.PreferencesPage({
            title: "Focus Keybindings",
            icon_name: "preferences-desktop-keyboard-shortcuts-symbolic",
        });

        page.add(this._buildKeybindingsGroup());
        page.add(this._buildBorderStyleGroup());

        return page;
    }

    _buildKeybindingsGroup() {
        const group = new Adw.PreferencesGroup({
            title: "Window Focus Shortcuts",
            description: "Configure directional focus movement shortcuts.",
        });

        group.add(this._shortcutRow("focus-up"));
        group.add(this._shortcutRow("focus-left"));
        group.add(this._shortcutRow("focus-right"));
        group.add(this._shortcutRow("focus-down"));

        return group;
    }



    _buildBorderStyleGroup() {
        const group = new Adw.PreferencesGroup({
            title: "Highlight Border Style",
            description: "Configure the appearance of the focus highlight border.",
        });

        // add row to set border width (setting: border-width)
        group.add(this._spinRow("border-width", 1, 20, 1));
        group.add(this._spinRow("corner-radius", 0, 20, 1));
        group.add(this._colorRow("border-color"));

        return group;
    }

    _spinRow(schemaKey, lower, upper, step) {
        const settingsSchemaKey = this._settings.settings_schema.get_key(schemaKey);
        const row = new Adw.SpinRow({
            title: settingsSchemaKey.get_summary() ?? undefined,
        });
        row.adjustment.lower = lower;
        row.adjustment.upper = upper;
        row.adjustment.step_increment = step;
        row.adjustment.page_increment = step * 10;
        this._settings.bind(schemaKey, row, "value", Gio.SettingsBindFlags.DEFAULT);

        return row;
    }

    _colorRow(schemaKey) {
        const summary = this._settings.settings_schema.get_key(schemaKey).get_summary();
        const row = new Adw.ActionRow({ title: summary ?? undefined });
        const colorDialog = new Gtk.ColorDialog();
        const button = new Gtk.ColorDialogButton({ dialog: colorDialog, });

        const rgba = new Gdk.RGBA();
        rgba.parse(this._settings.get_string(schemaKey));
        button.rgba = rgba;

        button.connect("notify::rgba", () => {
            const newRgba = button.rgba;
            this._settings.set_string(schemaKey, newRgba.to_string());
        });

        row.add_suffix(button);
        row.activatable_widget = button;

        return row;
    }


    _entryRow(schemaKey) {
        const settingsSchemaKey = this._settings.settings_schema.get_key(schemaKey);
        const row = new Adw.EntryRow({
            title: settingsSchemaKey.get_summary() ?? undefined,
            editable: true,
            show_apply_button: true,
        });
        this._settings.bind(schemaKey, row, "text", Gio.SettingsBindFlags.DEFAULT);

        return row;
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

