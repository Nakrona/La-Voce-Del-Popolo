"use strict";

/**
 * Abstract base entity representing any damageable, inspectable object on the battlefield.
 * Enforces encapsulation and shared IDamageable / IInspectable contracts (LSP & ISP).
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

    containsPoint(worldX, worldY, pad = 6) {
        if (!this.isAlive()) return false;
        const left = this.getLeftEdge() - pad;
        const right = this.getRightEdge() + pad;
        const top = WORLD_CONFIG.GROUND_Y - this.height - pad;
        const bottom = WORLD_CONFIG.GROUND_Y + pad;
        return worldX >= left && worldX <= right && worldY >= top && worldY <= bottom;
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

    toTooltipData() {
        throw new Error("Subclasses must implement toTooltipData().");
    }
}
