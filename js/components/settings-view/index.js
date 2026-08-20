// Settings Component - whole-app backup and restore, as a light-DOM WebComponent.

import * as Backup from '../../services/backup.js';
import * as Auth from '../../services/auth.js';
import * as Sync from '../../services/sync.js';
import { readCollection, SYNCED_KEYS, hasDirty } from '../../services/records.js';
import { isSyncConfigured } from '../../config.js';
import { showToast } from '../../utils/helpers.js';

function formatRelativeTime(timestamp) {
    const seconds = Math.round((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
    return new Date(timestamp).toLocaleDateString();
}

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
                <section class="settings-section" id="sync-section" hidden>
                    <h2>Sync</h2>
                    <p class="settings-hint" id="sync-hint"></p>
                    <div class="settings-actions" id="sync-actions"></div>
                </section>

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

        // Delegated, because the sync buttons are re-rendered as the state changes.
        this.querySelector('#sync-actions').addEventListener('click', (e) => {
            const action = e.target.closest('[data-sync-action]')?.dataset.syncAction;
            if (action) this.handleSyncAction(action);
        }, { signal });

        this.unsubscribeStatus = Sync.onStatusChange(() => this.renderSync());

        this.render();
    }

    disconnectedCallback() {
        this.cleanupController?.abort();
        this.cleanupController = null;
        this.unsubscribeStatus?.();
        this.unsubscribeStatus = null;
    }

    async handleSyncAction(action) {
        if (action === 'sign-in') {
            try {
                await Auth.signIn();
            } catch (e) {
                showToast(e.message, 'error');
            }
            return;
        }

        if (action === 'sign-out') {
            Auth.signOut();
            this.render();
            return;
        }

        if (action === 'sync-now') {
            try {
                const { overwritten } = await Sync.syncNow();
                showToast(overwritten
                    ? `Synced. ${overwritten} item${overwritten === 1 ? '' : 's'} updated from another device.`
                    : 'Synced');
            } catch (e) {
                showToast(e.message, 'error');
            }
            this.render();
        }
    }

    renderSync() {
        const section = this.querySelector('#sync-section');
        const hint = this.querySelector('#sync-hint');
        const actions = this.querySelector('#sync-actions');
        if (!section) return;

        // Nothing to show at all until a backend is configured, so the app
        // looks exactly as it did before sync existed.
        section.hidden = !isSyncConfigured();
        if (section.hidden) return;

        if (!Auth.isSignedIn()) {
            hint.textContent = Auth.canSignIn()
                ? 'Sign in to keep your encounters, monsters and characters in step across your devices.'
                : 'Signing in needs a secure (https) connection, so it is unavailable on this address.';
            actions.innerHTML = Auth.canSignIn()
                ? '<button type="button" class="btn btn-primary" data-sync-action="sign-in">Sign in</button>'
                : '';
            return;
        }

        const { lastSyncAt } = Sync.getState();
        const status = Sync.getStatus();
        const statusText = {
            syncing: 'Syncing…',
            error: 'Last sync failed. It will retry automatically.',
            offline: 'Offline. Changes are saved here and will sync when you reconnect.',
            idle: lastSyncAt ? `Last synced ${formatRelativeTime(lastSyncAt)}.` : 'Not synced yet.'
        }[status] ?? '';

        const pending = hasDirty() ? ' Some changes are still waiting to be sent.' : '';
        hint.textContent = `Signed in as ${Auth.getIdentity()?.email ?? 'your account'}. ${statusText}${pending}`;

        actions.innerHTML = `
            <button type="button" class="btn btn-primary" data-sync-action="sync-now"
                ${status === 'syncing' ? 'disabled' : ''}>Sync now</button>
            <button type="button" class="btn" data-sync-action="sign-out">Sign out</button>
        `;
    }

    render() {
        this.renderSync();

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
