// Settings Component - whole-app backup and restore, as a light-DOM WebComponent.

import * as Backup from '../../services/backup.js';
import { readCollection, SYNCED_KEYS } from '../../services/records.js';
import { showToast } from '../../utils/helpers.js';

const COLLECTION_LABELS = {
    'dnd-encounters': 'Encounters',
    'dnd-custom-monsters': 'Custom monsters',
    'dnd-characters': 'Characters',
    'dnd-monster-folders': 'Monster folders',
    'dnd-encounter-folders': 'Encounter folders'
};

class SettingsViewElement extends HTMLElement {
    cleanupController = null

    connectedCallback() {
        this.cleanupController = new AbortController();

        this.innerHTML = `
            <div class="settings">
                <section class="settings-section">
                    <h2>Your data</h2>
                    <ul id="settings-stats" class="settings-stats"></ul>
                </section>

                <section class="settings-section">
                    <h2>Backup</h2>
                    <p class="settings-hint">
                        Save everything to a single file, then import it on another device to move
                        your data across.
                    </p>
                    <div class="settings-actions">
                        <button type="button" id="backup-download-btn" class="btn">Download backup</button>
                        <button type="button" id="backup-copy-btn" class="btn">Copy to clipboard</button>
                    </div>
                </section>

                <section class="settings-section">
                    <h2>Restore</h2>
                    <p class="settings-hint">
                        Importing merges into what is already here. Nothing is deleted, and when the
                        same item exists on both sides the more recently edited one is kept.
                    </p>
                    <div class="settings-actions">
                        <button type="button" id="backup-file-btn" class="btn">Choose backup file</button>
                        <input type="file" id="backup-file-input" accept="application/json,.json" hidden>
                    </div>
                    <textarea id="backup-paste" class="settings-textarea" rows="6"
                        placeholder="…or paste the contents of a backup file here"></textarea>
                    <div class="settings-actions">
                        <button type="button" id="backup-import-btn" class="btn btn-primary">Import</button>
                    </div>
                </section>
            </div>
        `;

        const { signal } = this.cleanupController;

        this.querySelector('#backup-download-btn')
            .addEventListener('click', () => this.downloadBackup(), { signal });
        this.querySelector('#backup-copy-btn')
            .addEventListener('click', () => this.copyBackup(), { signal });
        this.querySelector('#backup-file-btn')
            .addEventListener('click', () => this.querySelector('#backup-file-input').click(), { signal });
        this.querySelector('#backup-file-input')
            .addEventListener('change', (e) => this.readBackupFile(e), { signal });
        this.querySelector('#backup-import-btn')
            .addEventListener('click', () => this.importBackup(), { signal });

        this.render();
    }

    disconnectedCallback() {
        this.cleanupController?.abort();
        this.cleanupController = null;
    }

    render() {
        const stats = this.querySelector('#settings-stats');
        if (!stats) return;

        stats.innerHTML = SYNCED_KEYS.map(key => `
            <li class="settings-stat">
                <span class="settings-stat-label">${COLLECTION_LABELS[key] || key}</span>
                <span class="settings-stat-value">${readCollection(key).length}</span>
            </li>
        `).join('');
    }

    backupFilename() {
        const date = new Date().toISOString().slice(0, 10);
        return `dnd-tracker-backup-${date}.json`;
    }

    downloadBackup() {
        const url = URL.createObjectURL(new Blob([Backup.exportAllData()], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = this.backupFilename();
        link.click();
        // Revoking immediately can cancel the download in some browsers.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Backup downloaded');
    }

    async copyBackup() {
        try {
            await navigator.clipboard.writeText(Backup.exportAllData());
            showToast('Backup copied to clipboard');
        } catch {
            showToast('Could not copy to clipboard', 'error');
        }
    }

    async readBackupFile(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            this.querySelector('#backup-paste').value = await file.text();
            this.importBackup();
        } catch {
            showToast('Could not read that file', 'error');
        } finally {
            // Allow re-selecting the same file after a failed import.
            event.target.value = '';
        }
    }

    importBackup() {
        const textarea = this.querySelector('#backup-paste');
        const raw = textarea.value.trim();
        if (!raw) {
            showToast('Paste a backup or choose a file first', 'error');
            return;
        }

        try {
            const { added, updated, skipped } = Backup.importAllData(raw);
            textarea.value = '';
            this.render();

            if (!added && !updated) {
                showToast(`Already up to date (${skipped} items unchanged)`);
            } else {
                showToast(`Imported ${added} new and ${updated} updated items`);
            }
        } catch (e) {
            showToast(e.message, 'error');
        }
    }
}

if (!customElements.get('settings-view')) {
    customElements.define('settings-view', SettingsViewElement);
}

export function render() {
    document.querySelector('settings-view')?.render();
}

export default { render };
