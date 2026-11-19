"use strict";

/**
 * Factory pattern for instantiating concrete Unit subclasses from config definitions.
 * Supports Open/Closed Principle (OCP) via behavior registry mapping.
 */
class UnitFactory {
    constructor(unitConfigs) {
        this._configs = unitConfigs;
        this._builders = {
            MELEE: (cfg, x) => new MeleeUnit(cfg, x),
            RANGED: (cfg, x) => new RangedProjectileUnit(cfg, x),
            WATER_CANNON: (cfg, x) => new WaterCannonUnit(cfg, x),
            BOSS: (cfg, x) => new BossBarracudaUnit(cfg, x),
            ORATOR: (cfg, x) => new OratorUnit(cfg, x)
        };
    }

    createUnit(unitKey, spawnX) {
        const cfg = this._configs[unitKey];
        if (!cfg) {
            throw new Error(`Unknown unit configuration key: ${unitKey}`);
        }
        const builder = this._builders[cfg.behavior];
        if (!builder) {
            throw new Error(`No unit builder registered for behavior: ${cfg.behavior}`);
        }
        return builder(cfg, spawnX);
    }
}
