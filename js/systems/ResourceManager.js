"use strict";

/**
 * Manages passive Poin Moral regeneration, spending validation, and unit spawn cooldowns.
 * Follows Single Responsibility Principle (SRP).
 */
class ResourceManager {
    constructor(unitConfigs, maxMoral = WORLD_CONFIG.MAX_MORAL) {
        this._unitConfigs = unitConfigs;
        this._maxMoral = maxMoral;
        this.moral = 0;
        this.regenRate = 5.0;
        this._cooldowns = new Map();
    }

    resetForStage(initialMoral, regenRate) {
        this.moral = initialMoral;
        this.regenRate = regenRate;
        this._cooldowns.clear();
        for (const key of Object.keys(this._unitConfigs)) {
            if (this._unitConfigs[key].faction === FACTIONS.PLAYER) {
                this._cooldowns.set(key, 0);
            }
        }
    }

    update(dtEff) {
        this.moral = Math.min(this._maxMoral, this.moral + this.regenRate * dtEff);
        for (const [key, cd] of this._cooldowns.entries()) {
            if (cd > 0) {
                this._cooldowns.set(key, Math.max(0, cd - dtEff));
            }
        }
    }

    canAfford(unitKey) {
        const cfg = this._unitConfigs[unitKey];
        if (!cfg) return false;
        const cd = this._cooldowns.get(unitKey) || 0;
        return this.moral >= cfg.cost && cd <= 0;
    }

    spendForUnit(unitKey) {
        if (!this.canAfford(unitKey)) return false;
        const cfg = this._unitConfigs[unitKey];
        this.moral -= cfg.cost;
        this._cooldowns.set(unitKey, cfg.cooldown);
        return true;
    }

    getCooldownProgress(unitKey) {
        const cfg = this._unitConfigs[unitKey];
        if (!cfg || !cfg.cooldown) return 0;
        const cd = this._cooldowns.get(unitKey) || 0;
        return Math.min(1, cd / cfg.cooldown);
    }
}
