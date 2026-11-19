"use strict";

/**
 * Pure Canvas 2D renderer responsible only for visual presentation (SRP).
 * Performs off-screen frustum culling via Camera.isVisible().
 */
class Renderer {
    constructor(canvas, camera) {
        this._canvas = canvas;
        this._ctx = canvas.getContext("2d");
        this._camera = camera;
    }

    render(combatSystem) {
        const ctx = this._ctx;
        const w = WORLD_CONFIG.VIEWPORT_WIDTH;
        const h = WORLD_CONFIG.VIEWPORT_HEIGHT;
        ctx.imageSmoothingEnabled = false;

        this._drawEnvironment(ctx, w, h);

        ctx.save();
        ctx.translate(-Math.round(this._camera.x), 0);

        if (combatSystem.playerBase) this._drawBase(ctx, combatSystem.playerBase);
        if (combatSystem.enemyBase) this._drawBase(ctx, combatSystem.enemyBase);

        this._drawUnits(ctx, combatSystem.playerUnits);
        this._drawUnits(ctx, combatSystem.enemyUnits);
        this._drawProjectiles(ctx, combatSystem.projectiles);
        this._drawParticles(ctx, combatSystem.particles);

        ctx.restore();

        this._drawOffscreenIndicator(ctx, combatSystem, w);
    }

    _drawEnvironment(ctx, w, h) {
        // Sky gradient
        const grad = ctx.createLinearGradient(0, 0, 0, WORLD_CONFIG.GROUND_Y);
        grad.addColorStop(0, "#1e293b");
        grad.addColorStop(1, "#475569");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, WORLD_CONFIG.GROUND_Y);

        // Parallax urban buildings
        const parallaxX = this._camera.x * 0.35;
        ctx.fillStyle = "#1e2430";
        for (let bx = -120; bx < WORLD_CONFIG.WORLD_WIDTH; bx += 110) {
            const screenX = bx - (parallaxX % 220);
            const bHeight = 120 + ((bx * 37) % 110);
            ctx.fillRect(screenX, WORLD_CONFIG.GROUND_Y - bHeight, 88, bHeight);

            ctx.fillStyle = "rgba(251, 191, 36, 0.25)";
            for (let wy = WORLD_CONFIG.GROUND_Y - bHeight + 18; wy < WORLD_CONFIG.GROUND_Y - 24; wy += 24) {
                ctx.fillRect(screenX + 14, wy, 12, 10);
                ctx.fillRect(screenX + 42, wy, 12, 10);
            }
            ctx.fillStyle = "#1e2430";
        }

        // Sidewalk
        ctx.fillStyle = "#64748b";
        ctx.fillRect(0, WORLD_CONFIG.GROUND_Y - 10, w, 12);

        // Asphalt street
        ctx.fillStyle = "#33373d";
        ctx.fillRect(0, WORLD_CONFIG.GROUND_Y, w, h - WORLD_CONFIG.GROUND_Y);

        // Dashed road markings synced to camera
        ctx.fillStyle = "#cbd5e1";
        const stripeOffset = -(this._camera.x % 90);
        for (let sx = stripeOffset; sx < w; sx += 90) {
            ctx.fillRect(sx, WORLD_CONFIG.GROUND_Y + 34, 46, 6);
        }
    }

    _drawBase(ctx, base) {
        if (!this._camera.isVisible(base.x, base.width, 140)) return;

        const left = base.getLeftEdge();
        const top = WORLD_CONFIG.GROUND_Y - base.height;
        const isPlayer = base.faction === FACTIONS.PLAYER;

        // Flash white when hit
        ctx.fillStyle = base.hitFlashTimer > 0 ? "#ffffff" : (isPlayer ? "#7c2d12" : "#1e3a8a");
        ctx.fillRect(left, top, base.width, base.height);

        ctx.strokeStyle = isPlayer ? "#f59e0b" : "#93c5fd";
        ctx.lineWidth = 3;
        ctx.strokeRect(left, top, base.width, base.height);

        // Roof / Banner sign
        ctx.fillStyle = isPlayer ? "#ea580c" : "#0f172a";
        ctx.fillRect(left - 6, top - 18, base.width + 12, 22);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px Segoe UI";
        ctx.textAlign = "center";
        ctx.fillText(base.label, base.x, top - 3);

        // Base HP bar
        const barW = 124;
        const barH = 12;
        const barX = base.x - barW * 0.5;
        const barY = top - 38;
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = isPlayer ? "#22c55e" : "#ef4444";
        ctx.fillRect(barX + 1, barY + 1, (barW - 2) * base.getHpRatio(), barH - 2);
        ctx.strokeStyle = "#f8fafc";
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);

        ctx.fillStyle = "#f8fafc";
        ctx.font = "bold 10px Segoe UI";
        ctx.fillText(`${Math.ceil(base.hp)} / ${base.maxHp}`, base.x, barY - 4);
    }

    _drawUnits(ctx, units) {
        for (let i = 0; i < units.length; i++) {
            const u = units[i];
            if (!u.isAlive()) continue;
            if (!this._camera.isVisible(u.x, u.width)) continue;

            const bobY = u.state === "WALK" ? Math.abs(Math.sin(u.animTime * 10)) * -4 : 0;
            const attackPush = (u.state === "ATTACK" && u.attackCooldown > u.attackInterval * 0.7)
                ? u.direction * 5
                : 0;

            const drawX = u.x + attackPush;
            const left = drawX - u.width * 0.5;
            const top = WORLD_CONFIG.GROUND_Y - u.height + bobY;

            // Body
            ctx.fillStyle = u.hitFlashTimer > 0 ? "#ffffff" : u.color;
            ctx.fillRect(left, top, u.width, u.height);

            // Distinctive silhouette accents per unit
            ctx.fillStyle = u.accentColor;
            if (u.key === "SPANDUK") {
                ctx.fillRect(left + 4, top + 6, u.width - 8, 20);
            } else if (u.key === "DALMAS") {
                ctx.fillRect(left - 5, top + 10, 8, u.height - 14);
            } else if (u.key === "ORATOR") {
                const wave = 8 + (u.animTime * 28) % 24;
                ctx.strokeStyle = "#fbbf24";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(drawX + 18, top + 16, wave, -0.6, 0.6);
                ctx.stroke();
            } else if (u.key === "BARRACUDA" || u.key === "WATER_CANNON") {
                ctx.fillStyle = "#0f172a";
                ctx.beginPath();
                ctx.arc(left + 22, WORLD_CONFIG.GROUND_Y - 2, 11, 0, Math.PI * 2);
                ctx.arc(left + u.width - 22, WORLD_CONFIG.GROUND_Y - 2, 11, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Headband / helmet stripe
                ctx.fillRect(left + 2, top + 4, u.width - 4, 7);
            }

            // Slow tint indicator
            if (u.slowTimer > 0) {
                ctx.strokeStyle = "#38bdf8";
                ctx.lineWidth = 2;
                ctx.strokeRect(left - 1, top - 1, u.width + 2, u.height + 2);
            }

            // Unit label + mini HP bar
            ctx.fillStyle = "#f8fafc";
            ctx.font = "bold 10px Segoe UI";
            ctx.textAlign = "center";
            ctx.fillText(u.shortLabel, drawX, top - 10);

            if (u.key !== "ORATOR") {
                const barW = Math.max(30, u.width);
                const hpRatio = Math.max(0, u.hp / u.maxHp);
                ctx.fillStyle = "#0f172a";
                ctx.fillRect(drawX - barW * 0.5, top - 7, barW, 5);
                ctx.fillStyle = u.faction === FACTIONS.PLAYER ? "#4ade80" : "#f87171";
                ctx.fillRect(drawX - barW * 0.5, top - 7, barW * hpRatio, 5);
            }
        }
    }

    _drawProjectiles(ctx, projectiles) {
        for (let i = 0; i < projectiles.length; i++) {
            const p = projectiles[i];
            if (!this._camera.isVisible(p.x, p.radius * 2)) continue;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    _drawParticles(ctx, particles) {
        for (let i = 0; i < particles.length; i++) {
            const pt = particles[i];
            if (!this._camera.isVisible(pt.x, pt.radius * 2)) continue;
            const alpha = Math.max(0, pt.life / pt.maxLife);
            ctx.save();
            ctx.globalAlpha = pt.isCloud ? alpha * 0.42 : alpha;
            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.radius * (pt.isCloud ? 1.0 : (1.3 - alpha * 0.5)), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    _drawOffscreenIndicator(ctx, combatSystem, viewportW) {
        let offRight = false;
        let offLeft = false;

        for (let i = 0; i < combatSystem.enemyUnits.length; i++) {
            const e = combatSystem.enemyUnits[i];
            if (e.x > this._camera.x + viewportW) offRight = true;
            if (e.x < this._camera.x) offLeft = true;
        }

        ctx.font = "bold 11px Segoe UI";
        if (offRight) {
            ctx.fillStyle = "rgba(239, 68, 68, 0.85)";
            ctx.fillRect(viewportW - 118, 12, 108, 22);
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "center";
            ctx.fillText("Polisi di Kanan ->", viewportW - 64, 27);
        }
        if (offLeft) {
            ctx.fillStyle = "rgba(239, 68, 68, 0.85)";
            ctx.fillRect(10, 12, 108, 22);
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "center";
            ctx.fillText("<- Polisi di Kiri", 64, 27);
        }
    }
}
