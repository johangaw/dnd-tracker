// Folders Service - flat, tag-like folders for organizing monsters and encounters.
// Each entity type (monsters, encounters) gets its own independent set of folders,
// stored under its own localStorage key. An item can belong to any number of folders
// via a `folderIds` array on the item itself.

// Date.now() alone can collide when folders are created back-to-back in the
// same millisecond (e.g. two quick clicks), so pad it with a random suffix.
function generateFolderId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createFolderStore(storageKey) {
    function getFolders() {
        const data = localStorage.getItem(storageKey);
        return data ? JSON.parse(data) : [];
    }

    function saveFolders(folders) {
        localStorage.setItem(storageKey, JSON.stringify(folders));
    }

    function getFolder(id) {
        return getFolders().find(f => f.id === id);
    }

    function createFolder(name) {
        const trimmed = name.trim();
        if (!trimmed) return null;

        const folder = { id: generateFolderId(), name: trimmed };
        const folders = getFolders();
        folders.push(folder);
        saveFolders(folders);
        return folder;
    }

    function renameFolder(id, name) {
        const trimmed = name.trim();
        if (!trimmed) return;

        const folders = getFolders();
        const folder = folders.find(f => f.id === id);
        if (folder) {
            folder.name = trimmed;
            saveFolders(folders);
        }
    }

    // Deletes the folder and strips it from every item's folderIds, using the
    // supplied getItems/saveItems pair for the entity type that owns this store.
    function deleteFolder(id, { getItems, saveItems }) {
        saveFolders(getFolders().filter(f => f.id !== id));

        if (getItems && saveItems) {
            const items = getItems();
            let changed = false;
            items.forEach(item => {
                if (item.folderIds && item.folderIds.includes(id)) {
                    item.folderIds = item.folderIds.filter(fid => fid !== id);
                    changed = true;
                }
            });
            if (changed) saveItems(items);
        }
    }

    return { getFolders, saveFolders, getFolder, createFolder, renameFolder, deleteFolder };
}

export const MonsterFolders = createFolderStore('dnd-monster-folders');
export const EncounterFolders = createFolderStore('dnd-encounter-folders');

export default { MonsterFolders, EncounterFolders };
