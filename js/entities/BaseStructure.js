"use strict";

/**
 * Static base structure entity (Panggung Utama on left, Markas Polisi on right).
 * Substitutable anywhere an Entity/IDamageable target is expected (LSP).
 */
class BaseStructure extends Entity {
    constructor(x, maxHp, faction, label) {
        super(x, 120, 150, maxHp, faction);
        this.label = label;
    }

    getHpRatio() {
        return this.maxHp > 0 ? this.hp / this.maxHp : 0;
    }
}
