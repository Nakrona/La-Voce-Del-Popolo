"use strict";

/**
 * Flyweight FSM states for Unit behavioral lifecycle (Zero-GC, OCP, LSP).
 */
class UnitWalkState extends IState {
    get name() { return "WALK"; }

    onUpdate(dtEff, ctx) {
        const { unit } = ctx;
        const effectiveSpeed = unit.getEffectiveMoveSpeed();
        unit.x += unit.direction * effectiveSpeed * dtEff;
    }
}

class UnitAttackState extends IState {
    get name() { return "ATTACK"; }

    onUpdate(dtEff, ctx) {
        const { unit, target, combatContext } = ctx;
        if (target && unit.attackCooldown <= 0) {
            unit.performAttack(target, combatContext);
            unit.attackCooldown = unit.getEffectiveAttackInterval();
        }
    }
}

class UnitSupportState extends IState {
    get name() { return "SUPPORT"; }

    onUpdate(dtEff, ctx) {
        const { unit } = ctx;
        unit.remainingDuration = Math.max(0, unit.remainingDuration - dtEff);
        if (unit.remainingDuration <= 0) {
            unit.hp = 0;
            unit.fsm.changeState("DEAD");
        }
    }
}

class UnitDeadState extends IState {
    get name() { return "DEAD"; }
}

const SHARED_UNIT_STATES = [
    new UnitWalkState(),
    new UnitAttackState(),
    new UnitSupportState(),
    new UnitDeadState()
];

const UNIT_STATE_LABELS = Object.freeze({
    WALK: "Berjalan Maju",
    ATTACK: "Sedang Menyerang",
    SUPPORT: "Berorasi (Buff)",
    DEAD: "Tumbang"
});

/**
 * Base combat unit class extending Entity and driven by FiniteStateMachine.
 * Subclasses override performAttack() and optionally toTooltipData() cleanly (OCP & LSP).
 */
class Unit extends Entity {
    constructor(config, x) {
        super(x, config.width, config.height, config.maxHp, config.faction);
        this.config = config;
        this.key = config.key;
        this.name = config.name;
        this.shortLabel = config.shortLabel;
        this.roleLabel = config.roleLabel || "";
        this.description = config.description || "";
        this.baseSpeed = config.speed;
        this.damage = config.damage;
        this.attackInterval = config.attackInterval;
        this.range = config.range;
        this.color = config.color;
        this.accentColor = config.accentColor;
        this.scoreReward = config.scoreReward || 0;
        this.knockbackResistance = config.knockbackResistance || 0;

        this.direction = config.faction === FACTIONS.PLAYER ? 1 : -1;
        this.attackCooldown = 0;
        this.animTime = 0;

        // Temporary modifiers
        this.atkSpeedBuff = 1.0;
        this.moveSpeedBuff = 1.0;
        this.slowFactor = 1.0;
        this.slowTimer = 0;

        // Reusable context object avoids per-frame allocations (Zero-GC)
        this._fsmContext = { unit: this, target: null, combatContext: null };
        this.fsm = new FiniteStateMachine(SHARED_UNIT_STATES, this._fsmContext, "WALK");
    }

    get state() {
        return this.fsm.getCurrentStateName();
    }

    getStateLabel() {
        return UNIT_STATE_LABELS[this.state] || this.state;
    }

    getEffectiveMoveSpeed() {
        return this.baseSpeed * this.moveSpeedBuff * this.slowFactor;
    }

    getEffectiveAttackInterval() {
        return this.attackInterval / this.atkSpeedBuff;
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

    takeDamage(amount) {
        super.takeDamage(amount);
        if (!this.isAlive()) {
            this.fsm.changeState("DEAD");
        }
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
        if (!this.isAlive()) {
            this.fsm.changeState("DEAD");
            return;
        }
        this._fsmContext.target = target;
        this._fsmContext.combatContext = combatContext;

        if (target && this.isTargetInRange(target)) {
            this.fsm.changeState("ATTACK");
        } else {
            this.fsm.changeState("WALK");
        }
        this.fsm.update(dtEff);
    }

    performAttack(target, combatContext) {
        throw new Error("Subclasses must implement performAttack().");
    }

    getActiveEffectSummary() {
        const tags = [];
        if (this.atkSpeedBuff > 1.01) {
            tags.push(`Orasi +${Math.round((this.atkSpeedBuff - 1) * 100)}% AtkSpd`);
        }
        if (this.slowTimer > 0) {
            tags.push(`Slow -${Math.round((1 - this.slowFactor) * 100)}% (${this.slowTimer.toFixed(1)}s)`);
        }
        if (this.config.aoeRadius > 0) {
            tags.push(`AoE ${this.config.aoeRadius} px`);
        }
        if (this.knockbackResistance >= 1.0) {
            tags.push("Kebal Knockback");
        } else if (this.knockbackResistance > 0) {
            tags.push(`Tahan KB ${Math.round(this.knockbackResistance * 100)}%`);
        }
        return tags.length > 0 ? tags.join(" | ") : "Normal";
    }

    toTooltipData() {
        const isPlayer = this.faction === FACTIONS.PLAYER;
        return {
            title: this.name,
            subtitle: this.roleLabel || (isPlayer ? "Unit Pendemo" : "Unit Kepolisian"),
            factionKind: isPlayer ? "player" : "enemy",
            badgeText: this.getStateLabel(),
            hpCurrent: Math.ceil(this.hp),
            hpMax: this.maxHp,
            stats: [
                { label: "Damage", value: `${this.damage}` },
                { label: "Interval Serang", value: `${this.getEffectiveAttackInterval().toFixed(2)}s` },
                { label: "Jarak Serang", value: `${this.range} px` },
                { label: "Kecepatan", value: `${Math.round(this.getEffectiveMoveSpeed())} px/s` },
                { label: "Efek Aktif", value: this.getActiveEffectSummary() }
            ],
            note: this.description
        };
    }
}

/**
 * Direct melee attacker (Pendemo Wibu, Pendemo Spanduk, Polisi Dalmas).
 */
class MeleeUnit extends Unit {
    performAttack(target, combatContext) {
        target.takeDamage(this.damage);
        combatContext.spawnHitSpark(target.x, WORLD_CONFIG.GROUND_Y - target.height * 0.5, this.accentColor);
        combatContext.notifyMeleeHit();
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
        combatContext.notifyMeleeHit();
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
        combatContext.notifyRangedShot();
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
        this.fsm.changeState("SUPPORT");
    }

    isAlive() {
        return this.remainingDuration > 0 && this.hp > 0;
    }

    updateBehavior(dtEff, target, combatContext) {
        this._fsmContext.combatContext = combatContext;
        if (!this.isAlive()) {
            this.fsm.changeState("DEAD");
            return;
        }
        this.fsm.changeState("SUPPORT");
        this.fsm.update(dtEff);
    }

    performAttack() {
        // Orator supports from Panggung Utama without direct attacks
    }

    toTooltipData() {
        return {
            title: this.name,
            subtitle: this.roleLabel,
            factionKind: "player",
            badgeText: this.getStateLabel(),
            hpCurrent: Number(this.remainingDuration.toFixed(1)),
            hpMax: this.config.duration,
            hpUnitLabel: "dtk",
            stats: [
                { label: "Buff Atk Speed", value: `+${Math.round((this.config.atkSpeedMultiplier - 1) * 100)}%` },
                { label: "Buff Speed", value: `+${Math.round((this.config.moveSpeedMultiplier - 1) * 100)}%` },
                { label: "Jangkauan", value: "Seluruh Arena (Global)" },
                { label: "Sisa Durasi", value: `${this.remainingDuration.toFixed(1)}s` }
            ],
            note: this.description
        };
    }
}
