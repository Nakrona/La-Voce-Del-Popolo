"use strict";

/**
 * Finds the best matching Entity (Unit or BaseStructure) under a given world coordinate (SRP).
 * Prioritizes combat units closest to the cursor before falling back to BaseStructure.
 */
class EntityHitTester {
    findEntityAt(worldX, worldY, combatSystem) {
        if (!combatSystem) return null;

        let bestUnit = null;
        let bestDist = Infinity;

        const searchList = (list) => {
            for (let i = 0; i < list.length; i++) {
                const entity = list[i];
                if (entity.containsPoint(worldX, worldY)) {
                    const dx = Math.abs(entity.x - worldX);
                    if (dx < bestDist) {
                        bestDist = dx;
                        bestUnit = entity;
                    }
                }
            }
        };

        searchList(combatSystem.enemyUnits);
        searchList(combatSystem.playerUnits);
        if (bestUnit) return bestUnit;

        if (combatSystem.playerBase && combatSystem.playerBase.containsPoint(worldX, worldY, 4)) {
            return combatSystem.playerBase;
        }
        if (combatSystem.enemyBase && combatSystem.enemyBase.containsPoint(worldX, worldY, 4)) {
            return combatSystem.enemyBase;
        }
        return null;
    }
}

/**
 * Converts Shop unit & skill configs into the same standardized TooltipData DTO
 * produced by Entity.toTooltipData() so one presenter renders everything (DRY).
 */
class TooltipDataBuilder {
    buildShopUnitData(unitKey, resourceManager, combatSystem) {
        const cfg = UNIT_CONFIGS[unitKey];
        if (!cfg) return null;

        let statusText = "SIAP BELI";
        if (combatSystem && !combatSystem.canSpawnPlayerUnit(unitKey)) {
            statusText = unitKey === "ORATOR" ? `MAKS ${cfg.maxStacks} AKTIF` : "POPULASI PENUH";
        } else if (resourceManager) {
            const cd = resourceManager._cooldowns.get(unitKey) || 0;
            if (cd > 0) {
                statusText = `CD ${cd.toFixed(1)}s`;
            } else if (resourceManager.moral < cfg.cost) {
                statusText = `BUTUH ${cfg.cost} MORAL`;
            }
        }

        const isOrator = cfg.key === "ORATOR";
        const stats = isOrator
            ? [
                { label: "Biaya Moral", value: `${cfg.cost}` },
                { label: "Cooldown", value: `${cfg.cooldown}s` },
                { label: "Durasi Orasi", value: `${cfg.duration}s (Maks ${cfg.maxStacks})` },
                { label: "Buff Global", value: `+${Math.round((cfg.atkSpeedMultiplier - 1) * 100)}% AtkSpd, +${Math.round((cfg.moveSpeedMultiplier - 1) * 100)}% Speed` }
            ]
            : [
                { label: "Biaya Moral", value: `${cfg.cost}` },
                { label: "HP / Damage", value: `${cfg.maxHp} HP / ${cfg.damage} DMG` },
                { label: "Interval Serang", value: `${cfg.attackInterval}s` },
                { label: "Jarak / Speed", value: `${cfg.range} px / ${cfg.speed} px/s` },
                { label: "Cooldown Spawn", value: `${cfg.cooldown}s` }
            ];

        return {
            title: cfg.name,
            subtitle: cfg.roleLabel || "Shop Prajurit",
            factionKind: "shop",
            badgeText: statusText,
            hpCurrent: null,
            hpMax: null,
            stats,
            note: cfg.description
        };
    }

    buildSkillData(skillKey, skillState) {
        const cfg = SKILL_CONFIGS[skillKey];
        if (!cfg) return null;

        let statusText = "SIAP [SPACE]";
        if (skillState) {
            if (skillState.isActive) statusText = "SEDANG AKTIF";
            else if (!skillState.isReady) statusText = `CD ${Math.ceil(skillState.remainingCooldown)}s`;
        }

        const petasan = cfg.variants[0];
        const botol = cfg.variants[1];
        return {
            title: cfg.name,
            subtitle: "Skill Aktif [Space] (Gratis Moral)",
            factionKind: "skill",
            badgeText: statusText,
            hpCurrent: null,
            hpMax: null,
            stats: [
                { label: "Durasi Hujan", value: `${cfg.duration}s (Tiap ${cfg.spawnInterval}s)` },
                { label: "Petasan (AoE)", value: `${petasan.damage} DMG (Radius ${petasan.aoeRadius} px)` },
                { label: "Botol (Slow)", value: `${botol.damage} DMG + Slow -25% (${botol.slowDuration}s)` },
                { label: "Cooldown", value: `${cfg.cooldown}s` }
            ],
            note: cfg.description
        };
    }
}

/**
 * Single shared DOM presenter for rendering and positioning any TooltipData DTO (DRY & SRP).
 */
class TooltipPresenter {
    constructor(tooltipEl) {
        this._el = tooltipEl;
        this._titleEl = tooltipEl.querySelector(".tt-title");
        this._subEl = tooltipEl.querySelector(".tt-subtitle");
        this._badgeEl = tooltipEl.querySelector(".tt-badge");
        this._hpRowEl = tooltipEl.querySelector(".tt-hp-wrap");
        this._hpFillEl = tooltipEl.querySelector(".tt-hp-fill");
        this._hpTextEl = tooltipEl.querySelector(".tt-hp-text");
        this._statsEl = tooltipEl.querySelector(".tt-stats");
        this._noteEl = tooltipEl.querySelector(".tt-note");
    }

    hide() {
        this._el.classList.add("hidden");
    }

    render(data, clientX, clientY) {
        if (!data) {
            this.hide();
            return;
        }

        this._el.className = `game-tooltip kind-${data.factionKind}`;
        this._titleEl.textContent = data.title;
        this._subEl.textContent = data.subtitle;
        this._badgeEl.textContent = data.badgeText;

        if (data.hpCurrent !== null && data.hpMax > 0) {
            const ratio = Math.max(0, Math.min(1, data.hpCurrent / data.hpMax));
            const unitSuffix = data.hpUnitLabel ? ` ${data.hpUnitLabel}` : " HP";
            this._hpRowEl.classList.remove("hidden");
            this._hpFillEl.style.width = `${ratio * 100}%`;
            this._hpTextEl.textContent = `${data.hpCurrent} / ${data.hpMax}${unitSuffix}`;
        } else {
            this._hpRowEl.classList.add("hidden");
        }

        this._statsEl.innerHTML = "";
        for (let i = 0; i < data.stats.length; i++) {
            const row = document.createElement("div");
            row.className = "tt-stat-row";
            const lbl = document.createElement("span");
            lbl.textContent = data.stats[i].label;
            const val = document.createElement("strong");
            val.textContent = data.stats[i].value;
            row.appendChild(lbl);
            row.appendChild(val);
            this._statsEl.appendChild(row);
        }

        this._noteEl.textContent = data.note || "";
        this._noteEl.classList.toggle("hidden", !data.note);

        this._positionWithinViewport(clientX, clientY);
    }

    _positionWithinViewport(clientX, clientY) {
        const margin = 12;
        const offsetX = 14;
        const offsetY = 16;

        const rect = this._el.getBoundingClientRect();
        const ttW = rect.width || 240;
        const ttH = rect.height || 160;
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        let left = clientX + offsetX;
        let top = clientY + offsetY;

        if (left + ttW + margin > winW) {
            left = clientX - ttW - offsetX;
        }
        if (left < margin) left = margin;

        if (top + ttH + margin > winH) {
            top = clientY - ttH - offsetY;
        }
        if (top < margin) top = margin;

        this._el.style.left = `${Math.round(left)}px`;
        this._el.style.top = `${Math.round(top)}px`;
    }
}

/**
 * Tooltip FSM States: HIDDEN, HOVER_SHOP, HOVER_ENTITY.
 */
class TooltipHiddenState extends IState {
    get name() { return "HIDDEN"; }

    onEnter(ctx) {
        ctx.hoveredEntity = null;
        ctx.shopHover = null;
        ctx.presenter.hide();
    }
}

class TooltipShopHoverState extends IState {
    get name() { return "HOVER_SHOP"; }

    onEnter(ctx, payload) {
        ctx.hoveredEntity = null;
        ctx.shopHover = payload;
        this.onUpdate(0, ctx);
    }

    onUpdate(_dt, ctx) {
        if (!ctx.shopHover) {
            ctx.fsm.changeState("HIDDEN");
            return;
        }
        const data = ctx.shopHover.type === "UNIT"
            ? ctx.dataBuilder.buildShopUnitData(ctx.shopHover.key, ctx.resourceManager, ctx.combatSystem)
            : ctx.dataBuilder.buildSkillData(ctx.shopHover.key, ctx.skillManager.getUiState());
        ctx.presenter.render(data, ctx.clientX, ctx.clientY);
    }
}

class TooltipEntityHoverState extends IState {
    get name() { return "HOVER_ENTITY"; }

    onEnter(ctx, payload) {
        ctx.shopHover = null;
        ctx.hoveredEntity = payload ? payload.entity : null;
        this.onUpdate(0, ctx);
    }

    onUpdate(_dt, ctx) {
        const entity = ctx.resolveEntityUnderPointer();
        if (!entity) {
            ctx.hoveredEntity = null;
            ctx.fsm.changeState("HIDDEN");
            return;
        }
        ctx.hoveredEntity = entity;
        ctx.presenter.render(entity.toTooltipData(), ctx.clientX, ctx.clientY);
    }

    onExit(ctx) {
        ctx.hoveredEntity = null;
    }
}

/**
 * Coordinates pointer hover tracking across Shop buttons and Canvas battlefield entities
 * using FiniteStateMachine (SRP, DRY, SOLID).
 */
class TooltipController {
    constructor({ canvas, camera, combatSystem, resourceManager, skillManager, tooltipEl }) {
        this._canvas = canvas;
        this._camera = camera;
        this.combatSystem = combatSystem;
        this.resourceManager = resourceManager;
        this.skillManager = skillManager;

        this._hitTester = new EntityHitTester();
        this.dataBuilder = new TooltipDataBuilder();
        this.presenter = new TooltipPresenter(tooltipEl);

        this._isPointerOverCanvas = false;
        this.clientX = 0;
        this.clientY = 0;
        this.hoveredEntity = null;
        this.shopHover = null;

        const states = [
            new TooltipHiddenState(),
            new TooltipShopHoverState(),
            new TooltipEntityHoverState()
        ];
        this.fsm = new FiniteStateMachine(states, this, "HIDDEN");
        this._bindPointerEvents();
    }

    _bindPointerEvents() {
        this._canvas.addEventListener("mousemove", (e) => {
            this._isPointerOverCanvas = true;
            this.clientX = e.clientX;
            this.clientY = e.clientY;
            const entity = this.resolveEntityUnderPointer();
            if (entity) {
                this.fsm.changeState("HOVER_ENTITY", { entity });
            } else if (this.fsm.isIn("HOVER_ENTITY")) {
                this.fsm.changeState("HIDDEN");
            }
        });

        this._canvas.addEventListener("mouseleave", () => {
            this._isPointerOverCanvas = false;
            if (this.fsm.isIn("HOVER_ENTITY")) {
                this.fsm.changeState("HIDDEN");
            }
        });

        const unitBtns = document.querySelectorAll(".unit-btn");
        for (const btn of unitBtns) {
            btn.addEventListener("mouseenter", (e) => {
                this.clientX = e.clientX;
                this.clientY = e.clientY;
                this.fsm.changeState("HOVER_SHOP", { type: "UNIT", key: btn.dataset.unit });
            });
            btn.addEventListener("mousemove", (e) => {
                this.clientX = e.clientX;
                this.clientY = e.clientY;
            });
            btn.addEventListener("mouseleave", () => {
                if (this.fsm.isIn("HOVER_SHOP")) this.fsm.changeState("HIDDEN");
            });
        }

        const skillBtn = document.getElementById("btn-special-skill");
        if (skillBtn) {
            skillBtn.addEventListener("mouseenter", (e) => {
                this.clientX = e.clientX;
                this.clientY = e.clientY;
                this.fsm.changeState("HOVER_SHOP", { type: "SKILL", key: SKILL_CONFIGS.PETASAN_BOTOL_RAIN.key });
            });
            skillBtn.addEventListener("mousemove", (e) => {
                this.clientX = e.clientX;
                this.clientY = e.clientY;
            });
            skillBtn.addEventListener("mouseleave", () => {
                if (this.fsm.isIn("HOVER_SHOP")) this.fsm.changeState("HIDDEN");
            });
        }
    }

    resolveEntityUnderPointer() {
        if (!this._isPointerOverCanvas) return null;
        const rect = this._canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;

        const scaleX = this._canvas.width / rect.width;
        const scaleY = this._canvas.height / rect.height;
        const canvasX = (this.clientX - rect.left) * scaleX;
        const canvasY = (this.clientY - rect.top) * scaleY;
        const worldX = canvasX + this._camera.x;

        return this._hitTester.findEntityAt(worldX, canvasY, this.combatSystem);
    }

    getHoveredEntity() {
        return this.hoveredEntity;
    }

    hide() {
        this._isPointerOverCanvas = false;
        this.fsm.changeState("HIDDEN");
    }

    update(dtRaw) {
        this.fsm.update(dtRaw);
    }
}
