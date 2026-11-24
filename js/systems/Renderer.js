"use strict";

/**
 * Pure presentation renderer combining Canvas 2D (.png/.webp/.jpg + procedural fallback)
 * with DomSpriteLayer for animated .gif assets (SRP & DRY).
 */
class Renderer {
    constructor(canvas, camera, assetService = null, domSpriteLayer = null) {
        this._canvas = canvas;
        this._ctx = canvas.getContext("2d");
        this._camera = camera;
        this._assets = assetService;
        this._domLayer = domSpriteLayer;
    }

    render(combatSystem, isSkillActive = false, hoveredEntity = null) {
        const ctx = this._ctx;
        const w = WORLD_CONFIG.VIEWPORT_WIDTH;
        const h = WORLD_CONFIG.VIEWPORT_HEIGHT;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, w, h);

        if (this._domLayer) {
            this._domLayer.beginFrame();
            this._domLayer.syncEnvironment(this._assets, this._camera.x, w);
        }

        ctx.save();
        if (combatSystem.screenShakeTimer > 0) {
            const shakeX = (Math.random() - 0.5) * 6;
            const shakeY = (Math.random() - 0.5) * 4;
            ctx.translate(shakeX, shakeY);
        }

        this._drawEnvironment(ctx, w, h, isSkillActive);

        ctx.save();
        ctx.translate(-Math.round(this._camera.x), 0);

        if (combatSystem.playerBase) {
            this._drawBase(ctx, combatSystem.playerBase, hoveredEntity === combatSystem.playerBase);
        }
        if (combatSystem.enemyBase) {
            this._drawBase(ctx, combatSystem.enemyBase, hoveredEntity === combatSystem.enemyBase);
        }

        this._drawUnits(ctx, combatSystem.playerUnits, hoveredEntity);
        this._drawUnits(ctx, combatSystem.enemyUnits, hoveredEntity);
        this._drawProjectiles(ctx, combatSystem.projectiles);
        this._drawSkyBombs(ctx, combatSystem.skyBombs);
        this._drawParticles(ctx, combatSystem.particles);
        if (hoveredEntity && hoveredEntity.isAlive()) {
            this._drawHoverHighlight(ctx, hoveredEntity);
        }

        ctx.restore();

        this._drawOffscreenIndicator(ctx, combatSystem, w);
        ctx.restore();

        if (this._domLayer) {
            this._domLayer.endFrame();
        }
    }

    /**
     * Unified DRY sprite pipeline:
     * 1) GIF asset -> DomSpriteLayer (animated)
     * 2) Static image asset -> Canvas drawImage
     * 3) Missing asset -> Procedural Canvas fallback
     */
    _drawSpriteOrFallback(ctx, { assetId, entity, x, y, width, height, rotationRad = 0, hitFlash = false, slowed = false, hovered = false, fallbackDraw }) {
        if (this._assets && assetId && this._assets.isReady(assetId)) {
            if (this._assets.isGif(assetId) && this._domLayer) {
                this._domLayer.syncEntity(entity, this._assets.getSourceUrl(assetId), {
                    x,
                    y,
                    width,
                    height,
                    cameraX: this._camera.x,
                    rotationRad,
                    hitFlash,
                    slowed,
                    hovered
                });
                return;
            }

            const img = this._assets.getImage(assetId);
            ctx.save();
            if (hitFlash) {
                ctx.filter = "brightness(2.3)";
            }
            if (rotationRad !== 0) {
                ctx.translate(x + width * 0.5, y + height * 0.5);
                ctx.rotate(rotationRad);
                ctx.drawImage(img, -width * 0.5, -height * 0.5, width, height);
            } else {
                ctx.drawImage(img, x, y, width, height);
            }
            ctx.restore();
            return;
        }

        fallbackDraw();
    }

    _drawEnvironment(ctx, w, h, isSkillActive = false) {
        const bgGif = this._assets && this._assets.isGif(ASSET_IDS.ENV_BG_CITY);
        const roadGif = this._assets && this._assets.isGif(ASSET_IDS.ENV_ROAD);

        if (!bgGif) {
            if (this._assets && this._assets.isReady(ASSET_IDS.ENV_BG_CITY)) {
                const bgImg = this._assets.getImage(ASSET_IDS.ENV_BG_CITY);
                const parallaxOffset = -((this._camera.x * 0.35) % w);
                ctx.drawImage(bgImg, parallaxOffset, 0, w, WORLD_CONFIG.GROUND_Y);
                ctx.drawImage(bgImg, parallaxOffset + w, 0, w, WORLD_CONFIG.GROUND_Y);
            } else {
                const grad = ctx.createLinearGradient(0, 0, 0, WORLD_CONFIG.GROUND_Y);
                grad.addColorStop(0, "#1e293b");
                grad.addColorStop(1, "#475569");
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, w, WORLD_CONFIG.GROUND_Y);

                const parallaxX = this._camera.x * 0.35;
                ctx.fillStyle = "#1e2430";
                for (let bx = -120; bx < WORLD_CONFIG.WORLD_WIDTH; bx += 110) {
                    const screenX = bx - (parallaxX % 220);
                    const bHeight = 120 + ((bx * 37) % 110);
                    ctx.fillRect(screenX, WORLD_CONFIG.GROUND_Y - bHeight, 88, bHeight);
                }
            }
        }

        if (isSkillActive) {
            ctx.fillStyle = "rgba(180, 55, 10, 0.32)";
            ctx.fillRect(0, 0, w, WORLD_CONFIG.GROUND_Y);
        }

        if (!roadGif) {
            const roadTop = WORLD_CONFIG.GROUND_Y - 10;
            const roadH = h - roadTop;
            if (this._assets && this._assets.isReady(ASSET_IDS.ENV_ROAD)) {
                const roadImg = this._assets.getImage(ASSET_IDS.ENV_ROAD);
                const tileOffset = -(this._camera.x % w);
                ctx.drawImage(roadImg, tileOffset, roadTop, w, roadH);
                ctx.drawImage(roadImg, tileOffset + w, roadTop, w, roadH);
            } else {
                ctx.fillStyle = "#64748b";
                ctx.fillRect(0, roadTop, w, 12);
                ctx.fillStyle = "#33373d";
                ctx.fillRect(0, WORLD_CONFIG.GROUND_Y, w, h - WORLD_CONFIG.GROUND_Y);
                ctx.fillStyle = "#cbd5e1";
                const stripeOffset = -(this._camera.x % 90);
                for (let sx = stripeOffset; sx < w; sx += 90) {
                    ctx.fillRect(sx, WORLD_CONFIG.GROUND_Y + 34, 46, 6);
                }
            }
        }
    }

    _drawBase(ctx, base, isHovered = false) {
        const left = base.getLeftEdge();
        const top = WORLD_CONFIG.GROUND_Y - base.height;
        const isPlayer = base.faction === FACTIONS.PLAYER;

        this._drawSpriteOrFallback(ctx, {
            assetId: base.getAssetId(),
            entity: base,
            x: left,
            y: top,
            width: base.width,
            height: base.height,
            hitFlash: base.hitFlashTimer > 0,
            hovered: isHovered,
            fallbackDraw: () => {
                ctx.fillStyle = base.hitFlashTimer > 0 ? "#ffffff" : (isPlayer ? "#7c2d12" : "#1e3a8a");
                ctx.fillRect(left, top, base.width, base.height);
                ctx.strokeStyle = isPlayer ? "#f59e0b" : "#93c5fd";
                ctx.lineWidth = 3;
                ctx.strokeRect(left, top, base.width, base.height);
            }
        });

        if (!this._camera.isVisible(base.x, base.width, 140)) return;

        // Label banner & HP bar above base
        ctx.fillStyle = isPlayer ? "#ea580c" : "#0f172a";
        ctx.fillRect(left - 6, top - 18, base.width + 12, 20);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px Segoe UI";
        ctx.textAlign = "center";
        ctx.fillText(base.label, base.x, top - 4);

        const barW = 124;
        const barH = 12;
        const barX = base.x - barW * 0.5;
        const barY = top - 36;
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

    _drawUnits(ctx, units, hoveredEntity) {
        for (let i = 0; i < units.length; i++) {
            const u = units[i];
            if (!u.isAlive()) continue;

            const bobY = u.state === "WALK" ? Math.abs(Math.sin(u.animTime * 10)) * -4 : 0;
            const attackPush = (u.state === "ATTACK" && u.attackCooldown > u.attackInterval * 0.7)
                ? u.direction * 5
                : 0;

            const drawX = u.x + attackPush;
            const left = drawX - u.width * 0.5;
            const top = WORLD_CONFIG.GROUND_Y - u.height + bobY;

            this._drawSpriteOrFallback(ctx, {
                assetId: u.getAssetId(),
                entity: u,
                x: left,
                y: top,
                width: u.width,
                height: u.height,
                hitFlash: u.hitFlashTimer > 0,
                slowed: u.slowTimer > 0,
                hovered: hoveredEntity === u,
                fallbackDraw: () => {
                    ctx.fillStyle = u.hitFlashTimer > 0 ? "#ffffff" : u.color;
                    ctx.fillRect(left, top, u.width, u.height);
                    ctx.fillStyle = u.accentColor;
                    ctx.fillRect(left + 2, top + 4, u.width - 4, 7);
                }
            });

            if (!this._camera.isVisible(u.x, u.width)) continue;

            if (u instanceof OratorUnit) {
                const wave = 8 + (u.animTime * 28) % 24;
                ctx.strokeStyle = u.accentColor || "#fbbf24";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(drawX + 18, top + 16, wave, -0.6, 0.6);
                ctx.stroke();
            }

            if (u.slowTimer > 0) {
                ctx.strokeStyle = "#38bdf8";
                ctx.lineWidth = 2;
                ctx.strokeRect(left - 1, top - 1, u.width + 2, u.height + 2);
            }

            ctx.fillStyle = "#f8fafc";
            ctx.font = "bold 10px Segoe UI";
            ctx.textAlign = "center";
            ctx.fillText(u.shortLabel, drawX, top - 10);

            if (!(u instanceof OratorUnit)) {
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
            const size = p.radius * 2 + 6;
            this._drawSpriteOrFallback(ctx, {
                assetId: p.getAssetId(),
                entity: p,
                x: p.x - size * 0.5,
                y: p.y - size * 0.5,
                width: size,
                height: size,
                fallbackDraw: () => {
                    if (!this._camera.isVisible(p.x, p.radius * 2)) return;
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }
    }

    _drawSkyBombs(ctx, skyBombs) {
        for (let i = 0; i < skyBombs.length; i++) {
            const b = skyBombs[i];
            const visible = this._camera.isVisible(b.x, 80, 120) || this._camera.isVisible(b.targetX, 80, 120);

            if (visible) {
                ctx.strokeStyle = b.variantType === "PETASAN"
                    ? "rgba(239, 68, 68, 0.45)"
                    : "rgba(56, 189, 248, 0.45)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.ellipse(b.targetX, b.groundY + 6, 16, 5, 0, 0, Math.PI * 2);
                ctx.stroke();

                ctx.strokeStyle = b.accentColor;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(b.x, b.y);
                ctx.lineTo(b.x - b.vx * 0.045, b.y - b.vy * 0.045);
                ctx.stroke();
            }

            const w = b.variantType === "PETASAN" ? 20 : 18;
            const h = b.variantType === "PETASAN" ? 26 : 24;
            this._drawSpriteOrFallback(ctx, {
                assetId: b.getAssetId(),
                entity: b,
                x: b.x - w * 0.5,
                y: b.y - h * 0.5,
                width: w,
                height: h,
                rotationRad: b.rotation,
                fallbackDraw: () => {
                    if (!visible) return;
                    ctx.save();
                    ctx.translate(b.x, b.y);
                    ctx.rotate(b.rotation);
                    ctx.fillStyle = b.color;
                    ctx.fillRect(-5, -10, 10, 20);
                    ctx.restore();
                }
            });
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

    _drawHoverHighlight(ctx, entity) {
        if (!this._camera.isVisible(entity.x, entity.width, 40)) return;
        const pad = 4;
        const left = entity.getLeftEdge() - pad;
        const top = WORLD_CONFIG.GROUND_Y - entity.height - pad;
        const w = entity.width + pad * 2;
        const h = entity.height + pad * 2;

        ctx.save();
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(left, top, w, h);
        ctx.restore();
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
