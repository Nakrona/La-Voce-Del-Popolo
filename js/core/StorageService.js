"use strict";

/**
 * Abstraction interface for score, stage progression, and audio settings persistence (DIP & ISP).
 */
class IStorageService {
    getHighScore() { throw new Error("getHighScore() must be implemented."); }
    saveHighScore(score) { throw new Error("saveHighScore() must be implemented."); }
    getUnlockedStage(maxStages) { throw new Error("getUnlockedStage() must be implemented."); }
    unlockStage(stageNumber, maxStages) { throw new Error("unlockStage() must be implemented."); }
    getClearedStages() { throw new Error("getClearedStages() must be implemented."); }
    markStageCleared(stageNumber) { throw new Error("markStageCleared() must be implemented."); }
    resetStageProgress() { throw new Error("resetStageProgress() must be implemented."); }
    getAudioSettings() { throw new Error("getAudioSettings() must be implemented."); }
    saveAudioSettings(settings) { throw new Error("saveAudioSettings() must be implemented."); }
    getCoins() { throw new Error("getCoins() must be implemented."); }
    saveCoins(coins) { throw new Error("saveCoins() must be implemented."); }
    getOwnedUnits() { throw new Error("getOwnedUnits() must be implemented."); }
    saveOwnedUnits(units) { throw new Error("saveOwnedUnits() must be implemented."); }
    getLoadout() { throw new Error("getLoadout() must be implemented."); }
    saveLoadout(loadout) { throw new Error("saveLoadout() must be implemented."); }
}

/**
 * Concrete browser localStorage implementation with safe error handling and DRY helpers.
 */
class LocalStorageService extends IStorageService {
    constructor({
        highScoreKey = WORLD_CONFIG.HIGH_SCORE_STORAGE_KEY,
        unlockedStageKey = WORLD_CONFIG.UNLOCKED_STAGE_STORAGE_KEY,
        clearedStagesKey = WORLD_CONFIG.CLEARED_STAGES_STORAGE_KEY,
        audioSettingsKey = WORLD_CONFIG.AUDIO_SETTINGS_STORAGE_KEY,
        coinsKey = WORLD_CONFIG.COINS_STORAGE_KEY,
        ownedUnitsKey = WORLD_CONFIG.OWNED_UNITS_STORAGE_KEY,
        loadoutKey = WORLD_CONFIG.LOADOUT_STORAGE_KEY
    } = {}) {
        super();
        this._highScoreKey = highScoreKey;
        this._unlockedStageKey = unlockedStageKey;
        this._clearedStagesKey = clearedStagesKey;
        this._audioSettingsKey = audioSettingsKey;
        this._coinsKey = coinsKey;
        this._ownedUnitsKey = ownedUnitsKey;
        this._loadoutKey = loadoutKey;
    }

    _readItem(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (err) {
            return null;
        }
    }

    _writeItem(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch (err) {
            // Fail gracefully in restricted private browsing modes
        }
    }

    getHighScore() {
        const parsed = parseInt(this._readItem(this._highScoreKey), 10);
        return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
    }

    saveHighScore(score) {
        const sanitized = Math.max(0, Math.floor(score));
        const current = this.getHighScore();
        if (sanitized <= current) return current;
        this._writeItem(this._highScoreKey, String(sanitized));
        return sanitized;
    }

    getUnlockedStage(maxStages = STAGE_CONFIGS.length) {
        const parsed = parseInt(this._readItem(this._unlockedStageKey), 10);
        if (Number.isNaN(parsed) || parsed < 1) return 1;
        return Math.min(maxStages, parsed);
    }

    unlockStage(stageNumber, maxStages = STAGE_CONFIGS.length) {
        const current = this.getUnlockedStage(maxStages);
        const clamped = Math.max(1, Math.min(maxStages, Math.floor(stageNumber)));
        const next = Math.max(current, clamped);
        this._writeItem(this._unlockedStageKey, String(next));
        return next;
    }

    getClearedStages() {
        const raw = this._readItem(this._clearedStagesKey);
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            return [];
        }
    }

    markStageCleared(stageNumber) {
        const cleared = this.getClearedStages();
        if (!cleared.includes(stageNumber)) {
            cleared.push(stageNumber);
            this._writeItem(this._clearedStagesKey, JSON.stringify(cleared));
        }
        return cleared;
    }

    resetStageProgress() {
        this._writeItem(this._unlockedStageKey, "1");
        this._writeItem(this._clearedStagesKey, "[]");
    }

    getAudioSettings() {
        const defaults = { bgmVolume: 1.0, sfxVolume: 1.0, muted: false };
        const raw = this._readItem(this._audioSettingsKey);
        if (!raw) return defaults;
        try {
            const parsed = JSON.parse(raw);
            const clamp01 = (v, fb) => (typeof v === "number" && !Number.isNaN(v))
                ? Math.max(0, Math.min(1, v))
                : fb;
            return {
                bgmVolume: clamp01(parsed.bgmVolume, 1.0),
                sfxVolume: clamp01(parsed.sfxVolume, 1.0),
                muted: Boolean(parsed.muted)
            };
        } catch (err) {
            return defaults;
        }
    }

    saveAudioSettings({ bgmVolume, sfxVolume, muted }) {
        const payload = {
            bgmVolume: Math.max(0, Math.min(1, Number(bgmVolume))),
            sfxVolume: Math.max(0, Math.min(1, Number(sfxVolume))),
            muted: Boolean(muted)
        };
        this._writeItem(this._audioSettingsKey, JSON.stringify(payload));
        return payload;
    }

    getCoins() {
        const parsed = parseInt(this._readItem(this._coinsKey), 10);
        return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
    }

    saveCoins(coins) {
        const sanitized = Math.max(0, Math.floor(coins));
        this._writeItem(this._coinsKey, String(sanitized));
        return sanitized;
    }

    getOwnedUnits() {
        const raw = this._readItem(this._ownedUnitsKey);
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : null;
        } catch (err) {
            return null;
        }
    }

    saveOwnedUnits(units) {
        this._writeItem(this._ownedUnitsKey, JSON.stringify(Array.isArray(units) ? units : []));
    }

    getLoadout() {
        const raw = this._readItem(this._loadoutKey);
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === "object" ? parsed : null;
        } catch (err) {
            return null;
        }
    }

    saveLoadout(loadout) {
        this._writeItem(this._loadoutKey, JSON.stringify(loadout || {}));
    }
}
