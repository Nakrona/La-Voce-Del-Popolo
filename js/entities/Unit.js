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
        this.damageBuff = 1.0;
        this.damageTakenMult = 1.0;
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

    getAssetId() {
        return UNIT_KEY_TO_ASSET_ID[this.key] || null;
    }

    getEffectiveMoveSpeed() {
        return this.baseSpeed * this.moveSpeedBuff * this.slowFactor;
    }

    getEffectiveAttackInterval() {
        return this.attackInterval / this.atkSpeedBuff;
    }

    getEffectiveDamage() {
        return Math.round(this.damage * this.damageBuff);
    }

    resetBuffs() {
        this.atkSpeedBuff = 1.0;
        this.moveSpeedBuff = 1.0;
        this.damageBuff = 1.0;
        this.damageTakenMult = 1.0;
    }

    applyOratorBuff(atkMult, moveMult, damageMult = 1.0, damageTakenMult = 1.0) {
        this.atkSpeedBuff *= atkMult;
        this.moveSpeedBuff *= moveMult;
        this.damageBuff *= damageMult;
        this.damageTakenMult *= damageTakenMult;
    }

    applyGlobalBuff(buffCfg) {
        if (!buffCfg) return;
        this.applyOratorBuff(
            buffCfg.atkSpeedMultiplier || 1.0,
            buffCfg.moveSpeedMultiplier || 1.0,
            buffCfg.damageMultiplier || 1.0,
            buffCfg.damageTakenMultiplier || 1.0
        );
    }

    heal(amount) {
        if (!this.isAlive() || amount <= 0) return 0;
        const before = this.hp;
        this.hp = Math.min(this.maxHp, this.hp + amount);
        return this.hp - before;
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
        super.takeDamage(amount * this.damageTakenMult);
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
            tags.push(`Buff +${Math.round((this.atkSpeedBuff - 1) * 100)}% AtkSpd`);
        }
        if (this.damageBuff > 1.01) {
            tags.push(`Buff +${Math.round((this.damageBuff - 1) * 100)}% DMG`);
        }
        if (this.damageTakenMult < 0.99) {
            tags.push(`Perisai -${Math.round((1 - this.damageTakenMult) * 100)}% DMG`);
        }
        if (this.moveSpeedBuff > 1.01) {
            tags.push(`+${Math.round((this.moveSpeedBuff - 1) * 100)}% Speed`);
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
                { label: "Damage", value: `${this.getEffectiveDamage()}` },
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
 * Direct melee attacker (Pendemo Wibu, Spanduk, Ojol, Punk, Buruh, Dalmas, Brimob).
 */
class MeleeUnit extends Unit {
    performAttack(target, combatContext) {
        target.takeDamage(this.getEffectiveDamage());
        combatContext.spawnHitSpark(target.x, WORLD_CONFIG.GROUND_Y - target.height * 0.5, this.accentColor);
        combatContext.notifyMeleeHit();
    }
}

/**
 * Heavy armored attacker supporting bonus base damage plus optional AoE projectiles (Barracuda, Tank Anoa, Mobil Komando).
 */
class BossBarracudaUnit extends Unit {
    performAttack(target, combatContext) {
        const baseDmg = this.getEffectiveDamage();
        const isBase = target instanceof BaseStructure;
        const baseMult = this.config.baseDamageMultiplier || 1.5;

        if (this.config.projectileAssetId) {
            const spawnX = this.x + this.direction * (this.width * 0.48);
            const spawnY = WORLD_CONFIG.GROUND_Y - this.height * 0.62;
            combatContext.spawnProjectile(new Projectile({
                x: spawnX,
                y: spawnY,
                direction: this.direction,
                speed: this.config.projectileSpeed || 520,
                damage: baseDmg,
                baseDamageMultiplier: baseMult,
                targetFaction: this.faction === FACTIONS.PLAYER ? FACTIONS.ENEMY : FACTIONS.PLAYER,
                color: this.config.projectileColor || "#f97316",
                radius: 8,
                aoeRadius: this.config.aoeRadius || 0,
                aoeImpactKind: this.config.aoeImpactKind || "",
                assetId: this.config.projectileAssetId
            }));
            combatContext.notifyRangedShot();
            return;
        }

        const finalDamage = isBase ? baseDmg * baseMult : baseDmg;
        target.takeDamage(finalDamage);
        const splashRadius = this.config.aoeRadius || 0;
        if (splashRadius > 0 && !isBase) {
            const opponents = this.faction === FACTIONS.ENEMY ? combatContext.playerUnits : combatContext.enemyUnits;
            for (let i = 0; i < opponents.length; i++) {
                const other = opponents[i];
                if (other !== target && other.isAlive() && Math.abs(other.x - target.x) <= splashRadius) {
                    other.takeDamage(baseDmg);
                }
            }
            combatContext.spawnAoeCloud(target.x, WORLD_CONFIG.GROUND_Y - 26, this.accentColor || "#f97316", splashRadius);
        }
        combatContext.spawnHitSpark(target.x, WORLD_CONFIG.GROUND_Y - target.height * 0.5, this.accentColor || "#ef4444");
        combatContext.notifyMeleeHit();
    }
}

/**
 * Ranged attacker spawning config-driven single-target or AoE projectiles (Mahasiswa, Pers, Mural, Gas Air Mata, Tentara).
 */
class RangedProjectileUnit extends Unit {
    performAttack(target, combatContext) {
        const spawnX = this.x + this.direction * (this.width * 0.45);
        const spawnY = WORLD_CONFIG.GROUND_Y - this.height * 0.65;
        const projAssetId = this.config.projectileAssetId
            || (this.config.aoeRadius > 0 ? ASSET_IDS.PROJ_TABUNG_GAS : ASSET_IDS.PROJ_KERIKIL);
        combatContext.spawnProjectile(new Projectile({
            x: spawnX,
            y: spawnY,
            direction: this.direction,
            speed: this.config.projectileSpeed,
            damage: this.getEffectiveDamage(),
            baseDamageMultiplier: this.config.baseDamageMultiplier || 1.0,
            targetFaction: this.faction === FACTIONS.PLAYER ? FACTIONS.ENEMY : FACTIONS.PLAYER,
            color: this.config.projectileColor,
            radius: this.config.aoeRadius > 0 ? 7 : 5,
            aoeRadius: this.config.aoeRadius || 0,
            aoeImpactKind: this.config.aoeImpactKind || "",
            slowFactor: this.config.slowFactor || 1.0,
            slowDuration: this.config.slowDuration || 0,
            knockbackDistance: this.config.knockbackDistance || 0,
            assetId: projAssetId
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
            damage: this.getEffectiveDamage(),
            targetFaction: FACTIONS.PLAYER,
            color: this.config.projectileColor,
            radius: 8,
            aoeRadius: this.config.aoeRadius,
            slowFactor: this.config.slowFactor,
            slowDuration: this.config.slowDuration,
            knockbackDistance: this.config.knockbackDistance,
            assetId: ASSET_IDS.PROJ_SEMBURAN_AIR
        }));
    }
}

/**
 * Field healer staying behind the frontline to periodically restore AoE HP to wounded allies (Tim Medis).
 */
class HealerUnit extends Unit {
    updateBehavior(dtEff, target, combatContext) {
        if (!this.isAlive()) {
            this.fsm.changeState("DEAD");
            return;
        }
        const allies = combatContext.playerUnits;
        let injuredAlly = null;
        let frontMostAlly = null;

        for (let i = 0; i < allies.length; i++) {
            const ally = allies[i];
            if (!ally.isAlive() || ally === this) continue;
            const cfg = UNIT_CONFIGS[ally.key];
            if (cfg && cfg.slotCategory === UNIT_SLOT_CATEGORIES.GLOBAL_BUFF) continue;

            if (!frontMostAlly || ally.x > frontMostAlly.x) {
                frontMostAlly = ally;
            }
            if (ally.hp < ally.maxHp && Math.abs(ally.x - this.x) <= this.range) {
                injuredAlly = ally;
            }
        }

        this._fsmContext.target = injuredAlly;
        this._fsmContext.combatContext = combatContext;

        if (injuredAlly) {
            this.fsm.changeState("ATTACK");
            this.fsm.update(dtEff);
            return;
        }

        const safeStopX = frontMostAlly ? frontMostAlly.x - 75 : WORLD_CONFIG.PLAYER_BASE_X + 125;
        if (this.x < safeStopX) {
            this.fsm.changeState("WALK");
            this.fsm.update(dtEff);
        } else {
            this.fsm.changeState("SUPPORT");
        }
    }

    performAttack(_target, combatContext) {
        const healRadius = this.config.aoeRadius || 110;
        const healAmount = Math.max(1, this.getEffectiveDamage());
        let healedCount = 0;

        for (let i = 0; i < combatContext.playerUnits.length; i++) {
            const ally = combatContext.playerUnits[i];
            if (!ally.isAlive() || ally === this) continue;
            const cfg = UNIT_CONFIGS[ally.key];
            if (cfg && cfg.slotCategory === UNIT_SLOT_CATEGORIES.GLOBAL_BUFF) continue;
            if (Math.abs(ally.x - this.x) <= healRadius && ally.hp < ally.maxHp) {
                ally.heal(healAmount);
                combatContext.spawnHitSpark(ally.x, WORLD_CONFIG.GROUND_Y - ally.height * 0.65, "#4ade80", 12);
                healedCount++;
            }
        }

        if (healedCount > 0) {
            combatContext.spawnAoeCloud(this.x, WORLD_CONFIG.GROUND_Y - 26, "#22c55e", healRadius * 0.45);
            combatContext.notifyHealPulse();
        }
    }

    toTooltipData() {
        const data = super.toTooltipData();
        data.stats[0] = { label: "Heal AoE", value: `+${this.getEffectiveDamage()} HP (${this.config.aoeRadius} px)` };
        return data;
    }
}

/**
 * Stationary stage support unit that applies configurable Global Buffs for a fixed duration
 * (Orator Panggung, Dirigen Perkusi, Korlap Taktis).
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
        // Stage Global Buff units support from home base without direct attacks
    }

    toTooltipData() {
        const stats = [];
        if ((this.config.atkSpeedMultiplier || 1) > 1.001) {
            stats.push({ label: "Buff Atk Speed", value: `+${Math.round((this.config.atkSpeedMultiplier - 1) * 100)}%` });
        }
        if ((this.config.damageMultiplier || 1) > 1.001) {
            stats.push({ label: "Buff Damage", value: `+${Math.round((this.config.damageMultiplier - 1) * 100)}%` });
        }
        if ((this.config.damageTakenMultiplier || 1) < 0.999) {
            stats.push({ label: "Kurangi DMG Masuk", value: `-${Math.round((1 - this.config.damageTakenMultiplier) * 100)}%` });
        }
        if ((this.config.moralRegenMultiplier || 1) > 1.001) {
            stats.push({ label: "Buff Regen Moral", value: `+${Math.round((this.config.moralRegenMultiplier - 1) * 100)}%` });
        }
        if ((this.config.moveSpeedMultiplier || 1) > 1.001) {
            stats.push({ label: "Buff Move Speed", value: `+${Math.round((this.config.moveSpeedMultiplier - 1) * 100)}%` });
        }
        stats.push({ label: "Jangkauan", value: "Seluruh Arena (Global)" });
        stats.push({ label: "Sisa Durasi", value: `${this.remainingDuration.toFixed(1)}s` });

        return {
            title: this.name,
            subtitle: this.roleLabel,
            factionKind: "player",
            badgeText: this.getStateLabel(),
            hpCurrent: Number(this.remainingDuration.toFixed(1)),
            hpMax: this.config.duration,
            hpUnitLabel: "dtk",
            stats,
            note: this.description
        };
    }
}
