// Autosave helper shared by the edit views.
//
// The edit views have no Save button: an edit is persisted as soon as it is
// made. Typing fires an `input` event per keystroke, so those are debounced.
// `change` fires when a field is committed - on blur for text fields, and
// immediately for selects and checkboxes - so those save straight away. That
// pairing matters for navigation: clicking the header's back button blurs the
// focused field first, which commits the last edit before the view goes away.

const DEFAULT_DELAY = 300;

export function createAutosave(save, delay = DEFAULT_DELAY) {
    let timer = null;

    function cancel() {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
    }

    return {
        // Debounce a save while the user is still typing.
        schedule() {
            cancel();
            timer = setTimeout(() => {
                timer = null;
                save();
            }, delay);
        },

        // Save immediately, whether or not a debounced save was pending.
        saveNow() {
            cancel();
            save();
        },

        // Save only if one was pending, for use when leaving the view.
        flush() {
            if (timer === null) return;
            cancel();
            save();
        },

        cancel
    };
}

// Wire a form so every edit inside it is saved. Item lists rendered into the
// form are covered too: their own handlers write the change into the editing
// record, then the event bubbles up to here.
export function bindFormAutosave(form, autosave, signal) {
    form.addEventListener('input', () => autosave.schedule(), { signal });
    form.addEventListener('change', () => autosave.saveNow(), { signal });
}
