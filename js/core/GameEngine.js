"use strict";

/**
 * GameEngine FSM States: MENU, STAGE_SELECT, PLAYING, PAUSED, ENDED (SRP & OCP).
 */
class GameMenuState extends IState {
    get name() { return "MENU"; }

    onEnter(engine) {
        engine.onEnterMenu();
    }
}

class GameStageSelectState extends IState {
    get name() { return "STAGE_SELECT"; }

    onEnter(engine) {
        engine.onEnterStageSelect();
    }
}

class GamePlayingState extends IState {
    get name() { return "PLAYING"; }

    onEnter(engine, payload) {
        engine.onEnterPlaying(payload);
    }

    onUpdate(dtRaw, engine) {
        const timeScale = engine.getTimeScale();
        const dtEff = dtRaw * timeScale;
        engine.onUpdatePlaying(dtEff, dtRaw, timeScale);
    }
}

class GamePausedState extends IState {
    get name() { return "PAUSED"; }

    onEnter(engine) {
        engine.onEnterPaused();
    }

    onExit(engine) {
        engine.onExitPaused();
    }
}

class GameEndedState extends IState {
    get name() { return "ENDED"; }

    onEnter(engine, result) {
        engine.onEnterEnded(result);
    }
}

/**
 * Main game orchestrator coordinating the RAF loop, FSM lifecycle, stage progression,
 * pause handling, win/lose checks, and injected subsystems (DIP).
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
        skillManager,
        spawnerAI,
        combatSystem,
        renderer,
        uiManager,
        tooltipController = null
    }) {
        this._canvas = canvas;
        this._eventBus = eventBus;
        this._storage = storageService;
        this._input = inputHandler;
        this._camera = camera;
        this._unitFactory = unitFactory;
        this._resources = resourceManager;
        this._skillManager = skillManager;
        this._spawnerAI = spawnerAI;
        this._combat = combatSystem;
        this._renderer = renderer;
        this._ui = uiManager;
        this._tooltip = tooltipController;

        this._currentStageIndex = 0;
        this._timeRemaining = 40;
        this._sessionScore = 0;
        this._lastTimestamp = 0;

        this._fsm = new FiniteStateMachine([
            new GameMenuState(),
            new GameStageSelectState(),
            new GamePlayingState(),
            new GamePausedState(),
            new GameEndedState()
        ], this);

        this._bindEvents();
    }

    _bindEvents() {
        this._eventBus.on("OPEN_STAGE_SELECT", () => {
            this._fsm.changeState("STAGE_SELECT");
        });
        this._eventBus.on("START_STAGE", ({ stageIndex }) => {
            const unlocked = this._storage.getUnlockedStage(STAGE_CONFIGS.length);
            if (stageIndex < 0 || stageIndex >= STAGE_CONFIGS.length) return;
            if (STAGE_CONFIGS[stageIndex].stageNumber > unlocked) return;
            this._sessionScore = 0;
            this._fsm.changeState("PLAYING", { stageIndex });
        });
        this._eventBus.on("RESET_PROGRESS", () => {
            this._storage.resetStageProgress();
            if (this._fsm.isIn("STAGE_SELECT")) {
                this.onEnterStageSelect();
            }
        });
        this._eventBus.on("RETRY_STAGE", () => {
            this._fsm.changeState("PLAYING", { stageIndex: this._currentStageIndex });
        });
        this._eventBus.on("NEXT_STAGE", () => {
            if (this._currentStageIndex + 1 < STAGE_CONFIGS.length) {
                this._fsm.changeState("PLAYING", { stageIndex: this._currentStageIndex + 1 });
            }
        });
        this._eventBus.on("RETURN_MENU", () => {
            this._fsm.changeState("MENU");
        });
        this._eventBus.on("PAUSE_TOGGLE", () => {
            this._handlePauseToggle();
        });
        this._eventBus.on("RESUME_GAME", () => {
            if (this._fsm.isIn("PAUSED")) {
                this._fsm.changeState("PLAYING", { resume: true });
            }
        });
        this._eventBus.on("SPAWN_REQUEST", (unitKey) => {
            if (!this._fsm.isIn("PLAYING")) return;
            this._trySpawnPlayerUnit(unitKey);
        });
        this._eventBus.on("SKILL_REQUEST", () => {
            if (!this._fsm.isIn("PLAYING")) return;
            this._skillManager.activate(this._combat);
        });
        this._eventBus.on("ENEMY_KILLED", ({ score }) => {
            if (this._fsm.isIn("PLAYING")) {
                this._sessionScore += score;
            }
        });

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                this._input.resetAll();
                if (this._tooltip) this._tooltip.hide();
                if (this._fsm.isIn("PLAYING")) {
                    this._fsm.changeState("PAUSED");
                }
            }
        });
    }

    _handlePauseToggle() {
        if (this._fsm.isIn("PLAYING")) {
            this._fsm.changeState("PAUSED");
        } else if (this._fsm.isIn("PAUSED")) {
            if (this._ui.isAudioSettingsOpen && this._ui.isAudioSettingsOpen()) {
                this._ui.closeAudioSettings();
            } else {
                this._fsm.changeState("PLAYING", { resume: true });
            }
        } else if (this._ui.closeSubModalIfOpen && this._ui.closeSubModalIfOpen()) {
            // Closed HowTo / AudioSettings in menu cleanly via ESC
        } else if (this._fsm.isIn("STAGE_SELECT")) {
            this._fsm.changeState("MENU");
        }
    }

    init() {
        this._fsm.changeState("MENU");
        this._renderer.render(this._combat);
        requestAnimationFrame((ts) => this._loop(ts));
    }

    getTimeScale() {
        return this._input.getTimeScale();
    }

    onEnterMenu() {
        this._input.resetAll();
        if (this._tooltip) this._tooltip.hide();
        this._ui.showStartScreen(this._storage.getHighScore());
        this._eventBus.emit("MENU_OPENED");
    }

    onEnterStageSelect() {
        this._input.resetAll();
        if (this._tooltip) this._tooltip.hide();
        const unlockedStage = this._storage.getUnlockedStage(STAGE_CONFIGS.length);
        const clearedStages = this._storage.getClearedStages();
        this._ui.showStageSelectScreen(STAGE_CONFIGS, unlockedStage, clearedStages);
    }

    onEnterPlaying(payload) {
        if (payload && payload.resume) {
            this._input.resetAll();
            this._ui.showGameplayHud();
            return;
        }

        const stageIndex = payload && typeof payload.stageIndex === "number" ? payload.stageIndex : 0;
        this._currentStageIndex = stageIndex;
        const cfg = STAGE_CONFIGS[stageIndex];

        this._timeRemaining = cfg.duration;
        this._camera.reset();
        this._input.resetAll();
        if (this._tooltip) this._tooltip.hide();
        this._resources.resetForStage(cfg.initialMoral, cfg.moralRegenRate);
        this._skillManager.resetForStage();

        const playerBase = new BaseStructure(WORLD_CONFIG.PLAYER_BASE_X, cfg.playerBaseHp, FACTIONS.PLAYER, "PANGGUNG UTAMA");
        const enemyBase = new BaseStructure(WORLD_CONFIG.ENEMY_BASE_X, cfg.enemyBaseHp, FACTIONS.ENEMY, "MARKAS POLISI");
        this._combat.reset(playerBase, enemyBase);
        this._spawnerAI.resetForStage(cfg);

        this._ui.showGameplayHud();
    }

    onEnterPaused() {
        this._input.resetAll();
        if (this._tooltip) this._tooltip.hide();
        this._eventBus.emit("GAME_PAUSED", { paused: true });
        this._ui.showPauseScreen();
    }

    onExitPaused() {
        this._eventBus.emit("GAME_PAUSED", { paused: false });
    }

    onEnterEnded({ isVictory, reason }) {
        this._input.resetAll();
        if (this._tooltip) this._tooltip.hide();
        this._eventBus.emit("STAGE_ENDED", { isVictory });

        const stageCfg = STAGE_CONFIGS[this._currentStageIndex];
        if (isVictory) {
            this._storage.markStageCleared(stageCfg.stageNumber);
            this._storage.unlockStage(stageCfg.stageNumber + 1, STAGE_CONFIGS.length);
        }

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

    _trySpawnPlayerUnit(unitKey) {
        if (!this._combat.canSpawnPlayerUnit(unitKey)) return;
        if (!this._resources.spendForUnit(unitKey)) return;

        const spawnX = unitKey === "ORATOR"
            ? WORLD_CONFIG.PLAYER_BASE_X - 18
            : WORLD_CONFIG.PLAYER_BASE_X + 64;

        const unit = this._unitFactory.createUnit(unitKey, spawnX);
        this._combat.addUnit(unit);
        this._eventBus.emit("UNIT_SPAWNED", { key: unitKey, faction: FACTIONS.PLAYER });
    }

    _spawnEnemyUnit(unitKey, offset = 0) {
        const spawnX = WORLD_CONFIG.ENEMY_BASE_X - 64 - offset;
        const unit = this._unitFactory.createUnit(unitKey, spawnX);
        this._combat.addUnit(unit);
        this._eventBus.emit("UNIT_SPAWNED", { key: unitKey, faction: FACTIONS.ENEMY });
    }

    _loop(timestamp) {
        if (this._lastTimestamp === 0) {
            this._lastTimestamp = timestamp;
        }
        const dtRaw = Math.min((timestamp - this._lastTimestamp) / 1000, 0.1);
        this._lastTimestamp = timestamp;

        this._fsm.update(dtRaw);

        if (this._tooltip && this._fsm.isIn("PLAYING")) {
            this._tooltip.update(dtRaw);
        }

        const skillState = this._skillManager.getUiState();
        const hoveredEntity = this._tooltip ? this._tooltip.getHoveredEntity() : null;
        this._renderer.render(this._combat, skillState.isActive, hoveredEntity);
        requestAnimationFrame((ts) => this._loop(ts));
    }

    onUpdatePlaying(dtEff, dtRaw, timeScale) {
        this._camera.update(dtRaw, this._input.getCameraDirection());
        this._resources.update(dtEff);
        this._skillManager.update(dtEff, this._combat);
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
            combatSystem: this._combat,
            skillState: this._skillManager.getUiState()
        });

        this._evaluateEndConditions(stageCfg);
    }

    _evaluateEndConditions(stageCfg) {
        if (!this._combat.enemyBase.isAlive()) {
            const timeBonus = Math.floor(this._timeRemaining) * WORLD_CONFIG.TIME_BONUS_PER_SECOND;
            this._sessionScore += stageCfg.baseDestroyScore + timeBonus;
            this._fsm.changeState("ENDED", { isVictory: true, reason: "Markas Polisi berhasil diruntuhkan!" });
        } else if (!this._combat.playerBase.isAlive()) {
            this._fsm.changeState("ENDED", { isVictory: false, reason: "Panggung Utama dihancurkan aparat!" });
        } else if (this._timeRemaining <= 0) {
            this._fsm.changeState("ENDED", { isVictory: false, reason: "Waktu habis sebelum Markas Polisi roboh!" });
        }
    }
}
