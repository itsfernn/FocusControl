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

    #escape(text) {
        return text.split(">").map(t => t.replace("<", "")).join(" + ");
    }


    _shortcutRow(key) {
        const settings = this._settings;
        const schemaKey = settings.settings_schema.get_key(key);

        const row = new Adw.ActionRow({
            title: schemaKey.get_summary() || key,
            activatable: true,
        });

        const label = new Gtk.Label({
            label: "",
            xalign: 0,
            ellipsize: Pango.EllipsizeMode.END,
            use_markup: true,
        });

        row.add_suffix(label);

        const updateLabel = () => {
            const val = settings.get_strv(key);


            if (val.length) {
                const keybindLabel = val
                    .map(v =>
                        this.#escape(v)
                    )
                    .join("; ");

                label.label = `<b>${keybindLabel}</b>`;
            } else {
                label.label = `<i>no Keybinding</i>`;
            }
        };
        let acceleratorName = undefined;
        updateLabel();

        row.connect("activated", () => {
            const dialog = new Adw.MessageDialog({
                heading: "Set shortcut",
                modal: true,
            });

            const updateBody = (name) => {
                name = name ? `${this.#escape(name)}` : "no Keybinding";
                dialog.body = `Enter a new shortcut, ESC to cancel, or Backspace to clear.\n\n${name}`;
            };

            updateBody(settings.get_strv(key)[0] || null);



            const controller = new Gtk.EventControllerKey();
            dialog.add_controller(controller);

            dialog.add_response("save", "Save");
            dialog.set_response_appearance("save", Adw.ResponseAppearance.SUGGESTED);

            dialog.add_response("cancel", "Cancel");
            dialog.set_response_appearance("cancel", Adw.ResponseAppearance.DEFAULT);

            dialog.connect("response", (_, response) => {
                switch (response) {
                    case "save":
                        if (acceleratorName === null) {
                            this._settings.set_strv(key, []);
                        } else {
                            this._settings.set_strv(key, [acceleratorName]);
                        }
                        break;
                    case "cancel":
                        break;
                }

                updateLabel();
                dialog.close();
            });



            controller.connect("key-pressed", (ctrl, _, keycode, mask) => {
                const event = ctrl.get_current_event();
                const display = event.get_display();
                const { keyval, modifier } =
                    this.#normalizeKeyvalAndMask(display, keycode, mask, ctrl.get_group());


                if (event.is_modifier()) {
                    return Gdk.EVENT_STOP;
                }

                switch (keyval) {
                    case Gdk.KEY_Escape:
                        updateLabel();
                        dialog.close();
                        return Gdk.EVENT_STOP;
                    case Gdk.KEY_BackSpace:
                        acceleratorName = null;
                        break;
                    case Gdk.KEY_Return:
                        if (modifier === 0) {
                            // <Enter> may confirm a shortcut, if one was recognized already.
                            // But <Enter> may also serve as legitimate shortcut on its own.
                            // To differentiate between the two cases, it is checked whether
                            // another shortcut had already been provided.
                            if (acceleratorName === undefined) {
                                acceleratorName = Gtk.accelerator_name(keyval, modifier);
                                break;
                            } else if (acceleratorName === null) {
                                this._settings.set_strv(key, []);
                                updateLabel();
                                dialog.close();
                            } else {
                                this._settings.set_strv(key, [acceleratorName]);
                                updateLabel();
                                dialog.close();
                            }
                            return Gdk.EVENT_STOP;
                        }
                    // intentionally fallthrough
                    default:
                        acceleratorName = Gtk.accelerator_name(keyval, modifier);
                }

                const name = acceleratorName ?? null;
                updateBody(name);

                return Gdk.EVENT_STOP;
            });
            dialog.present();

        });
        return row;
    }

    // https://gitlab.gnome.org/GNOME/gnome-control-center/-/blob/a936ac6bc9d5a01dd2c3fcb905189570ecd72753/panels/keyboard/keyboard-shortcuts.c#L388
    #normalizeKeyvalAndMask(display, code, mask, keyGroup) {
        // Note that GDK may add internal values to events which include values
        // outside of the Gdk.ModifierType enumeration. Usually the code should
        // preserve and ignore them.
        // That being said, the `Gdk.Display.translate_key` method throws an error
        // when these internal values are preserved. Thus, for the purpose of
        // normalization it is vital to ignore these bits beforehand.
        // https://gitlab.gnome.org/GNOME/gtk/-/blob/69500f356e61e437853f44c992c9bbca2ae5f8f7/gdk/gdkenums.h#L111-113
        mask &= Gdk.MODIFIER_MASK;

        let explicitModifiers = Gtk.accelerator_get_default_mod_mask();

        // We want shift to always be included as explicit modifier for gnome-shell
        // shortcuts.That's because users usually think of shortcuts as including
        // the shift key rather than being defined for the shifted keyval.
        // This helps with num - row keys which have different keyvals on different
        // layouts for example, but also with keys that have explicit key codes at
        // shift level 0, that gnome-shell would prefer over shifted ones, such the
        // DOLLAR key.
        explicitModifiers |= Gdk.ModifierType.SHIFT_MASK;

        // CapsLock isn't supported as a keybinding modifier, so keep it from
        // confusing us.
        // https://gitlab.gnome.org/GNOME/gnome-control-center/-/blob/a936ac6bc9d5a01dd2c3fcb905189570ecd72753/panels/keyboard/cc-keyboard-shortcut-editor.c#L713
        explicitModifiers &= ~Gdk.ModifierType.LOCK_MASK;

        const usedModifiers = mask & explicitModifiers;

        let [, unmodifiedKeyval] = display.translate_key(
            code, mask & ~explicitModifiers, keyGroup);
        const [, shiftedKeyval] = display.translate_key(
            code, Gdk.ModifierType.SHIFT_MASK | (mask & ~explicitModifiers), keyGroup);

        if (Gdk.KEY_0 <= shiftedKeyval && shiftedKeyval <= Gdk.KEY_9) {
            unmodifiedKeyval = shiftedKeyval;
        }

        if (unmodifiedKeyval === Gdk.KEY_ISO_Left_Tab) {
            unmodifiedKeyval = Gdk.KEY_Tab;
        }

        if (
            unmodifiedKeyval === Gdk.KEY_Sys_Req &&
            (usedModifiers & Gdk.ModifierType.ALT_MASK) != 0
        ) {
            unmodifiedKeyval = Gdk.KEY_Print;
        }

        return { keyval: unmodifiedKeyval, modifier: usedModifiers };
    }
}
