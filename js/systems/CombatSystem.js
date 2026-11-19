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
        this.particles = [];
        this.playerBase = null;
        this.enemyBase = null;
    }

    reset(playerBase, enemyBase) {
        this.playerUnits = [];
        this.enemyUnits = [];
        this.projectiles = [];
        this.particles = [];
        this.playerBase = playerBase;
        this.enemyBase = enemyBase;
    }

    canSpawnPlayerUnit(unitKey) {
        if (unitKey === "ORATOR") {
            let activeOrators = 0;
            for (let i = 0; i < this.playerUnits.length; i++) {
                if (this.playerUnits[i].key === "ORATOR") activeOrators++;
            }
            return activeOrators < UNIT_CONFIGS.ORATOR.maxStacks;
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
        this._applyOratorBuffs();
        this._updateUnitList(this.playerUnits, this.enemyUnits, this.enemyBase, dtEff);
        this._updateUnitList(this.enemyUnits, this.playerUnits, this.playerBase, dtEff);
        this._updateProjectiles(dtEff);
        this._updateParticles(dtEff);
        this._cleanupDeadEntities();
    }

    _applyOratorBuffs() {
        let oratorCount = 0;
        for (let i = 0; i < this.playerUnits.length; i++) {
            const u = this.playerUnits[i];
            if (u.key === "ORATOR" && u.isAlive()) {
                oratorCount++;
            }
        }

        const oratorCfg = UNIT_CONFIGS.ORATOR;
        for (let i = 0; i < this.playerUnits.length; i++) {
            const u = this.playerUnits[i];
            u.resetBuffs();
            if (u.key !== "ORATOR") {
                for (let s = 0; s < oratorCount; s++) {
                    u.applyOratorBuff(oratorCfg.atkSpeedMultiplier, oratorCfg.moveSpeedMultiplier);
                }
            }
        }
    }

    _findNearestTarget(unit, opposingUnits, opposingBase) {
        let nearest = null;
        let bestDist = Infinity;

        for (let i = 0; i < opposingUnits.length; i++) {
            const candidate = opposingUnits[i];
            if (!candidate.isAlive() || candidate.key === "ORATOR") continue;
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
            if (!t.isAlive() || t.key === "ORATOR") continue;
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
            this.spawnAoeCloud(p.x, WORLD_CONFIG.GROUND_Y - 26, p.color, p.aoeRadius);
            for (let i = 0; i < targets.length; i++) {
                const t = targets[i];
                if (!t.isAlive() || t.key === "ORATOR") continue;
                if (Math.abs(t.x - p.x) <= p.aoeRadius) {
                    t.takeDamage(p.damage);
                    if (p.slowDuration > 0) t.applySlow(p.slowFactor, p.slowDuration);
                    if (p.knockbackDistance > 0) t.applyKnockback(p.knockbackDistance);
                }
            }
            if (targetBase && targetBase.isAlive() && Math.abs(targetBase.x - p.x) <= p.aoeRadius) {
                targetBase.takeDamage(p.damage);
            }
        } else {
            hitTarget.takeDamage(p.damage);
            this.spawnHitSpark(p.x, p.y, p.color, 10);
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
