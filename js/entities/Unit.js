"use strict";

/**
 * Base combat unit class extending Entity.
 * Subclasses override performAttack() and updateBehavior() cleanly (OCP & LSP).
 */
class Unit extends Entity {
    constructor(config, x) {
        super(x, config.width, config.height, config.maxHp, config.faction);
        this.config = config;
        this.key = config.key;
        this.name = config.name;
        this.shortLabel = config.shortLabel;
        this.baseSpeed = config.speed;
        this.damage = config.damage;
        this.attackInterval = config.attackInterval;
        this.range = config.range;
        this.color = config.color;
        this.accentColor = config.accentColor;
        this.scoreReward = config.scoreReward || 0;
        this.knockbackResistance = config.knockbackResistance || 0;

        this.direction = config.faction === FACTIONS.PLAYER ? 1 : -1;
        this.state = "WALK";
        this.attackCooldown = 0;
        this.animTime = 0;

        // Temporary modifiers
        this.atkSpeedBuff = 1.0;
        this.moveSpeedBuff = 1.0;
        this.slowFactor = 1.0;
        this.slowTimer = 0;
    }

    resetBuffs() {
        this.atkSpeedBuff = 1.0;
        this.moveSpeedBuff = 1.0;
    }

    applyOratorBuff(atkMult, moveMult) {
        this.atkSpeedBuff *= atkMult;
        this.moveSpeedBuff *= moveMult;
    }

    applySlow(factor, duration) {
        this.slowFactor = Math.min(this.slowFactor, factor);
        this.slowTimer = Math.max(this.slowTimer, duration);
    }

    applyKnockback(distance) {
        const effectiveDist = distance * (1 - this.knockbackResistance);
        if (effectiveDist <= 0) return;
        this.x -= this.direction * effectiveDist;
        this.x = Math.max(WORLD_CONFIG.PLAYER_BASE_X, Math.min(WORLD_CONFIG.ENEMY_BASE_X, this.x));
    }

    updateTimers(dtEff) {
        super.updateTimers(dtEff);
        this.animTime += dtEff;
        if (this.attackCooldown > 0) {
            this.attackCooldown = Math.max(0, this.attackCooldown - dtEff);
        }
        if (this.slowTimer > 0) {
            this.slowTimer = Math.max(0, this.slowTimer - dtEff);
            if (this.slowTimer === 0) {
                this.slowFactor = 1.0;
            }
        }
    }

    /**
     * Checks 1D X-axis edge-to-edge distance to determine whether target is within attack range.
     */
    isTargetInRange(target) {
        if (!target || !target.isAlive()) return false;
        const distance = this.direction === 1
            ? target.getLeftEdge() - this.getRightEdge()
            : this.getLeftEdge() - target.getRightEdge();
        return distance <= this.range && distance >= -target.width;
    }

    updateBehavior(dtEff, target, combatContext) {
        if (target && this.isTargetInRange(target)) {
            this.state = "ATTACK";
            if (this.attackCooldown <= 0) {
                this.performAttack(target, combatContext);
                this.attackCooldown = this.attackInterval / this.atkSpeedBuff;
            }
        } else {
            this.state = "WALK";
            const effectiveSpeed = this.baseSpeed * this.moveSpeedBuff * this.slowFactor;
            this.x += this.direction * effectiveSpeed * dtEff;
        }
    }

    performAttack(target, combatContext) {
        throw new Error("Subclasses must implement performAttack().");
    }
}

/**
 * Direct melee attacker (Pendemo Wibu, Pendemo Spanduk, Polisi Dalmas).
 */
class MeleeUnit extends Unit {
    performAttack(target, combatContext) {
        target.takeDamage(this.damage);
        combatContext.spawnHitSpark(target.x, WORLD_CONFIG.GROUND_Y - target.height * 0.5, this.accentColor);
    }
}

/**
 * Boss heavy melee attacker with bonus damage against enemy base (Mobil Barracuda).
 */
class BossBarracudaUnit extends Unit {
    performAttack(target, combatContext) {
        const isBase = target instanceof BaseStructure;
        const finalDamage = isBase ? this.damage * (this.config.baseDamageMultiplier || 1.5) : this.damage;
        target.takeDamage(finalDamage);
        combatContext.spawnHitSpark(target.x, WORLD_CONFIG.GROUND_Y - target.height * 0.5, "#ef4444");
    }
}

/**
 * Ranged attacker spawning single-target or AoE projectiles (Mahasiswa, Polisi Gas Air Mata).
 */
class RangedProjectileUnit extends Unit {
    performAttack(target, combatContext) {
        const spawnX = this.x + this.direction * (this.width * 0.45);
        const spawnY = WORLD_CONFIG.GROUND_Y - this.height * 0.65;
        combatContext.spawnProjectile(new Projectile({
            x: spawnX,
            y: spawnY,
            direction: this.direction,
            speed: this.config.projectileSpeed,
            damage: this.damage,
            targetFaction: this.faction === FACTIONS.PLAYER ? FACTIONS.ENEMY : FACTIONS.PLAYER,
            color: this.config.projectileColor,
            radius: this.config.aoeRadius > 0 ? 7 : 5,
            aoeRadius: this.config.aoeRadius || 0
        }));
    }
}

/**
 * Support turret unit spraying pressurized water with AoE slow and knockback (Water Cannon).
 */
class WaterCannonUnit extends Unit {
    performAttack(target, combatContext) {
        const spawnX = this.x + this.direction * (this.width * 0.5);
        const spawnY = WORLD_CONFIG.GROUND_Y - this.height * 0.72;
        combatContext.spawnProjectile(new Projectile({
            x: spawnX,
            y: spawnY,
            direction: this.direction,
            speed: this.config.projectileSpeed,
            damage: this.damage,
            targetFaction: FACTIONS.PLAYER,
            color: this.config.projectileColor,
            radius: 8,
            aoeRadius: this.config.aoeRadius,
            slowFactor: this.config.slowFactor,
            slowDuration: this.config.slowDuration,
            knockbackDistance: this.config.knockbackDistance
        }));
    }
}

/**
 * Stationary stage support unit that buffs all active player units for a fixed duration (Orator).
 */
class OratorUnit extends Unit {
    constructor(config, x) {
        super(config, x);
        this.remainingDuration = config.duration;
        this.state = "SUPPORT";
    }

    isAlive() {
        return this.remainingDuration > 0 && this.hp > 0;
    }

    updateBehavior(dtEff, target, combatContext) {
        this.state = "SUPPORT";
        this.remainingDuration = Math.max(0, this.remainingDuration - dtEff);
        if (this.remainingDuration <= 0) {
            this.hp = 0;
        }
    }

    performAttack() {
        // Orator supports from Panggung Utama without direct attacks
    }
}
