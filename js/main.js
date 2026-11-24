"use strict";

/**
 * Composition root wiring dependencies into GameEngine on DOMContentLoaded (DIP).
 */
document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("game-canvas");
    const eventBus = new EventBus();
    const storageService = new LocalStorageService();
    const inputHandler = new InputHandler(eventBus);
    const camera = new Camera(WORLD_CONFIG.WORLD_WIDTH, WORLD_CONFIG.VIEWPORT_WIDTH, WORLD_CONFIG.CAMERA_SPEED);
    const unitFactory = new UnitFactory(UNIT_CONFIGS);
    const resourceManager = new ResourceManager(UNIT_CONFIGS, WORLD_CONFIG.MAX_MORAL);
    const activeSkill = new FireworkBottleRainSkill(SKILL_CONFIGS.PETASAN_BOTOL_RAIN);
    const skillManager = new SkillManager(activeSkill);
    const audioService = new HtmlAudioService(AUDIO_BASE_FOLDER, SOUND_MANIFEST, storageService.getAudioSettings());
    new AudioCoordinator(eventBus, audioService);

    const assetService = new HtmlAssetService(IMAGE_BASE_FOLDER, IMAGE_MANIFEST);
    const domSpriteLayer = new DomSpriteLayer(
        document.getElementById("gif-overlay-layer"),
        document.getElementById("bg-city-gif"),
        document.getElementById("bg-road-gif")
    );

    const spawnerAI = new EnemySpawnerAI();
    const combatSystem = new CombatSystem(eventBus);
    const shopLoadoutManager = new ShopLoadoutManager(UNIT_CONFIGS, storageService, eventBus, SHOP_CONFIG);
    const renderer = new Renderer(canvas, camera, assetService, domSpriteLayer);
    const uiManager = new UIManager(eventBus, inputHandler, audioService, storageService, assetService);
    const tooltipController = new TooltipController({
        canvas,
        camera,
        combatSystem,
        resourceManager,
        skillManager,
        tooltipEl: document.getElementById("game-tooltip")
    });

    const engine = new GameEngine({
        canvas,
        eventBus,
        storageService,
        inputHandler,
        camera,
        unitFactory,
        resourceManager,
        skillManager,
        shopLoadoutManager,
        spawnerAI,
        combatSystem,
        renderer,
        uiManager,
        tooltipController
    });

    engine.init();
});
