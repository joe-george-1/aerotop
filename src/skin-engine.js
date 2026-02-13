/**
 * Skin Engine — manages registration, loading, and hot-swapping of skins.
 *
 * Each skin module must export an object with:
 *   init(container: HTMLElement)     — mount the skin into the given container
 *   update(snapshot: SystemSnapshot) — receive a new data frame
 *   destroy()                        — clean up DOM, timers, etc.
 *   getMetadata()                    — { id, name, author, description, thumbnail? }
 */

class SkinEngine {
    constructor(container) {
        this._container = container;
        this._skins = new Map(); // id → skin module
        this._activeSkin = null;
        this._activeSkinId = null;
    }

    /**
     * Register a skin module.
     */
    register(skinModule) {
        const meta = skinModule.getMetadata();
        if (!meta || !meta.id) {
            throw new Error('Skin must provide getMetadata() with an id');
        }
        this._skins.set(meta.id, skinModule);
    }

    /**
     * Get all registered skins' metadata.
     */
    listSkins() {
        return Array.from(this._skins.values()).map(s => s.getMetadata());
    }

    /**
     * Activate a skin by ID. Destroys the current skin first.
     */
    activate(skinId) {
        const skin = this._skins.get(skinId);
        if (!skin) {
            throw new Error(`Skin not found: ${skinId}`);
        }

        // Destroy current skin
        if (this._activeSkin) {
            this._activeSkin.destroy();
            this._container.innerHTML = '';
            // Remove any skin-specific stylesheets
            document.querySelectorAll('link[data-skin]').forEach(el => el.remove());
            document.querySelectorAll('style[data-skin]').forEach(el => el.remove());
        }

        // Set skin class on body for skin-specific global styles
        document.body.className = '';
        document.body.classList.add(`skin-${skinId}`);

        // Initialize new skin
        skin.init(this._container);
        this._activeSkin = skin;
        this._activeSkinId = skinId;

        // Save preference
        try {
            localStorage.setItem('aerotop-active-skin', skinId);
        } catch (_) { }
    }

    /**
     * Send a data update to the active skin.
     */
    update(snapshot) {
        if (this._activeSkin) {
            this._activeSkin.update(snapshot);
        }
    }

    /**
     * Get the preferred skin ID from localStorage, or return defaultId.
     */
    getPreferredSkin(defaultId) {
        try {
            return localStorage.getItem('aerotop-active-skin') || defaultId;
        } catch (_) {
            return defaultId;
        }
    }

    getActiveSkinId() {
        return this._activeSkinId;
    }
}

export default SkinEngine;
