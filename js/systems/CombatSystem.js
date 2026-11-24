"use strict";

/**
 * Resolves 1D X-axis combat targeting, Orator global buffs, projectiles, AoE effects,
 * lightweight particles, and memory-safe reverse-loop entity cleanup.
 */
class CombatSystem {
    constructor(eventBus) {
        this._eventBus = eventBus;
        this.playerUnits = [];
        this.enemyUnits = [];
        this.projectiles = [];
        this.skyBombs = [];
        this.particles = [];
        this.playerBase = null;
        this.enemyBase = null;
        this.screenShakeTimer = 0;
        this.moralRegenMultiplier = 1.0;
    }

    reset(playerBase, enemyBase) {
        this.playerUnits = [];
        this.enemyUnits = [];
        this.projectiles = [];
        this.skyBombs = [];
        this.particles = [];
        this.playerBase = playerBase;
        this.enemyBase = enemyBase;
        this.screenShakeTimer = 0;
        this.moralRegenMultiplier = 1.0;
    }

    getMoralRegenMultiplier() {
        return this.moralRegenMultiplier;
    }

    getEnemyUnits() {
        return this.enemyUnits;
    }

    spawnSkyBomb(bomb) {
        this.skyBombs.push(bomb);
    }

    notifyMeleeHit() {
        this._eventBus.emit("MELEE_HIT");
    }

    notifyRangedShot() {
        this._eventBus.emit("RANGED_SHOT");
    }

    notifyHealPulse() {
        this._eventBus.emit("HEAL_PULSE");
    }

    _isGlobalBuffUnit(unit) {
        const cfg = UNIT_CONFIGS[unit.key];
        return Boolean(cfg && cfg.slotCategory === UNIT_SLOT_CATEGORIES.GLOBAL_BUFF);
    }

    canSpawnPlayerUnit(unitKey) {
        const cfg = UNIT_CONFIGS[unitKey];
        if (!cfg) return false;
        if (cfg.slotCategory === UNIT_SLOT_CATEGORIES.GLOBAL_BUFF) {
            let activeBuffUnits = 0;
            for (let i = 0; i < this.playerUnits.length; i++) {
                if (this._isGlobalBuffUnit(this.playerUnits[i])) activeBuffUnits++;
            }
            return activeBuffUnits < (cfg.maxStacks || 2);
        }
        return this.playerUnits.length < WORLD_CONFIG.MAX_UNITS_PER_FACTION;
    }

    addUnit(unit) {
        if (unit.faction === FACTIONS.PLAYER) {
            if (this.playerUnits.length < WORLD_CONFIG.MAX_UNITS_PER_FACTION + 2) {
                this.playerUnits.push(unit);
            }
        } else if (this.enemyUnits.length < WORLD_CONFIG.MAX_UNITS_PER_FACTION) {
            this.enemyUnits.push(unit);
        }
    }

    spawnProjectile(projectile) {
        this.projectiles.push(projectile);
    }

    spawnHitSpark(x, y, color, radius = 14) {
        if (this.particles.length >= 120) return;
        this.particles.push({
            x,
            y,
            color,
            radius,
            life: 0.25,
            maxLife: 0.25,
            isCloud: false
        });
    }

    spawnAoeCloud(x, y, color, radius) {
        if (this.particles.length >= 120) return;
        this.particles.push({
            x,
            y,
            color,
            radius,
            life: 0.7,
            maxLife: 0.7,
            isCloud: true
        });
    }

    update(dtEff) {
        if (this.screenShakeTimer > 0) {
            this.screenShakeTimer = Math.max(0, this.screenShakeTimer - dtEff);
        }
        this._applyOratorBuffs();
        this._updateUnitList(this.playerUnits, this.enemyUnits, this.enemyBase, dtEff);
        this._updateUnitList(this.enemyUnits, this.playerUnits, this.playerBase, dtEff);
        this._updateProjectiles(dtEff);
        this._updateSkyBombs(dtEff);
        this._updateParticles(dtEff);
        this._cleanupDeadEntities();
        this._emitCrowdDominance();
    }

    _emitCrowdDominance() {
        const pCount = this.playerUnits.length;
        const eCount = this.enemyUnits.length;
        if (pCount + eCount === 0) {
            this._eventBus.emit("CROWD_DOMINANCE", { ratio: 0.1 });
            return;
        }
        let maxPlayerX = WORLD_CONFIG.PLAYER_BASE_X;
        for (let i = 0; i < pCount; i++) {
            if (this.playerUnits[i].x > maxPlayerX) maxPlayerX = this.playerUnits[i].x;
        }
        const span = WORLD_CONFIG.ENEMY_BASE_X - WORLD_CONFIG.PLAYER_BASE_X;
        const pushRatio = span > 0 ? (maxPlayerX - WORLD_CONFIG.PLAYER_BASE_X) / span : 0;
        const countRatio = pCount / (pCount + eCount);
        this._eventBus.emit("CROWD_DOMINANCE", { ratio: (pushRatio * 0.6) + (countRatio * 0.4) });
    }

    _applyOratorBuffs() {
        this.moralRegenMultiplier = 1.0;
        const activeBuffs = [];

        for (let i = 0; i < this.playerUnits.length; i++) {
            const u = this.playerUnits[i];
            if (u.isAlive() && this._isGlobalBuffUnit(u)) {
                const cfg = UNIT_CONFIGS[u.key];
                if (cfg) {
                    activeBuffs.push(cfg);
                    this.moralRegenMultiplier *= (cfg.moralRegenMultiplier || 1.0);
                }
            }
        }

        for (let i = 0; i < this.playerUnits.length; i++) {
            const u = this.playerUnits[i];
            u.resetBuffs();
            if (!this._isGlobalBuffUnit(u)) {
                for (let s = 0; s < activeBuffs.length; s++) {
                    u.applyGlobalBuff(activeBuffs[s]);
                }
            }
        }
    }

    _findNearestTarget(unit, opposingUnits, opposingBase) {
        let nearest = null;
        let bestDist = Infinity;

        for (let i = 0; i < opposingUnits.length; i++) {
            const candidate = opposingUnits[i];
            if (!candidate.isAlive() || this._isGlobalBuffUnit(candidate)) continue;
            const dist = unit.direction === 1
                ? candidate.getLeftEdge() - unit.getRightEdge()
                : unit.getLeftEdge() - candidate.getRightEdge();

            if (dist >= -candidate.width && dist < bestDist) {
                bestDist = dist;
                nearest = candidate;
            }
        }

        if (opposingBase && opposingBase.isAlive()) {
            const baseDist = unit.direction === 1
                ? opposingBase.getLeftEdge() - unit.getRightEdge()
                : unit.getLeftEdge() - opposingBase.getRightEdge();
            if (baseDist < bestDist) {
                nearest = opposingBase;
            }
        }
        return nearest;
    }

    _updateUnitList(units, opposingUnits, opposingBase, dtEff) {
        if (this.playerBase) this.playerBase.updateTimers(dtEff);
        if (this.enemyBase) this.enemyBase.updateTimers(dtEff);

        for (let i = 0; i < units.length; i++) {
            const u = units[i];
            if (!u.isAlive()) continue;
            u.updateTimers(dtEff);
            const target = this._findNearestTarget(u, opposingUnits, opposingBase);
            u.updateBehavior(dtEff, target, this);
        }
    }

    _updateProjectiles(dtEff) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(dtEff);

            if (p.active) {
                const targets = p.targetFaction === FACTIONS.ENEMY ? this.enemyUnits : this.playerUnits;
                const targetBase = p.targetFaction === FACTIONS.ENEMY ? this.enemyBase : this.playerBase;
                this._checkProjectileImpact(p, targets, targetBase);
            }

            if (!p.active) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    _checkProjectileImpact(p, targets, targetBase) {
        let hitTarget = null;
        for (let i = 0; i < targets.length; i++) {
            const t = targets[i];
            if (!t.isAlive() || this._isGlobalBuffUnit(t)) continue;
            if (p.x >= t.getLeftEdge() && p.x <= t.getRightEdge()) {
                hitTarget = t;
                break;
            }
        }

        if (!hitTarget && targetBase && targetBase.isAlive()) {
            if (p.x >= targetBase.getLeftEdge() && p.x <= targetBase.getRightEdge()) {
                hitTarget = targetBase;
            }
        }

        if (!hitTarget) return;

        p.active = false;
        if (p.aoeRadius > 0) {
            const impactKind = p.aoeImpactKind || (p.slowDuration > 0 ? "WATER" : "TEARGAS");
            this._eventBus.emit("AOE_IMPACT", { kind: impactKind });
            this.spawnAoeCloud(p.x, WORLD_CONFIG.GROUND_Y - 26, p.color, p.aoeRadius);
            for (let i = 0; i < targets.length; i++) {
                const t = targets[i];
                if (!t.isAlive() || this._isGlobalBuffUnit(t)) continue;
                if (Math.abs(t.x - p.x) <= p.aoeRadius) {
                    t.takeDamage(p.damage);
                    if (p.slowDuration > 0) t.applySlow(p.slowFactor, p.slowDuration);
                    if (p.knockbackDistance > 0) t.applyKnockback(p.knockbackDistance);
                }
            }
            if (targetBase && targetBase.isAlive() && Math.abs(targetBase.x - p.x) <= p.aoeRadius) {
                targetBase.takeDamage(p.damage * (p.baseDamageMultiplier || 1.0));
            }
        } else {
            const isBaseHit = targetBase && hitTarget === targetBase;
            const dmg = isBaseHit ? p.damage * (p.baseDamageMultiplier || 1.0) : p.damage;
            hitTarget.takeDamage(dmg);
            if (!isBaseHit && p.slowDuration > 0 && hitTarget.applySlow) {
                hitTarget.applySlow(p.slowFactor, p.slowDuration);
            }
            if (!isBaseHit && p.knockbackDistance > 0 && hitTarget.applyKnockback) {
                hitTarget.applyKnockback(p.knockbackDistance);
            }
            this.spawnHitSpark(p.x, p.y, p.color, 10);
        }
    }

    _updateSkyBombs(dtEff) {
        for (let i = this.skyBombs.length - 1; i >= 0; i--) {
            const bomb = this.skyBombs[i];
            const impacted = bomb.update(dtEff);
            if (!impacted) continue;

            this._applySkyBombImpact(bomb);
            this.skyBombs.splice(i, 1);
        }
    }

    _applySkyBombImpact(bomb) {
        this._eventBus.emit("AOE_IMPACT", { kind: "PETASAN" });
        this.screenShakeTimer = 0.09;
        this.spawnHitSpark(bomb.targetX, bomb.groundY - 8, bomb.accentColor, bomb.aoeRadius * 0.45);
        this.spawnAoeCloud(bomb.targetX, bomb.groundY - 12, bomb.color, bomb.aoeRadius * 0.72);

        for (let i = 0; i < this.enemyUnits.length; i++) {
            const enemy = this.enemyUnits[i];
            if (!enemy.isAlive()) continue;
            if (Math.abs(enemy.x - bomb.targetX) <= bomb.aoeRadius) {
                enemy.takeDamage(bomb.damage);
                if (bomb.slowDuration > 0) {
                    enemy.applySlow(bomb.slowFactor, bomb.slowDuration);
                }
            }
        }
    }

    _updateParticles(dtEff) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].life -= dtEff;
            if (this.particles[i].life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    _cleanupDeadEntities() {
        for (let i = this.playerUnits.length - 1; i >= 0; i--) {
            if (!this.playerUnits[i].isAlive()) {
                this.playerUnits.splice(i, 1);
            }
        }
        for (let i = this.enemyUnits.length - 1; i >= 0; i--) {
            if (!this.enemyUnits[i].isAlive()) {
                const killed = this.enemyUnits[i];
                if (killed.scoreReward > 0) {
                    this._eventBus.emit("ENEMY_KILLED", { score: killed.scoreReward });
                }
                this.enemyUnits.splice(i, 1);
            }
        }
    }
}
