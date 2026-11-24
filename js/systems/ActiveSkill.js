"use strict";

/**
 * Abstract base class for player Active Special Skills (OCP & LSP).
 * Subclasses implement _onActivate(context) and _onActiveTick(dtEff, context)
 * without altering SkillManager or GameEngine.
 */
class ActiveSkill {
    constructor(config) {
        if (new.target === ActiveSkill) {
            throw new Error("ActiveSkill is an abstract base class and cannot be instantiated directly.");
        }
        this.key = config.key;
        this.name = config.name;
        this.cooldown = config.cooldown;
        this.initialCooldown = config.initialCooldown || 0;
        this.duration = config.duration;

        this.remainingCooldown = this.initialCooldown;
        this.activeTimer = 0;
    }

    reset() {
        this.remainingCooldown = this.initialCooldown;
        this.activeTimer = 0;
    }

    isActive() {
        return this.activeTimer > 0;
    }

    isReady() {
        return this.remainingCooldown <= 0 && !this.isActive();
    }

    getCooldownProgress() {
        if (this.cooldown <= 0 || this.remainingCooldown <= 0) return 0;
        return Math.min(1, this.remainingCooldown / this.cooldown);
    }

    activate(skillContext) {
        if (!this.isReady()) return false;
        this.activeTimer = this.duration;
        this.remainingCooldown = this.cooldown;
        this._onActivate(skillContext);
        return true;
    }

    update(dtEff, skillContext) {
        if (this.isActive()) {
            this.activeTimer = Math.max(0, this.activeTimer - dtEff);
            this._onActiveTick(dtEff, skillContext);
        } else if (this.remainingCooldown > 0) {
            this.remainingCooldown = Math.max(0, this.remainingCooldown - dtEff);
        }
    }

    _onActivate(skillContext) {
        // Hook for subclasses
    }

    _onActiveTick(dtEff, skillContext) {
        throw new Error("Subclasses must implement _onActiveTick().");
    }
}

/**
 * Concrete Active Skill: "Hujan Petasan & Botol" (Age of War Meteor Shower style).
 * Drops randomized explosive firecrackers and staggering bottles across the active enemy cluster.
 */
class FireworkBottleRainSkill extends ActiveSkill {
    constructor(config) {
        super(config);
        this._spawnInterval = config.spawnInterval;
        this._variants = config.variants;
        this._spawnAccumulator = 0;
        this._variantCursor = 0;
    }

    reset() {
        super.reset();
        this._spawnAccumulator = 0;
        this._variantCursor = 0;
    }

    _onActivate(skillContext) {
        // Trigger immediate initial drop so player feels instant responsiveness on press
        this._spawnAccumulator = 0;
        this._dropSingleBomb(skillContext);
    }

    _onActiveTick(dtEff, skillContext) {
        this._spawnAccumulator += dtEff;
        while (this._spawnAccumulator >= this._spawnInterval) {
            this._spawnAccumulator -= this._spawnInterval;
            this._dropSingleBomb(skillContext);
        }
    }

    _dropSingleBomb(skillContext) {
        const [minX, maxX] = this._computeStrikeZone(skillContext);
        const targetX = minX + Math.random() * Math.max(10, maxX - minX);

        // Alternate slightly weighted toward PETASAN while keeping BOTOL stagger mixed in
        const variant = this._variants[this._variantCursor % this._variants.length];
        this._variantCursor++;

        skillContext.spawnSkyBomb(new FallingBomb({
            targetX,
            fallSpeed: variant.fallSpeed,
            driftX: variant.driftX,
            damage: variant.damage,
            aoeRadius: variant.aoeRadius,
            variantType: variant.type,
            color: variant.color,
            accentColor: variant.accentColor,
            slowFactor: variant.slowFactor,
            slowDuration: variant.slowDuration
        }));
    }

    _computeStrikeZone(skillContext) {
        const minBound = WORLD_CONFIG.PLAYER_BASE_X + 75;
        const maxBound = WORLD_CONFIG.ENEMY_BASE_X - 45;
        const enemies = skillContext.getEnemyUnits();

        if (!enemies || enemies.length === 0) {
            return [Math.max(minBound, 480), maxBound];
        }

        let minEnemyX = Infinity;
        let maxEnemyX = -Infinity;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e.isAlive()) continue;
            if (e.x < minEnemyX) minEnemyX = e.x;
            if (e.x > maxEnemyX) maxEnemyX = e.x;
        }

        if (!Number.isFinite(minEnemyX)) {
            return [Math.max(minBound, 480), maxBound];
        }

        const zoneMin = Math.max(minBound, minEnemyX - 110);
        const zoneMax = Math.min(maxBound, Math.max(zoneMin + 200, maxEnemyX + 95));
        return [zoneMin, zoneMax];
    }
}
