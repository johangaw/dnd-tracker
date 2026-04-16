// Class Features Service
// Loads and searches class features and subclass features from 5etools data

const CLASS_FILES = [
    'class-artificer.json',
    'class-barbarian.json',
    'class-bard.json',
    'class-cleric.json',
    'class-druid.json',
    'class-fighter.json',
    'class-monk.json',
    'class-paladin.json',
    'class-ranger.json',
    'class-rogue.json',
    'class-sorcerer.json',
    'class-warlock.json',
    'class-wizard.json'
];

// Cache for loaded features
let featuresCache = null;
let loadingPromise = null;

/**
 * Load all class features from JSON files
 * @returns {Promise<Array>} Array of normalized feature objects
 */
export async function loadFeatures() {
    if (featuresCache) {
        return featuresCache;
    }
    
    if (loadingPromise) {
        return loadingPromise;
    }
    
    loadingPromise = (async () => {
        const features = [];
        
        for (const file of CLASS_FILES) {
            try {
                const response = await fetch(`data/classes/${file}`);
                if (!response.ok) continue;
                
                const data = await response.json();
                
                // Process class features
                if (data.classFeature && Array.isArray(data.classFeature)) {
                    for (const feature of data.classFeature) {
                        // Skip variant/optional features and features without proper entries
                        if (feature.isClassFeatureVariant) continue;
                        if (!feature.entries || feature.entries.length === 0) continue;
                        
                        features.push(normalizeFeature(feature, 'class'));
                    }
                }
                
                // Process subclass features
                if (data.subclassFeature && Array.isArray(data.subclassFeature)) {
                    for (const feature of data.subclassFeature) {
                        if (!feature.entries || feature.entries.length === 0) continue;
                        
                        features.push(normalizeFeature(feature, 'subclass'));
                    }
                }
            } catch (error) {
                console.warn(`Failed to load class file: ${file}`, error);
            }
        }
        
        featuresCache = features;
        return features;
    })();
    
    return loadingPromise;
}

/**
 * Normalize a feature object to a consistent format
 */
function normalizeFeature(feature, type) {
    return {
        name: feature.name,
        className: feature.className,
        classSource: feature.classSource,
        subclassShortName: feature.subclassShortName || null,
        subclassSource: feature.subclassSource || null,
        level: feature.level,
        source: feature.source,
        type: type,
        entries: feature.entries,
        // Create a searchable description from entries
        description: formatEntriesToText(feature.entries)
    };
}

/**
 * Convert 5etools entries to plain text for display/search
 */
function formatEntriesToText(entries) {
    if (!entries) return '';
    
    return entries.map(entry => {
        if (typeof entry === 'string') {
            return cleanText(entry);
        }
        if (typeof entry === 'object') {
            if (entry.type === 'list' && entry.items) {
                return entry.items.map(item => {
                    if (typeof item === 'string') return '• ' + cleanText(item);
                    if (item.type === 'item' && item.name && item.entry) {
                        return '• ' + item.name + ': ' + cleanText(item.entry);
                    }
                    if (item.entries) {
                        return '• ' + formatEntriesToText(item.entries);
                    }
                    return '';
                }).join('\n');
            }
            if (entry.type === 'entries' && entry.entries) {
                const header = entry.name ? entry.name + '. ' : '';
                return header + formatEntriesToText(entry.entries);
            }
            if (entry.entries) {
                return formatEntriesToText(entry.entries);
            }
        }
        return '';
    }).join('\n\n');
}

/**
 * Clean up 5etools formatting tags
 */
function cleanText(text) {
    if (!text) return '';
    
    return text
        // Dice and damage
        .replace(/{@damage ([^|}]+)(\|[^}]*)?}/g, '$1')
        .replace(/{@dice ([^|}]+)(\|[^}]*)?}/g, '$1')
        .replace(/{@scaledamage ([^|]+)\|[^|]+\|([^}]+)}/g, '$2')
        .replace(/{@scaledice ([^|]+)\|[^|]+\|([^}]+)}/g, '$2')
        
        // DC and hit
        .replace(/{@dc (\d+)}/g, 'DC $1')
        .replace(/{@hit (\d+)}/g, '+$1')
        .replace(/{@h}/g, 'Hit: ')
        
        // Conditions, spells, creatures, items
        .replace(/{@condition ([^|}]+)(\|[^}]*)?}/g, '$1')
        .replace(/{@spell ([^|}]+)(\|[^}]*)?}/g, '$1')
        .replace(/{@creature ([^|}]+)(\|[^}]*)?}/g, '$1')
        .replace(/{@item ([^|}]+)(\|[^}]*)?}/g, '$1')
        
        // Skills, senses, actions
        .replace(/{@skill ([^|}]+)(\|[^}]*)?}/g, '$1')
        .replace(/{@sense ([^|}]+)(\|[^}]*)?}/g, '$1')
        .replace(/{@action ([^|}]+)(\|[^}]*)?}/g, '$1')
        .replace(/{@status ([^|}]+)(\|[^}]*)?}/g, '$1')
        
        // Bold and italic
        .replace(/{@b ([^}]+)}/g, '$1')
        .replace(/{@bold ([^}]+)}/g, '$1')
        .replace(/{@i ([^}]+)}/g, '$1')
        .replace(/{@italic ([^}]+)}/g, '$1')
        
        // Class features, variant rules
        .replace(/{@classFeature ([^|}]+)(\|[^}]*)?}/g, '$1')
        .replace(/{@variantrule ([^|}]+)(\|[^}]*)?}/g, '$1')
        
        // Clean up any remaining tags
        .replace(/{@[^}]+}/g, '');
}

/**
 * Search features by query
 * @param {string} query - Search query
 * @param {Object} filters - Optional filters { className, level }
 * @returns {Promise<Array>} Matching features
 */
export async function searchFeatures(query, filters = {}) {
    const features = await loadFeatures();
    
    let results = features;
    
    // Filter by class name
    if (filters.className) {
        results = results.filter(f => 
            f.className.toLowerCase() === filters.className.toLowerCase()
        );
    }
    
    // Filter by subclass
    if (filters.subclassName) {
        results = results.filter(f => 
            f.subclassShortName && 
            f.subclassShortName.toLowerCase() === filters.subclassName.toLowerCase()
        );
    }
    
    // Filter by level
    if (filters.level !== undefined && filters.level !== '') {
        const level = parseInt(filters.level);
        results = results.filter(f => f.level === level);
    }
    
    // Filter by feature type (class/subclass)
    if (filters.type) {
        results = results.filter(f => f.type === filters.type);
    }
    
    // Search by query (name, class, subclass, or source)
    if (query && query.trim()) {
        const lowerQuery = query.toLowerCase().trim();
        results = results.filter(f => 
            f.name.toLowerCase().includes(lowerQuery) ||
            f.className.toLowerCase().includes(lowerQuery) ||
            (f.subclassShortName && f.subclassShortName.toLowerCase().includes(lowerQuery)) ||
            (f.source && f.source.toLowerCase().includes(lowerQuery))
        );
    }
    
    // Sort by class name, then level, then feature name
    results.sort((a, b) => {
        if (a.className !== b.className) {
            return a.className.localeCompare(b.className);
        }
        if (a.level !== b.level) {
            return a.level - b.level;
        }
        return a.name.localeCompare(b.name);
    });
    
    return results;
}

/**
 * Get unique class names from loaded features
 */
export async function getClassNames() {
    const features = await loadFeatures();
    const classNames = new Set();
    
    for (const f of features) {
        classNames.add(f.className);
    }
    
    return Array.from(classNames).sort();
}

/**
 * Get unique subclass names for a given class
 */
export async function getSubclassNames(className) {
    const features = await loadFeatures();
    const subclassNames = new Set();
    
    for (const f of features) {
        if (f.className.toLowerCase() === className.toLowerCase() && f.subclassShortName) {
            subclassNames.add(f.subclassShortName);
        }
    }
    
    return Array.from(subclassNames).sort();
}

export default {
    loadFeatures,
    searchFeatures,
    getClassNames,
    getSubclassNames
};
