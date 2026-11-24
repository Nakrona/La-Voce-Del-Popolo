"use strict";

/**
 * Lightweight projectile entity for ranged units (Mahasiswa pebbles, Tear Gas canisters, Water Cannon blasts).
 */
class Projectile {
    constructor({ x, y, direction, speed, damage, targetFaction, color, radius, aoeRadius, aoeImpactKind, baseDamageMultiplier, slowFactor, slowDuration, knockbackDistance, assetId }) {
        this.x = x;
        this.y = y;
        this.direction = direction;
        this.speed = speed;
        this.damage = damage;
        this.targetFaction = targetFaction;
        this.color = color;
        this.radius = radius || 5;
        this.aoeRadius = aoeRadius || 0;
        this.aoeImpactKind = aoeImpactKind || "";
        this.baseDamageMultiplier = baseDamageMultiplier || 1.0;
        this.slowFactor = slowFactor || 1.0;
        this.slowDuration = slowDuration || 0;
        this.knockbackDistance = knockbackDistance || 0;
        this.assetId = assetId || null;
        this.active = true;
        this.traveled = 0;
        this.maxDistance = 380;
    }

    getAssetId() {
        return this.assetId;
    }

    update(dtEff) {
        if (!this.active) return;
        const step = this.speed * dtEff;
        this.x += this.direction * step;
        this.traveled += step;
        if (this.traveled >= this.maxDistance) {
            this.active = false;
        }
    }
}
