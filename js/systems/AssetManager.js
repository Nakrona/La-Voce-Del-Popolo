"use strict";

/**
 * Abstraction interface for loading and querying replaceable image assets (DIP & ISP).
 */
class IAssetService {
    isReady(assetId) { throw new Error("isReady() must be implemented."); }
    isGif(assetId) { throw new Error("isGif() must be implemented."); }
    getImage(assetId) { throw new Error("getImage() must be implemented."); }
    getSourceUrl(assetId) { throw new Error("getSourceUrl() must be implemented."); }
    subscribeOnUpdate(callback) { throw new Error("subscribeOnUpdate() must be implemented."); }
}

/**
 * Loads image assets from `assets/images/` with automatic extension probing (.png, .gif, .webp, .jpg, .svg)
 * so users can swap formats (e.g., replace a .png with an animated .gif) without editing code (SRP & OCP).
 */
class HtmlAssetService extends IAssetService {
    constructor(baseFolder, manifest, fallbackExtensions = SUPPORTED_IMAGE_EXTENSIONS) {
        super();
        this._baseFolder = baseFolder;
        this._manifest = manifest;
        this._extensions = fallbackExtensions;
        this._entries = new Map();
        this._subscribers = [];

        this._preloadAll();
    }

    _preloadAll() {
        for (const id of Object.keys(this._manifest)) {
            const cfg = this._manifest[id];
            const entry = {
                id,
                defaultFile: cfg.file,
                image: null,
                url: `${this._baseFolder}${cfg.file}`,
                ready: false,
                isGif: false
            };
            this._entries.set(id, entry);
            this._loadWithProbe(entry, this._buildCandidateUrls(cfg.file), 0);
        }
    }

    _buildCandidateUrls(defaultFile) {
        const dotIdx = defaultFile.lastIndexOf(".");
        const stem = dotIdx >= 0 ? defaultFile.slice(0, dotIdx) : defaultFile;
        const defaultExt = dotIdx >= 0 ? defaultFile.slice(dotIdx).toLowerCase() : "";

        const candidates = [`${this._baseFolder}${defaultFile}`];
        for (let i = 0; i < this._extensions.length; i++) {
            const ext = this._extensions[i].toLowerCase();
            if (ext !== defaultExt) {
                candidates.push(`${this._baseFolder}${stem}${ext}`);
            }
        }
        return candidates;
    }

    _loadWithProbe(entry, candidates, index) {
        if (index >= candidates.length) {
            entry.ready = false;
            return;
        }

        const url = candidates[index];
        const img = new Image();
        img.onload = () => {
            if (img.naturalWidth > 0) {
                entry.image = img;
                entry.url = url;
                entry.ready = true;
                entry.isGif = /\.gif(\?.*)?$/i.test(url);
                this._notifySubscribers(entry.id);
            } else {
                this._loadWithProbe(entry, candidates, index + 1);
            }
        };
        img.onerror = () => {
            this._loadWithProbe(entry, candidates, index + 1);
        };
        img.src = url;
    }

    _notifySubscribers(assetId) {
        for (let i = 0; i < this._subscribers.length; i++) {
            this._subscribers[i](assetId, this._entries.get(assetId));
        }
    }

    subscribeOnUpdate(callback) {
        this._subscribers.push(callback);
    }

    isReady(assetId) {
        const entry = this._entries.get(assetId);
        return Boolean(entry && entry.ready && entry.image);
    }

    isGif(assetId) {
        const entry = this._entries.get(assetId);
        return Boolean(entry && entry.ready && entry.isGif);
    }

    getImage(assetId) {
        const entry = this._entries.get(assetId);
        return entry && entry.ready ? entry.image : null;
    }

    getSourceUrl(assetId) {
        const entry = this._entries.get(assetId);
        return entry ? entry.url : null;
    }
}
