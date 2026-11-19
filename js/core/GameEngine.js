"use strict";

/**
 * Main game orchestrator coordinating the RAF loop, stage progression,
 * win/lose checks, and injected subsystems (DIP).
 */
class GameEngine {
    constructor({
        canvas,
        eventBus,
        storageService,
        inputHandler,
        camera,
        unitFactory,
        resourceManager,
        spawnerAI,
        combatSystem,
        renderer,
        uiManager
    }) {
        this._canvas = canvas;
        this._eventBus = eventBus;
        this._storage = storageService;
        this._input = inputHandler;
        this._camera = camera;
        this._unitFactory = unitFactory;
        this._resources = resourceManager;
        this._spawnerAI = spawnerAI;
        this._combat = combatSystem;
        this._renderer = renderer;
        this._ui = uiManager;

        this._state = "MENU"; // MENU | PLAYING | ENDED
        this._currentStageIndex = 0;
        this._timeRemaining = 40;
        this._sessionScore = 0;
        this._lastTimestamp = 0;

        this._bindEvents();
    }

    _bindEvents() {
        this._eventBus.on("START_GAME", () => {
            this._sessionScore = 0;
            this._startStage(0);
        });
        this._eventBus.on("RETRY_STAGE", () => {
            this._startStage(this._currentStageIndex);
        });
        this._eventBus.on("NEXT_STAGE", () => {
            if (this._currentStageIndex + 1 < STAGE_CONFIGS.length) {
                this._startStage(this._currentStageIndex + 1);
            }
        });
        this._eventBus.on("RETURN_MENU", () => {
            this._state = "MENU";
            this._input.resetAll();
            this._ui.showStartScreen(this._storage.getHighScore());
        });
        this._eventBus.on("SPAWN_REQUEST", (unitKey) => {
            if (this._state !== "PLAYING") return;
            this._trySpawnPlayerUnit(unitKey);
        });
        this._eventBus.on("ENEMY_KILLED", ({ score }) => {
            if (this._state === "PLAYING") {
                this._sessionScore += score;
            }
        });

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                this._input.resetAll();
            }
        });
    }

    init() {
        this._state = "MENU";
        this._ui.showStartScreen(this._storage.getHighScore());
        this._renderer.render(this._combat);
        requestAnimationFrame((ts) => this._loop(ts));
    }

    _startStage(stageIndex) {
        this._currentStageIndex = stageIndex;
        const cfg = STAGE_CONFIGS[stageIndex];

        this._timeRemaining = cfg.duration;
        this._camera.reset();
        this._input.resetAll();
        this._resources.resetForStage(cfg.initialMoral, cfg.moralRegenRate);

        const playerBase = new BaseStructure(WORLD_CONFIG.PLAYER_BASE_X, cfg.playerBaseHp, FACTIONS.PLAYER, "PANGGUNG UTAMA");
        const enemyBase = new BaseStructure(WORLD_CONFIG.ENEMY_BASE_X, cfg.enemyBaseHp, FACTIONS.ENEMY, "MARKAS POLISI");
        this._combat.reset(playerBase, enemyBase);
        this._spawnerAI.resetForStage(cfg);

        this._state = "PLAYING";
        this._ui.showGameplayHud();
    }

    _trySpawnPlayerUnit(unitKey) {
        if (!this._combat.canSpawnPlayerUnit(unitKey)) return;
        if (!this._resources.spendForUnit(unitKey)) return;

        const spawnX = unitKey === "ORATOR"
            ? WORLD_CONFIG.PLAYER_BASE_X - 18
            : WORLD_CONFIG.PLAYER_BASE_X + 64;

        const unit = this._unitFactory.createUnit(unitKey, spawnX);
        this._combat.addUnit(unit);
    }

    _spawnEnemyUnit(unitKey, offset = 0) {
        const spawnX = WORLD_CONFIG.ENEMY_BASE_X - 64 - offset;
        const unit = this._unitFactory.createUnit(unitKey, spawnX);
        this._combat.addUnit(unit);
    }

    _loop(timestamp) {
        if (this._lastTimestamp === 0) {
            this._lastTimestamp = timestamp;
        }
        const dtRaw = Math.min((timestamp - this._lastTimestamp) / 1000, 0.1);
        this._lastTimestamp = timestamp;

        if (this._state === "PLAYING") {
            const timeScale = this._input.getTimeScale();
            const dtEff = dtRaw * timeScale;
            this._updatePlaying(dtEff, dtRaw, timeScale);
        }

        this._renderer.render(this._combat);
        requestAnimationFrame((ts) => this._loop(ts));
    }

    _updatePlaying(dtEff, dtRaw, timeScale) {
        this._camera.update(dtRaw, this._input.getCameraDirection());
        this._resources.update(dtEff);
        this._timeRemaining = Math.max(0, this._timeRemaining - dtEff);

        this._spawnerAI.update(dtEff, this._combat.enemyBase, (unitKey, offset) => {
            this._spawnEnemyUnit(unitKey, offset);
        });

        this._combat.update(dtEff);

        const stageCfg = STAGE_CONFIGS[this._currentStageIndex];
        this._ui.updateHud({
            moral: this._resources.moral,
            stageNum: stageCfg.stageNumber,
            totalStages: STAGE_CONFIGS.length,
            timeRemaining: this._timeRemaining,
            score: this._sessionScore,
            timeScale,
            resourceManager: this._resources,
            combatSystem: this._combat
        });

        this._evaluateEndConditions(stageCfg);
    }

    _evaluateEndConditions(stageCfg) {
        if (!this._combat.enemyBase.isAlive()) {
            const timeBonus = Math.floor(this._timeRemaining) * WORLD_CONFIG.TIME_BONUS_PER_SECOND;
            this._sessionScore += stageCfg.baseDestroyScore + timeBonus;
            this._finishStage(true, "Markas Polisi berhasil diruntuhkan!");
        } else if (!this._combat.playerBase.isAlive()) {
            this._finishStage(false, "Panggung Utama dihancurkan aparat!");
        } else if (this._timeRemaining <= 0) {
            this._finishStage(false, "Waktu habis sebelum Markas Polisi roboh!");
        }
    }

    _finishStage(isVictory, reason) {
        this._state = "ENDED";
        this._input.resetAll();
        const highScore = this._storage.saveHighScore(this._sessionScore);
        this._ui.showEndScreen({
            isVictory,
            reason,
            score: this._sessionScore,
            highScore,
            timeRemaining: this._timeRemaining,
            hasNextStage: this._currentStageIndex + 1 < STAGE_CONFIGS.length
        });
    }
}
