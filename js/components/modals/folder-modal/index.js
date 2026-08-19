// Folder Modal - light-DOM WebComponent
// Reusable for both monsters and encounters. Two modes, chosen by whether
// `item` is passed to open():
//   - Manage mode (no item): list/create/rename/delete folders.
//   - Assign mode (item passed): same, plus checkboxes to file this one
//     item into any number of folders.
import { escapeHtml } from '../../../utils/helpers.js';

class FolderModalElement extends HTMLElement {
    cleanupController = null;
    config = null;

    connectedCallback() {
        this.cleanupController = new AbortController();

        this.innerHTML = `
            <div class="modal-content modal-small">
                <div class="modal-header">
                    <h2 id="folder-modal-title">Folders</h2>
                    <button type="button" id="folder-modal-close" class="close-modal" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="folder-modal-list" class="folder-modal-list"></div>
                    <div class="folder-modal-add">
                        <input type="text" id="folder-modal-new-name" placeholder="New folder name">
                        <button type="button" id="folder-modal-add-btn" class="btn btn-small">Add</button>
                    </div>
                    <div class="form-actions" style="margin-top: 16px;">
                        <button type="button" id="folder-modal-done-btn" class="btn btn-primary">Done</button>
                    </div>
                </div>
            </div>
        `;

        const signal = this.cleanupController.signal;

        this.querySelector('#folder-modal-close').addEventListener('click', () => this.closeAndNotify(), { signal });
        this.querySelector('#folder-modal-done-btn').addEventListener('click', () => this.closeAndNotify(), { signal });
        this.addEventListener('click', (e) => {
            if (e.target === this) this.closeAndNotify();
        }, { signal });

        this.querySelector('#folder-modal-add-btn').addEventListener('click', () => this.handleAdd(), { signal });
        this.querySelector('#folder-modal-new-name').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleAdd();
            }
        }, { signal });
    }

    disconnectedCallback() {
        this.cleanupController.abort();
    }

    // config: { folderStore, getItems, saveItems, item?, onChange?, onFoldersChanged? }
    // - folderStore: a store from services/folders.js (MonsterFolders/EncounterFolders)
    // - getItems/saveItems: the entity's storage read/write (needed to prune deleted folders)
    // - item: optional; when present, enables checkbox assignment for this item
    // - onChange(folderIds): called whenever the item's folder membership changes
    // - onFoldersChanged(): called whenever the folder set itself changes (add/rename/delete)
    //   or the modal is closed, so the caller can refresh its own view
    open(config) {
        this.config = config;
        this.querySelector('#folder-modal-title').textContent = config.item ? 'Folders' : 'Manage Folders';
        this.querySelector('#folder-modal-new-name').value = '';
        this.renderList();
        this.classList.add('active');
    }

    closeAndNotify() {
        this.classList.remove('active');
        this.config?.onFoldersChanged?.();
    }

    renderList() {
        const { folderStore, item } = this.config;
        const listEl = this.querySelector('#folder-modal-list');
        const folders = folderStore.getFolders();

        if (folders.length === 0) {
            listEl.innerHTML = `<p class="folder-modal-empty">No folders yet. Add one below.</p>`;
            return;
        }

        listEl.innerHTML = folders.map(folder => `
            <div class="folder-modal-row" data-id="${folder.id}">
                ${item ? `
                    <label class="folder-modal-checkbox">
                        <input type="checkbox" data-folder-checkbox="${folder.id}" ${item.folderIds?.includes(folder.id) ? 'checked' : ''}>
                        <span>${escapeHtml(folder.name)}</span>
                    </label>
                ` : `<span class="folder-modal-name">${escapeHtml(folder.name)}</span>`}
                <div class="folder-modal-row-actions">
                    <button type="button" class="icon-btn" data-rename="${folder.id}" aria-label="Rename folder">✎</button>
                    <button type="button" class="icon-btn danger" data-delete="${folder.id}" aria-label="Delete folder">🗑</button>
                </div>
            </div>
        `).join('');

        const signal = this.cleanupController.signal;

        if (item) {
            listEl.querySelectorAll('[data-folder-checkbox]').forEach(cb => {
                cb.addEventListener('change', () => {
                    const id = cb.dataset.folderCheckbox;
                    const set = new Set(item.folderIds || []);
                    if (cb.checked) set.add(id); else set.delete(id);
                    item.folderIds = Array.from(set);
                    this.config.onChange?.(item.folderIds);
                }, { signal });
            });
        }

        listEl.querySelectorAll('[data-rename]').forEach(btn => {
            btn.addEventListener('click', () => {
                const folder = folderStore.getFolder(btn.dataset.rename);
                const name = prompt('Rename folder:', folder?.name || '');
                if (name && name.trim()) {
                    folderStore.renameFolder(btn.dataset.rename, name);
                    this.renderList();
                    this.config.onFoldersChanged?.();
                }
            }, { signal });
        });

        listEl.querySelectorAll('[data-delete]').forEach(btn => {
            btn.addEventListener('click', () => {
                const folder = folderStore.getFolder(btn.dataset.delete);
                if (!confirm(`Delete folder "${folder?.name}"? Items in it will become unfiled.`)) return;

                folderStore.deleteFolder(btn.dataset.delete, {
                    getItems: this.config.getItems,
                    saveItems: this.config.saveItems
                });

                if (item?.folderIds) {
                    item.folderIds = item.folderIds.filter(id => id !== btn.dataset.delete);
                }

                this.renderList();
                this.config.onFoldersChanged?.();
            }, { signal });
        });
    }

    handleAdd() {
        const input = this.querySelector('#folder-modal-new-name');
        const name = input.value;
        if (!name.trim()) return;

        const folder = this.config.folderStore.createFolder(name);
        input.value = '';

        if (folder && this.config.item) {
            const set = new Set(this.config.item.folderIds || []);
            set.add(folder.id);
            this.config.item.folderIds = Array.from(set);
            this.config.onChange?.(this.config.item.folderIds);
        }

        this.renderList();
        this.config.onFoldersChanged?.();
    }
}

if (!customElements.get('folder-modal')) {
    customElements.define('folder-modal', FolderModalElement);
}
