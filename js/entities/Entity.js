"use strict";

/**
 * Abstract base entity representing any damageable object on the 1D horizontal battlefield.
 * Enforces encapsulation and a shared IDamageable contract for CombatSystem.
 */
class Entity {
    constructor(x, width, height, maxHp, faction) {
        if (new.target === Entity) {
            throw new Error("Entity is an abstract base class and cannot be instantiated directly.");
        }
        this.x = x;
        this.width = width;
        this.height = height;
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.faction = faction;
        this.hitFlashTimer = 0;
    }

    isAlive() {
        return this.hp > 0;
    }

    getLeftEdge() {
        return this.x - this.width * 0.5;
    }

    getRightEdge() {
        return this.x + this.width * 0.5;
    }

    takeDamage(amount) {
        if (!this.isAlive()) return;
        this.hp = Math.max(0, this.hp - amount);
        this.hitFlashTimer = 0.12;
    }

    updateTimers(dtEff) {
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dtEff);
        }
    }
}
