"use strict";

/**
 * Sky-falling AoE projectile entity used by aerial active skills (e.g., Hujan Petasan & Botol).
 * Follows Single Responsibility Principle (SRP): tracks trajectory, rotation, and ground impact trigger.
 */
class FallingBomb {
    constructor({
        targetX,
        startY = -28,
        groundY = WORLD_CONFIG.GROUND_Y - 10,
        fallSpeed,
        driftX,
        damage,
        aoeRadius,
        variantType,
        color,
        accentColor,
        slowFactor = 1.0,
        slowDuration = 0
    }) {
        this.targetX = targetX;
        this.groundY = groundY;
        this.fallSpeed = fallSpeed;
        this.damage = damage;
        this.aoeRadius = aoeRadius;
        this.variantType = variantType;
        this.color = color;
        this.accentColor = accentColor;
        this.slowFactor = slowFactor;
        this.slowDuration = slowDuration;

        // Calculate diagonal velocity so bomb lands accurately at targetX upon reaching groundY
        const travelTime = Math.max(0.1, (groundY - startY) / fallSpeed);
        this.x = targetX - driftX;
        this.y = startY;
        this.vx = driftX / travelTime;
        this.vy = fallSpeed;
        this.rotation = 0;
        this.spinSpeed = variantType === "BOTOL" ? 11 : 6;
        this.active = true;
    }

    getAssetId() {
        return BOMB_VARIANT_TO_ASSET_ID[this.variantType] || null;
    }

    update(dtEff) {
        if (!this.active) return false;

        this.x += this.vx * dtEff;
        this.y += this.vy * dtEff;
        this.rotation += this.spinSpeed * dtEff;

        if (this.y >= this.groundY) {
            this.y = this.groundY;
            this.active = false;
            return true; // Signifies ground impact on this frame
        }
        return false;
    }
}
