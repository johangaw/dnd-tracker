// Folders Service - flat, tag-like folders for organizing monsters and encounters.
// Each entity type (monsters, encounters) gets its own independent set of folders,
// stored under its own localStorage key. An item can belong to any number of folders
// via a `folderIds` array on the item itself.

import { readCollection, writeCollection, MONSTER_FOLDERS_KEY, ENCOUNTER_FOLDERS_KEY } from './records.js';
import { uuid as generateFolderId } from '../utils/uuid.js';

function createFolderStore(storageKey) {
    function getFolders() {
        return readCollection(storageKey);
    }

    function saveFolders(folders) {
        writeCollection(storageKey, folders);
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

export const MonsterFolders = createFolderStore(MONSTER_FOLDERS_KEY);
export const EncounterFolders = createFolderStore(ENCOUNTER_FOLDERS_KEY);

export default { MonsterFolders, EncounterFolders };
