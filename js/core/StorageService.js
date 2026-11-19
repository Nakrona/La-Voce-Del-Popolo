"use strict";

/**
 * Abstraction interface for score persistence (DIP & ISP).
 */
class IStorageService {
    getHighScore() {
        throw new Error("Method getHighScore() must be implemented.");
    }

    saveHighScore(score) {
        throw new Error("Method saveHighScore() must be implemented.");
    }
}

/**
 * Concrete browser localStorage implementation with safe error handling.
 */
class LocalStorageService extends IStorageService {
    constructor(storageKey = WORLD_CONFIG.HIGH_SCORE_STORAGE_KEY) {
        super();
        this._storageKey = storageKey;
    }

    getHighScore() {
        try {
            const raw = window.localStorage.getItem(this._storageKey);
            const parsed = parseInt(raw, 10);
            return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
        } catch (err) {
            return 0;
        }
    }

    saveHighScore(score) {
        const sanitized = Math.max(0, Math.floor(score));
        const current = this.getHighScore();
        if (sanitized <= current) {
            return current;
        }
        try {
            window.localStorage.setItem(this._storageKey, String(sanitized));
        } catch (err) {
            // Fail gracefully in restricted private browsing modes
        }
        return sanitized;
    }
}
