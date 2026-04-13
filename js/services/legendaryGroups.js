// Legendary Groups Service - Handles loading lair actions and regional effects

const DATA_URL = 'data/bestiary/legendarygroups.json';

let legendaryGroupsData = null;
let legendaryGroupsIndex = null;

/**
 * Load the legendary groups data
 * @returns {Promise<Object>} The legendary groups data
 */
export async function loadLegendaryGroups() {
    if (legendaryGroupsData) return legendaryGroupsData;
    
    try {
        const response = await fetch(DATA_URL);
        legendaryGroupsData = await response.json();
        
        // Build index for quick lookup by name|source
        legendaryGroupsIndex = {};
        for (const group of legendaryGroupsData.legendaryGroup || []) {
            const key = `${group.name}|${group.source}`;
            legendaryGroupsIndex[key] = group;
        }
        
        return legendaryGroupsData;
    } catch (error) {
        console.error('Failed to load legendary groups:', error);
        return null;
    }
}

/**
 * Get legendary group data for a monster
 * @param {Object} monster - The monster object with legendaryGroup property
 * @returns {Promise<Object|null>} The legendary group data or null
 */
export async function getLegendaryGroup(monster) {
    if (!monster?.legendaryGroup) return null;
    
    await loadLegendaryGroups();
    if (!legendaryGroupsIndex) return null;
    
    const { name, source } = monster.legendaryGroup;
    const key = `${name}|${source}`;
    
    return legendaryGroupsIndex[key] || null;
}

/**
 * Format legendary group entries (lair actions, regional effects)
 * Entries can be strings, lists, or other complex objects
 * @param {Array} entries - The entries array
 * @param {Function} formatEntries - The formatEntries function from helpers
 * @returns {string} HTML string
 */
export function formatLegendaryEntries(entries, formatEntries) {
    if (!entries || !Array.isArray(entries)) return '';
    
    let html = '';
    
    for (const entry of entries) {
        if (typeof entry === 'string') {
            // Simple text entry
            html += `<p class="lair-text">${formatEntries([entry])}</p>`;
        } else if (entry.type === 'list') {
            // List of items
            html += '<ul class="lair-list">';
            for (const item of entry.items || []) {
                if (typeof item === 'string') {
                    html += `<li>${formatEntries([item])}</li>`;
                } else if (item.type === 'item') {
                    // Named item with entries
                    const name = item.name ? `<strong>${item.name}.</strong> ` : '';
                    const text = item.entry 
                        ? formatEntries([item.entry])
                        : formatEntries(item.entries || []);
                    html += `<li>${name}${text}</li>`;
                }
            }
            html += '</ul>';
        } else if (entry.type === 'entries') {
            // Named section
            if (entry.name) {
                html += `<p class="lair-subheader"><strong>${entry.name}.</strong></p>`;
            }
            html += formatLegendaryEntries(entry.entries, formatEntries);
        }
    }
    
    return html;
}

export default {
    loadLegendaryGroups,
    getLegendaryGroup,
    formatLegendaryEntries,
    // For testing - reset cached data
    resetCache: () => {
        legendaryGroupsData = null;
        legendaryGroupsIndex = null;
    }
};
