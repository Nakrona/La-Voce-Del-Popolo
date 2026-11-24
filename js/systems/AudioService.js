"use strict";

/**
 * Abstraction interface for game audio playback & independent volume controls (DIP & ISP).
 */
class IAudioService {
    unlock() { throw new Error("unlock() must be implemented."); }
    playSfx(soundId) { throw new Error("playSfx() must be implemented."); }
    playMusic(soundId) { throw new Error("playMusic() must be implemented."); }
    playBattlePlaylistNext() { throw new Error("playBattlePlaylistNext() must be implemented."); }
    stopMusic() { throw new Error("stopMusic() must be implemented."); }
    setBattleAmbiencePaused(paused) { throw new Error("setBattleAmbiencePaused() must be implemented."); }
    setCrowdIntensity(ratio) { throw new Error("setCrowdIntensity() must be implemented."); }
    setBgmVolume(volume) { throw new Error("setBgmVolume() must be implemented."); }
    setSfxVolume(volume) { throw new Error("setSfxVolume() must be implemented."); }
    getBgmVolume() { throw new Error("getBgmVolume() must be implemented."); }
    getSfxVolume() { throw new Error("getSfxVolume() must be implemented."); }
    setMuted(muted) { throw new Error("setMuted() must be implemented."); }
    isMuted() { throw new Error("isMuted() must be implemented."); }
    getAudioSettings() { throw new Error("getAudioSettings() must be implemented."); }
}

/**
 * Concrete HTMLAudioElement audio controller reading from assets/audio/ via SOUND_MANIFEST
 * with alternating battle BGM playlist, independent BGM/SFX volume mixing, and safe fallback (SRP & LSP).
 */
class HtmlAudioService extends IAudioService {
    constructor(baseFolder, soundManifest, initialSettings = {}, battlePlaylist = BATTLE_BGM_PLAYLIST) {
        super();
        this._baseFolder = baseFolder;
        this._manifest = soundManifest;
        this._battlePlaylist = battlePlaylist && battlePlaylist.length > 0 ? battlePlaylist : [SOUND_IDS.BGM_BATTLE];
        this._battlePlaylistCursor = 0;

        this._bgmVolume = typeof initialSettings.bgmVolume === "number" ? initialSettings.bgmVolume : 1.0;
        this._sfxVolume = typeof initialSettings.sfxVolume === "number" ? initialSettings.sfxVolume : 1.0;
        this._muted = Boolean(initialSettings.muted);
        this._unlocked = false;
        this._currentBgmId = null;
        this._ambiencePaused = false;
        this._lastDominanceRatio = 0.2;
        this._entries = new Map();

        this._preloadFromFolder();
    }

    _preloadFromFolder() {
        for (const key of Object.keys(this._manifest)) {
            const cfg = this._manifest[key];
            const src = `${this._baseFolder}${cfg.file}`;
            const audio = this._createAudioElement(src, cfg);
            this._entries.set(key, {
                config: cfg,
                audio,
                loaded: false,
                lastPlayedMs: 0
            });
        }
    }

    _createAudioElement(src, cfg) {
        const audio = new Audio();
        audio.preload = "auto";
        audio.loop = Boolean(cfg.loop);
        audio.volume = this._computeEffectiveVolume(cfg);
        audio.addEventListener("canplaythrough", () => {
            const entry = this._entries.get(cfg.id);
            if (entry && entry.audio === audio) entry.loaded = true;
        });
        audio.addEventListener("error", () => {
            const entry = this._entries.get(cfg.id);
            if (entry && entry.audio === audio) entry.loaded = false;
        });
        if (cfg.category === "BGM" && !cfg.loop) {
            audio.addEventListener("ended", () => this._onBgmTrackEnded(cfg.id));
        }
        audio.src = src;
        return audio;
    }

    _isBattleTrack(soundId) {
        return this._battlePlaylist.includes(soundId);
    }

    _onBgmTrackEnded(endedId) {
        if (this._currentBgmId !== endedId) return;
        if (this._isBattleTrack(endedId)) {
            this.playBattlePlaylistNext();
        }
    }

    _computeEffectiveVolume(cfg) {
        const master = cfg.category === "BGM" ? this._bgmVolume : this._sfxVolume;
        return Math.max(0, Math.min(1, cfg.volume * master));
    }

    unlock() {
        this._unlocked = true;
        if (this._currentBgmId && !this._muted) {
            this.playMusic(this._currentBgmId);
        }
    }

    isMuted() {
        return this._muted;
    }

    getBgmVolume() {
        return this._bgmVolume;
    }

    getSfxVolume() {
        return this._sfxVolume;
    }

    getAudioSettings() {
        return {
            bgmVolume: this._bgmVolume,
            sfxVolume: this._sfxVolume,
            muted: this._muted
        };
    }

    setBgmVolume(volume) {
        this._bgmVolume = Math.max(0, Math.min(1, Number(volume)));
        if (this._currentBgmId) {
            const cur = this._entries.get(this._currentBgmId);
            if (cur) cur.audio.volume = this._computeEffectiveVolume(cur.config);
        }
        return this._bgmVolume;
    }

    setSfxVolume(volume) {
        this._sfxVolume = Math.max(0, Math.min(1, Number(volume)));
        this.setCrowdIntensity(this._lastDominanceRatio);
        return this._sfxVolume;
    }

    setMuted(muted) {
        this._muted = Boolean(muted);
        const bgm = this._currentBgmId ? this._entries.get(this._currentBgmId) : null;
        const crowd = this._entries.get(SOUND_IDS.AMB_CROWD);

        if (this._muted) {
            if (bgm) bgm.audio.pause();
            if (crowd) crowd.audio.pause();
        } else if (this._unlocked) {
            if (bgm) bgm.audio.play().catch(() => {});
            if (crowd && this._isBattleTrack(this._currentBgmId) && !this._ambiencePaused) {
                crowd.audio.play().catch(() => {});
            }
        }
        return this._muted;
    }

    setBattleAmbiencePaused(paused) {
        this._ambiencePaused = Boolean(paused);
        const crowd = this._entries.get(SOUND_IDS.AMB_CROWD);
        if (!crowd) return;

        if (this._ambiencePaused) {
            crowd.audio.pause();
        } else if (!this._muted && this._unlocked && this._isBattleTrack(this._currentBgmId)) {
            crowd.audio.play().catch(() => {});
        }
    }

    playBattlePlaylistNext() {
        const trackId = this._battlePlaylist[this._battlePlaylistCursor % this._battlePlaylist.length];
        this._battlePlaylistCursor = (this._battlePlaylistCursor + 1) % this._battlePlaylist.length;
        const entry = this._entries.get(trackId);
        if (entry) {
            entry.audio.currentTime = 0;
        }
        this.playMusic(trackId);
        return trackId;
    }

    playMusic(soundId) {
        const prevId = this._currentBgmId;
        this._currentBgmId = soundId;

        if (prevId && prevId !== soundId) {
            const prev = this._entries.get(prevId);
            if (prev) {
                prev.audio.pause();
                prev.audio.currentTime = 0;
            }
        }

        const crowd = this._entries.get(SOUND_IDS.AMB_CROWD);
        if (this._isBattleTrack(soundId) && !this._ambiencePaused) {
            if (crowd && !this._muted && this._unlocked) {
                crowd.audio.play().catch(() => {});
            }
        } else if (crowd) {
            crowd.audio.pause();
            crowd.audio.currentTime = 0;
        }

        if (this._muted || !this._unlocked) return;
        const target = this._entries.get(soundId);
        if (!target) return;
        target.audio.volume = this._computeEffectiveVolume(target.config);
        target.audio.play().catch(() => {});
    }

    stopMusic() {
        if (this._currentBgmId) {
            const cur = this._entries.get(this._currentBgmId);
            if (cur) {
                cur.audio.pause();
                cur.audio.currentTime = 0;
            }
        }
        this._currentBgmId = null;
        const crowd = this._entries.get(SOUND_IDS.AMB_CROWD);
        if (crowd) {
            crowd.audio.pause();
            crowd.audio.currentTime = 0;
        }
    }

    setCrowdIntensity(dominanceRatio) {
        this._lastDominanceRatio = Math.max(0, Math.min(1, dominanceRatio));
        const crowd = this._entries.get(SOUND_IDS.AMB_CROWD);
        if (!crowd) return;
        const baseVol = crowd.config.volume;
        const scaled = (0.08 + this._lastDominanceRatio * (baseVol * 2.2)) * this._sfxVolume;
        crowd.audio.volume = Math.max(0, Math.min(0.8, scaled));
    }

    playSfx(soundId) {
        if (this._muted || !this._unlocked || this._sfxVolume <= 0) return;
        const entry = this._entries.get(soundId);
        if (!entry || !entry.loaded) return;

        const now = performance.now();
        if (entry.config.minIntervalMs > 0 && (now - entry.lastPlayedMs) < entry.config.minIntervalMs) {
            return;
        }
        entry.lastPlayedMs = now;

        const instance = entry.audio.cloneNode();
        instance.loop = false;
        instance.volume = this._computeEffectiveVolume(entry.config);
        instance.play().catch(() => {});
    }
}

/**
 * Decouples gameplay EventBus signals from concrete audio playback calls (DIP).
 */
class AudioCoordinator {
    constructor(eventBus, audioService) {
        this._eventBus = eventBus;
        this._audio = audioService;
        this._bindEvents();
    }

    _bindEvents() {
        const startBattleTrack = () => {
            this._audio.unlock();
            this._audio.setBattleAmbiencePaused(false);
            this._audio.playBattlePlaylistNext();
        };

        this._eventBus.on("UI_CLICK", () => {
            this._audio.unlock();
            this._audio.playSfx(SOUND_IDS.SFX_UI_CLICK);
        });
        this._eventBus.on("START_STAGE", startBattleTrack);
        this._eventBus.on("RETRY_STAGE", startBattleTrack);
        this._eventBus.on("NEXT_STAGE", startBattleTrack);
        this._eventBus.on("GAME_PAUSED", ({ paused }) => {
            this._audio.setBattleAmbiencePaused(paused);
        });
        this._eventBus.on("RETURN_MENU", () => {
            this._audio.setBattleAmbiencePaused(false);
            this._audio.playMusic(SOUND_IDS.BGM_MENU);
        });
        this._eventBus.on("MENU_OPENED", () => {
            this._audio.setBattleAmbiencePaused(false);
            this._audio.playMusic(SOUND_IDS.BGM_MENU);
        });
        this._eventBus.on("UNIT_SPAWNED", ({ key, faction }) => {
            if (faction === FACTIONS.PLAYER) {
                const unitCfg = UNIT_CONFIGS[key];
                const sfxId = (unitCfg && unitCfg.spawnSfxId) ? unitCfg.spawnSfxId : SOUND_IDS.SFX_SPAWN;
                this._audio.playSfx(sfxId);
            } else if (UNIT_CONFIGS[key] && UNIT_CONFIGS[key].isBoss) {
                this._audio.playSfx(SOUND_IDS.SFX_BARRACUDA);
            }
        });
        this._eventBus.on("SHOP_BUY_SFX", () => {
            this._audio.unlock();
            this._audio.playSfx(SOUND_IDS.SFX_SHOP_BUY);
        });
        this._eventBus.on("SHOP_EQUIP_SFX", () => {
            this._audio.unlock();
            this._audio.playSfx(SOUND_IDS.SFX_SHOP_EQUIP);
        });
        this._eventBus.on("SHOP_UNEQUIP_SFX", () => {
            this._audio.unlock();
            this._audio.playSfx(SOUND_IDS.SFX_SHOP_UNEQUIP);
        });
        this._eventBus.on("SHOP_ERROR_SFX", () => {
            this._audio.unlock();
            this._audio.playSfx(SOUND_IDS.SFX_SHOP_ERROR);
        });
        this._eventBus.on("HEAL_PULSE", () => {
            this._audio.playSfx(SOUND_IDS.SFX_HEAL);
        });
        this._eventBus.on("MELEE_HIT", () => {
            this._audio.playSfx(SOUND_IDS.SFX_HIT_MELEE);
        });
        this._eventBus.on("RANGED_SHOT", () => {
            this._audio.playSfx(SOUND_IDS.SFX_THROW);
        });
        this._eventBus.on("AOE_IMPACT", ({ kind }) => {
            if (kind === "WATER") {
                this._audio.playSfx(SOUND_IDS.SFX_WATER_CANNON);
            } else if (kind === "TEARGAS") {
                this._audio.playSfx(SOUND_IDS.SFX_TEARGAS);
            } else if (kind === "PETASAN") {
                this._audio.playSfx(SOUND_IDS.SFX_PETASAN);
            } else if (kind === "SONIC") {
                this._audio.playSfx(SOUND_IDS.SFX_SONIC);
            }
        });
        this._eventBus.on("CROWD_DOMINANCE", ({ ratio }) => {
            this._audio.setCrowdIntensity(ratio);
        });
        this._eventBus.on("STAGE_ENDED", ({ isVictory }) => {
            this._audio.stopMusic();
            this._audio.playSfx(isVictory ? SOUND_IDS.SFX_VICTORY : SOUND_IDS.SFX_GAMEOVER);
        });
    }
}
