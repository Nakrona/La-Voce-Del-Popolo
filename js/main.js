"use strict";

/**
 * Composition root wiring dependencies into GameEngine on DOMContentLoaded (DIP).
 */
document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("game-canvas");
    const eventBus = new EventBus();
    const storageService = new LocalStorageService(WORLD_CONFIG.HIGH_SCORE_STORAGE_KEY);
    const inputHandler = new InputHandler(eventBus);
    const camera = new Camera(WORLD_CONFIG.WORLD_WIDTH, WORLD_CONFIG.VIEWPORT_WIDTH, WORLD_CONFIG.CAMERA_SPEED);
    const unitFactory = new UnitFactory(UNIT_CONFIGS);
    const resourceManager = new ResourceManager(UNIT_CONFIGS, WORLD_CONFIG.MAX_MORAL);
    const spawnerAI = new EnemySpawnerAI();
    const combatSystem = new CombatSystem(eventBus);
    const renderer = new Renderer(canvas, camera);
    const uiManager = new UIManager(eventBus, inputHandler);

    const engine = new GameEngine({
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
    });

    engine.init();
});
