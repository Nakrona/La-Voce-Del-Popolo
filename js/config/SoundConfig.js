"use strict";

/**
 * Centralized audio configuration and folder manifest.
 * Replace any file inside `assets/audio/` with the same filename (or update `file` here)
 * to swap BGM, ambient crowd audio, or sound effects without changing engine code (OCP).
 */
const AUDIO_BASE_FOLDER = "assets/audio/";

const SOUND_IDS = Object.freeze({
    BGM_MENU: "BGM_MENU",
    BGM_BATTLE: "BGM_BATTLE",
    BGM_BATTLE_2: "BGM_BATTLE_2",
    AMB_CROWD: "AMB_CROWD",
    SFX_UI_CLICK: "SFX_UI_CLICK",
    SFX_SPAWN: "SFX_SPAWN",
    SFX_ORATOR: "SFX_ORATOR",
    SFX_HIT_MELEE: "SFX_HIT_MELEE",
    SFX_THROW: "SFX_THROW",
    SFX_TEARGAS: "SFX_TEARGAS",
    SFX_WATER_CANNON: "SFX_WATER_CANNON",
    SFX_BARRACUDA: "SFX_BARRACUDA",
    SFX_PETASAN: "SFX_PETASAN",
    SFX_VICTORY: "SFX_VICTORY",
    SFX_GAMEOVER: "SFX_GAMEOVER",
    SFX_SHOP_BUY: "SFX_SHOP_BUY",
    SFX_SHOP_EQUIP: "SFX_SHOP_EQUIP",
    SFX_SHOP_UNEQUIP: "SFX_SHOP_UNEQUIP",
    SFX_SHOP_ERROR: "SFX_SHOP_ERROR",
    SFX_HEAL: "SFX_HEAL",
    SFX_BUFF_DRUM: "SFX_BUFF_DRUM",
    SFX_BUFF_RADIO: "SFX_BUFF_RADIO",
    SFX_SONIC: "SFX_SONIC"
});

const SOUND_MANIFEST = Object.freeze({
    [SOUND_IDS.BGM_MENU]: {
        id: SOUND_IDS.BGM_MENU,
        label: "BGM Menu Utama",
        category: "BGM",
        file: "bgm_menu.mp3",
        aliases: ["bgm_menu", "menu", "title"],
        volume: 0.35,
        loop: true,
        minIntervalMs: 0
    },
    [SOUND_IDS.BGM_BATTLE]: {
        id: SOUND_IDS.BGM_BATTLE,
        label: "BGM Pertempuran 1",
        category: "BGM",
        file: "bgm_battle.mp3",
        aliases: ["bgm_battle", "battle", "combat"],
        volume: 0.70,
        loop: false,
        minIntervalMs: 0
    },
    [SOUND_IDS.BGM_BATTLE_2]: {
        id: SOUND_IDS.BGM_BATTLE_2,
        label: "BGM Pertempuran 2",
        category: "BGM",
        file: "bgm_battle2.mp3",
        aliases: ["bgm_battle2", "battle2"],
        volume: 0.70,
        loop: false,
        minIntervalMs: 0
    },
    [SOUND_IDS.AMB_CROWD]: {
        id: SOUND_IDS.AMB_CROWD,
        label: "Ambient Sorakan Massa",
        category: "AMBIENT",
        file: "amb_crowd.ogg",
        aliases: ["amb_crowd", "crowd", "sorakan", "cheer"],
        volume: 0.25,
        loop: true,
        minIntervalMs: 0
    },
    [SOUND_IDS.SFX_UI_CLICK]: {
        id: SOUND_IDS.SFX_UI_CLICK,
        label: "SFX Klik Tombol UI",
        category: "SFX",
        file: "sfx_ui_click.wav",
        aliases: ["sfx_ui_click", "click", "ui"],
        volume: 0.45,
        loop: false,
        minIntervalMs: 40
    },
    [SOUND_IDS.SFX_SPAWN]: {
        id: SOUND_IDS.SFX_SPAWN,
        label: "SFX Spawn Unit Pendemo",
        category: "SFX",
        file: "sfx_spawn.ogg",
        aliases: ["sfx_spawn", "spawn", "whistle"],
        volume: 0.5,
        loop: false,
        minIntervalMs: 70
    },
    [SOUND_IDS.SFX_ORATOR]: {
        id: SOUND_IDS.SFX_ORATOR,
        label: "SFX Orasi Panggung",
        category: "SFX",
        file: "sfx_orator.ogg",
        aliases: ["sfx_orator", "orator", "megaphone"],
        volume: 0.55,
        loop: false,
        minIntervalMs: 300
    },
    [SOUND_IDS.SFX_HIT_MELEE]: {
        id: SOUND_IDS.SFX_HIT_MELEE,
        label: "SFX Benturan Tameng / Pukulan",
        category: "SFX",
        file: "sfx_hit_melee.ogg",
        aliases: ["sfx_hit_melee", "hit", "punch", "impact", "shield"],
        volume: 0.4,
        loop: false,
        minIntervalMs: 85
    },
    [SOUND_IDS.SFX_THROW]: {
        id: SOUND_IDS.SFX_THROW,
        label: "SFX Lemparan Kerikil",
        category: "SFX",
        file: "sfx_throw.wav",
        aliases: ["sfx_throw", "throw", "whoosh"],
        volume: 0.35,
        loop: false,
        minIntervalMs: 90
    },
    [SOUND_IDS.SFX_TEARGAS]: {
        id: SOUND_IDS.SFX_TEARGAS,
        label: "SFX Ledakan Gas Air Mata",
        category: "SFX",
        file: "sfx_teargas.ogg",
        aliases: ["sfx_teargas", "teargas", "gas", "hiss"],
        volume: 0.55,
        loop: false,
        minIntervalMs: 140
    },
    [SOUND_IDS.SFX_WATER_CANNON]: {
        id: SOUND_IDS.SFX_WATER_CANNON,
        label: "SFX Semburan Water Cannon",
        category: "SFX",
        file: "sfx_water_cannon.ogg",
        aliases: ["sfx_water_cannon", "water", "splash", "cannon"],
        volume: 0.5,
        loop: false,
        minIntervalMs: 150
    },
    [SOUND_IDS.SFX_BARRACUDA]: {
        id: SOUND_IDS.SFX_BARRACUDA,
        label: "SFX Sirine Boss Barracuda",
        category: "SFX",
        file: "sfx_barracuda.mp3",
        aliases: ["sfx_barracuda", "barracuda", "siren", "boss"],
        volume: 0.65,
        loop: false,
        minIntervalMs: 500
    },
    [SOUND_IDS.SFX_PETASAN]: {
        id: SOUND_IDS.SFX_PETASAN,
        label: "SFX Hujan Petasan & Botol",
        category: "SFX",
        file: "sfx_petasan.mp3",
        aliases: ["sfx_petasan", "petasan", "explosion", "firework"],
        volume: 0.55,
        loop: false,
        minIntervalMs: 95
    },
    [SOUND_IDS.SFX_VICTORY]: {
        id: SOUND_IDS.SFX_VICTORY,
        label: "Jingle Victory",
        category: "SFX",
        file: "sfx_victory.mp3",
        aliases: ["sfx_victory", "victory", "win"],
        volume: 0.6,
        loop: false,
        minIntervalMs: 200
    },
    [SOUND_IDS.SFX_GAMEOVER]: {
        id: SOUND_IDS.SFX_GAMEOVER,
        label: "Jingle Game Over",
        category: "SFX",
        file: "sfx_gameover.mp3",
        aliases: ["sfx_gameover", "gameover", "lose", "defeat"],
        volume: 0.6,
        loop: false,
        minIntervalMs: 200
    },
    [SOUND_IDS.SFX_SHOP_BUY]: {
        id: SOUND_IDS.SFX_SHOP_BUY,
        label: "SFX Beli Unit Shop",
        category: "SFX",
        file: "sfx_shop_buy.wav",
        aliases: ["sfx_shop_buy", "buy", "coin", "purchase"],
        volume: 0.6,
        loop: false,
        minIntervalMs: 80
    },
    [SOUND_IDS.SFX_SHOP_EQUIP]: {
        id: SOUND_IDS.SFX_SHOP_EQUIP,
        label: "SFX Pasang Unit ke Slot",
        category: "SFX",
        file: "sfx_shop_equip.wav",
        aliases: ["sfx_shop_equip", "equip"],
        volume: 0.55,
        loop: false,
        minIntervalMs: 60
    },
    [SOUND_IDS.SFX_SHOP_UNEQUIP]: {
        id: SOUND_IDS.SFX_SHOP_UNEQUIP,
        label: "SFX Lepas Unit dari Slot",
        category: "SFX",
        file: "sfx_shop_unequip.wav",
        aliases: ["sfx_shop_unequip", "unequip"],
        volume: 0.5,
        loop: false,
        minIntervalMs: 60
    },
    [SOUND_IDS.SFX_SHOP_ERROR]: {
        id: SOUND_IDS.SFX_SHOP_ERROR,
        label: "SFX Peringatan Shop / Slot Penuh",
        category: "SFX",
        file: "sfx_shop_error.wav",
        aliases: ["sfx_shop_error", "error", "buzz"],
        volume: 0.5,
        loop: false,
        minIntervalMs: 120
    },
    [SOUND_IDS.SFX_HEAL]: {
        id: SOUND_IDS.SFX_HEAL,
        label: "SFX Penyembuhan Tim Medis",
        category: "SFX",
        file: "sfx_heal.wav",
        aliases: ["sfx_heal", "heal", "medic"],
        volume: 0.5,
        loop: false,
        minIntervalMs: 220
    },
    [SOUND_IDS.SFX_BUFF_DRUM]: {
        id: SOUND_IDS.SFX_BUFF_DRUM,
        label: "SFX Genderang Dirigen Perkusi",
        category: "SFX",
        file: "sfx_buff_drum.wav",
        aliases: ["sfx_buff_drum", "drum", "percussion"],
        volume: 0.65,
        loop: false,
        minIntervalMs: 300
    },
    [SOUND_IDS.SFX_BUFF_RADIO]: {
        id: SOUND_IDS.SFX_BUFF_RADIO,
        label: "SFX Radio Komando Korlap",
        category: "SFX",
        file: "sfx_buff_radio.wav",
        aliases: ["sfx_buff_radio", "radio", "korlap"],
        volume: 0.55,
        loop: false,
        minIntervalMs: 300
    },
    [SOUND_IDS.SFX_SONIC]: {
        id: SOUND_IDS.SFX_SONIC,
        label: "SFX Gelombang Suara & Bom Cat",
        category: "SFX",
        file: "sfx_sonic.wav",
        aliases: ["sfx_sonic", "sonic", "bass", "mural"],
        volume: 0.5,
        loop: false,
        minIntervalMs: 140
    }
});

const BATTLE_BGM_PLAYLIST = Object.freeze([
    SOUND_IDS.BGM_BATTLE,
    SOUND_IDS.BGM_BATTLE_2
]);
