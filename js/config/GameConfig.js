"use strict";

/**
 * Immutable game constants, unit parameters, and stage wave configurations.
 * Follows Open/Closed Principle (OCP) by externalizing balancing data from logic.
 */
const FACTIONS = Object.freeze({
    PLAYER: "PLAYER",
    ENEMY: "ENEMY"
});

const WORLD_CONFIG = Object.freeze({
    VIEWPORT_WIDTH: 960,
    VIEWPORT_HEIGHT: 480,
    WORLD_WIDTH: 1360,
    GROUND_Y: 400,
    PLAYER_BASE_X: 95,
    ENEMY_BASE_X: 1265,
    CAMERA_SPEED: 480,
    MAX_MORAL: 150,
    MAX_UNITS_PER_FACTION: 35,
    TIME_BONUS_PER_SECOND: 25,
    HIGH_SCORE_STORAGE_KEY: "lvdp_high_score",
    UNLOCKED_STAGE_STORAGE_KEY: "lvdp_unlocked_stage",
    CLEARED_STAGES_STORAGE_KEY: "lvdp_cleared_stages",
    AUDIO_SETTINGS_STORAGE_KEY: "lvdp_audio_settings"
});

const UNIT_CONFIGS = Object.freeze({
    // Player Faction Units
    WIBU: {
        key: "WIBU",
        name: "Pendemo Wibu",
        shortLabel: "Wibu",
        roleLabel: "Melee Dasar (Cepat & Murah)",
        description: "Serangan melee sangat cepat dan murah. Kuat menahan Dalmas awal, tetapi rentan AoE Gas Air Mata.",
        faction: FACTIONS.PLAYER,
        behavior: "MELEE",
        cost: 10,
        cooldown: 1.1,
        maxHp: 75,
        damage: 16,
        attackInterval: 0.65,
        range: 28,
        speed: 130,
        width: 34,
        height: 54,
        color: "#9333ea",
        accentColor: "#f472b6",
        scoreReward: 0
    },
    SPANDUK: {
        key: "SPANDUK",
        name: "Pendemo Spanduk",
        shortLabel: "Spanduk",
        roleLabel: "Tank Garis Depan",
        description: "HP sangat tebal & tahan 75% knockback Water Cannon. Melindungi barisan Mahasiswa di belakang.",
        faction: FACTIONS.PLAYER,
        behavior: "MELEE",
        cost: 25,
        cooldown: 3.0,
        maxHp: 340,
        damage: 14,
        attackInterval: 1.25,
        range: 32,
        speed: 86,
        width: 52,
        height: 64,
        knockbackResistance: 0.75,
        color: "#ea580c",
        accentColor: "#fef08a",
        scoreReward: 0
    },
    MAHASISWA: {
        key: "MAHASISWA",
        name: "Pendemo Mahasiswa",
        shortLabel: "Mhs",
        roleLabel: "Ranged DPS (Kerikil)",
        description: "Melempar kerikil jarak jauh dari belakang Tank. Efektif menghancurkan Gas Air Mata & Barracuda.",
        faction: FACTIONS.PLAYER,
        behavior: "RANGED",
        cost: 20,
        cooldown: 2.0,
        maxHp: 95,
        damage: 34,
        attackInterval: 1.0,
        range: 220,
        speed: 105,
        width: 36,
        height: 58,
        projectileSpeed: 420,
        projectileColor: "#e2e8f0",
        aoeRadius: 0,
        color: "#2563eb",
        accentColor: "#fde047",
        scoreReward: 0
    },
    ORATOR: {
        key: "ORATOR",
        name: "Orator Panggung",
        shortLabel: "Orator",
        roleLabel: "Support Panggung (Global Buff)",
        description: "Berorasi di Panggung Utama selama 16s: memberi +35% Atk Speed & +25% Move Speed (maks 2 stack).",
        faction: FACTIONS.PLAYER,
        behavior: "ORATOR",
        cost: 35,
        cooldown: 7.0,
        duration: 16.0,
        maxStacks: 2,
        atkSpeedMultiplier: 1.35,
        moveSpeedMultiplier: 1.25,
        maxHp: 9999,
        damage: 0,
        attackInterval: 1.0,
        range: 0,
        speed: 0,
        width: 38,
        height: 62,
        color: "#dc2626",
        accentColor: "#fbbf24",
        scoreReward: 0
    },

    // Enemy Faction Units
    DALMAS: {
        key: "DALMAS",
        name: "Polisi Dalmas",
        shortLabel: "Dalmas",
        roleLabel: "Melee Tameng Kokoh",
        description: "Unit garis depan kepolisian penahan dorongan massa.",
        faction: FACTIONS.ENEMY,
        behavior: "MELEE",
        maxHp: 160,
        damage: 14,
        attackInterval: 1.0,
        range: 30,
        speed: 75,
        width: 40,
        height: 62,
        color: "#1e3a8a",
        accentColor: "#94a3b8",
        scoreReward: 100
    },
    GAS_AIR_MATA: {
        key: "GAS_AIR_MATA",
        name: "Polisi Gas Air Mata",
        shortLabel: "Gas",
        roleLabel: "Ranged Area (AoE)",
        description: "Menembak tabung gas air mata AoE (radius 95 px) yang melukai gerombolan pendemo sekaligus.",
        faction: FACTIONS.ENEMY,
        behavior: "RANGED",
        maxHp: 110,
        damage: 18,
        attackInterval: 2.2,
        range: 250,
        speed: 68,
        width: 38,
        height: 60,
        projectileSpeed: 310,
        projectileColor: "#cbd5e1",
        aoeRadius: 95,
        color: "#334155",
        accentColor: "#38bdf8",
        scoreReward: 180
    },
    WATER_CANNON: {
        key: "WATER_CANNON",
        name: "Polisi Water Cannon",
        shortLabel: "Water",
        roleLabel: "Support Penahan Laju",
        description: "Semburan air AoE jarak jauh yang memberi Slow -25% & Knockback ringan.",
        faction: FACTIONS.ENEMY,
        behavior: "WATER_CANNON",
        maxHp: 300,
        damage: 12,
        attackInterval: 2.0,
        range: 280,
        speed: 44,
        width: 92,
        height: 76,
        projectileSpeed: 460,
        projectileColor: "#38bdf8",
        aoeRadius: 75,
        slowFactor: 0.75,
        slowDuration: 1.2,
        knockbackDistance: 6,
        color: "#1e40af",
        accentColor: "#bae6fd",
        scoreReward: 300
    },
    BARRACUDA: {
        key: "BARRACUDA",
        name: "Mobil Barracuda",
        shortLabel: "BOSS",
        roleLabel: "Armored Tank / Boss",
        description: "Kendaraan lapis baja kebal knockback dengan 1.5x damage terhadap Panggung Utama.",
        faction: FACTIONS.ENEMY,
        behavior: "BOSS",
        maxHp: 520,
        damage: 32,
        attackInterval: 1.6,
        range: 45,
        speed: 42,
        width: 128,
        height: 86,
        baseDamageMultiplier: 1.5,
        knockbackResistance: 1.0,
        color: "#1e293b",
        accentColor: "#ef4444",
        scoreReward: 1000
    }
});

const STAGE_CONFIGS = Object.freeze([
    {
        stageNumber: 1,
        title: "Stage 1: Jalan Protokol Awal",
        difficulty: "Mudah",
        duration: 40,
        initialMoral: 25,
        moralRegenRate: 6.0,
        playerBaseHp: 1000,
        enemyBaseHp: 550,
        baseDestroyScore: 500,
        scheduledEvents: [
            { time: 1.5, unit: "DALMAS", count: 1 }
        ],
        periodicSpawn: {
            startTime: 6.0,
            interval: 4.5,
            pattern: [["DALMAS"]]
        },
        emergencyWave: { hpThresholdRatio: 0.5, unit: "DALMAS", count: 2 }
    },
    {
        stageNumber: 2,
        title: "Stage 2: Kepungan Gas Air Mata",
        difficulty: "Sedang",
        duration: 40,
        initialMoral: 35,
        moralRegenRate: 8.5,
        playerBaseHp: 1000,
        enemyBaseHp: 650,
        baseDestroyScore: 750,
        scheduledEvents: [
            { time: 1.5, unit: "DALMAS", count: 1 },
            { time: 3.0, unit: "GAS_AIR_MATA", count: 1 },
            { time: 14.0, unit: "WATER_CANNON", count: 1 }
        ],
        periodicSpawn: {
            startTime: 9.0,
            interval: 3.8,
            pattern: [["DALMAS"], ["DALMAS", "GAS_AIR_MATA"]]
        },
        emergencyWave: { hpThresholdRatio: 0.45, unit: "DALMAS", count: 2 }
    },
    {
        stageNumber: 3,
        title: "Stage 3: Operasi Barracuda (Boss)",
        difficulty: "Sulit",
        duration: 35,
        initialMoral: 50,
        moralRegenRate: 12.0,
        playerBaseHp: 1000,
        enemyBaseHp: 750,
        baseDestroyScore: 1200,
        scheduledEvents: [
            { time: 1.0, unit: "DALMAS", count: 2 },
            { time: 4.5, unit: "BARRACUDA", count: 1 },
            { time: 12.0, unit: "WATER_CANNON", count: 1 }
        ],
        periodicSpawn: {
            startTime: 7.5,
            interval: 3.4,
            pattern: [["DALMAS", "GAS_AIR_MATA"], ["DALMAS"]]
        },
        emergencyWave: { hpThresholdRatio: 0.4, unit: "DALMAS", count: 2 }
    }
]);

const SKILL_CONFIGS = Object.freeze({
    PETASAN_BOTOL_RAIN: {
        key: "PETASAN_BOTOL_RAIN",
        name: "Hujan Petasan",
        description: "Menghujani barisan polisi dengan petasan dan botol dari langit.",
        cooldown: 16.0,
        initialCooldown: 0.0,
        duration: 3.6,
        spawnInterval: 0.24,
        variants: [
            {
                type: "PETASAN",
                damage: 28,
                aoeRadius: 72,
                fallSpeed: 700,
                driftX: 110,
                color: "#ef4444",
                accentColor: "#fde047",
                slowFactor: 1.0,
                slowDuration: 0
            },
            {
                type: "BOTOL",
                damage: 18,
                aoeRadius: 62,
                fallSpeed: 640,
                driftX: 90,
                color: "#38bdf8",
                accentColor: "#e0f2fe",
                slowFactor: 0.75,
                slowDuration: 1.0
            }
        ]
    }
});
