// Client-side hash router for the D&D Tracker app
// Routes:
//   #/encounters - Encounter list
//   #/encounters/:id - Edit encounter
//   #/monsters - Custom monster list
//   #/monsters/:id - Edit custom monster
//   #/characters - Character list
//   #/characters/new - Create new character
//   #/characters/:id - View character
//   #/characters/:id/edit - Edit character
//   #/settings - Backup and restore

// Route configuration
const routes = {
    encounters: {
        list: 'encounter-list',
        item: 'encounter-edit'
    },
    monsters: {
        list: 'custom-monsters',
        item: 'custom-monster-edit'
    },
    characters: {
        list: 'characters',
        item: 'character-view',
        edit: 'character-edit'
    },
    settings: {
        list: 'settings'
    }
};

// Parse the current hash into route info
export function parseHash(hash = window.location.hash) {
    // Remove leading # and /
    const path = hash.replace(/^#\/?/, '');
    
    if (!path) {
        return { type: 'encounters', view: 'list', id: null, action: null };
    }
    
    const parts = path.split('/');
    const type = parts[0]; // encounters, monsters, or characters
    const id = parts[1] || null;
    const action = parts[2] || null; // 'edit' for characters/:id/edit
    
    // Validate route type
    if (!routes[type]) {
        return { type: 'encounters', view: 'list', id: null, action: null };
    }
    
    // Determine view based on id and action
    let view = 'list';
    if (id === 'new') {
        view = 'new';
    } else if (id) {
        view = action === 'edit' ? 'edit' : 'item';
    }
    
    return {
        type,
        view,
        id: id === 'new' ? null : id,
        action
    };
}

// Generate a hash URL for a given route
export function generateHash(type, id = null, action = null) {
    if (id && action) {
        return `#/${type}/${id}/${action}`;
    }
    if (id) {
        return `#/${type}/${id}`;
    }
    return `#/${type}`;
}

// Navigate to a route (updates URL hash)
export function navigate(type, id = null, options = {}) {
    const { replace = false, action = null } = options;
    const hash = generateHash(type, id, action);
    const oldHash = window.location.hash;

    if (replace) {
        window.history.replaceState(null, '', hash);
        // If replacing with the same hash, ensure route handler runs
        if (oldHash === hash) {
            window.dispatchEvent(new Event('hashchange'));
        }
    } else {
        // Setting the same hash doesn't trigger a hashchange event in browsers.
        // Detect this case and fire the event manually so route handlers always run.
        if (oldHash === hash) {
            window.location.hash = hash;
            window.dispatchEvent(new Event('hashchange'));
        } else {
            window.location.hash = hash;
        }
    }
}

// Get the view name for the current route
export function getViewForRoute(routeInfo) {
    const config = routes[routeInfo.type];
    if (!config) return 'encounter-list';
    
    if (routeInfo.view === 'edit' && config.edit) {
        return config.edit;
    }
    return routeInfo.view === 'item' ? config.item : config.list;
}

// Navigate to list view for a type
export function navigateToList(type, replace = false) {
    navigate(type, null, { replace });
}

// Navigate to item view
export function navigateToItem(type, id, action = null) {
    navigate(type, id, { action });
}

// Navigate to create new item
export function navigateToNew(type) {
    navigate(type, 'new');
}

// Navigate back (to parent list)
export function navigateBack(currentType) {
    navigateToList(currentType);
}

// Get route type from view name (reverse lookup)
export function getRouteTypeFromView(viewName) {
    for (const [type, config] of Object.entries(routes)) {
        if (config.list === viewName || config.item === viewName || config.edit === viewName) {
            return type;
        }
    }
    return 'encounters';
}

// Check if current route is an item view (or edit view)
export function isItemRoute(routeInfo) {
    return (routeInfo.view === 'item' || routeInfo.view === 'edit') && routeInfo.id;
}

export default {
    parseHash,
    generateHash,
    navigate,
    getViewForRoute,
    navigateToList,
    navigateToItem,
    navigateToNew,
    navigateBack,
    getRouteTypeFromView,
    isItemRoute
};
