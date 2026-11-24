"use strict";

/**
 * Manages DOM screens (Menu, Stage Select, Pause, Audio Settings, End Screen),
 * HUD updates, and user interactions (SRP).
 */
class UIManager {
    constructor(eventBus, inputHandler, audioService, storageService) {
        this._eventBus = eventBus;
        this._input = inputHandler;
        this._audio = audioService;
        this._storage = storageService;

        this._startScreen = document.getElementById("start-screen");
        this._stageSelectScreen = document.getElementById("stage-select-screen");
        this._stageGridEl = document.getElementById("stage-grid");
        this._howtoScreen = document.getElementById("howto-screen");
        this._pauseScreen = document.getElementById("pause-screen");
        this._audioSettingsScreen = document.getElementById("audio-settings-screen");
        this._endScreen = document.getElementById("end-screen");

        this._hudTop = document.getElementById("hud-top");
        this._hudBottom = document.getElementById("hud-bottom");
        this._camLeftBtn = document.getElementById("cam-left-btn");
        this._camRightBtn = document.getElementById("cam-right-btn");
        this._timeBadge = document.getElementById("timescale-badge");

        this._muteBtn = document.getElementById("btn-mute-toggle");
        this._pauseBtn = document.getElementById("btn-hud-pause");
        this._bgmSlider = document.getElementById("slider-bgm-vol");
        this._sfxSlider = document.getElementById("slider-sfx-vol");
        this._bgmValEl = document.getElementById("val-bgm-vol");
        this._sfxValEl = document.getElementById("val-sfx-vol");
        this._modalMuteBtn = document.getElementById("btn-audio-mute-modal");

        this._moralEl = document.getElementById("hud-moral");
        this._stageEl = document.getElementById("hud-stage");
        this._timerEl = document.getElementById("hud-timer");
        this._scoreEl = document.getElementById("hud-score");

        this._startHighScoreEl = document.getElementById("start-highscore");
        this._endTitleEl = document.getElementById("end-title");
        this._endReasonEl = document.getElementById("end-reason");
        this._endScoreEl = document.getElementById("end-score");
        this._endHighScoreEl = document.getElementById("end-highscore");
        this._endTimeEl = document.getElementById("end-time");
        this._btnNext = document.getElementById("btn-next");
        this._skillBtn = document.getElementById("btn-special-skill");
        this._skillStatusEl = document.getElementById("skill-status");
        this._skillCdBarEl = document.getElementById("skill-cd-bar");

        this._audioReturnTarget = "MENU"; // MENU | PAUSED
        this._unitButtons = Array.from(document.querySelectorAll(".unit-btn"));
        this._bindDOMEvents();
        this._syncAudioUi();
    }

    _bindDOMEvents() {
        document.getElementById("btn-start").addEventListener("click", () => {
            this._eventBus.emit("UI_CLICK");
            this._eventBus.emit("OPEN_STAGE_SELECT");
        });
        document.getElementById("btn-howto").addEventListener("click", () => {
            this._eventBus.emit("UI_CLICK");
            this._howtoScreen.classList.remove("hidden");
        });
        document.getElementById("btn-howto-close").addEventListener("click", () => {
            this._eventBus.emit("UI_CLICK");
            this._howtoScreen.classList.add("hidden");
        });
        document.getElementById("btn-menu-audio").addEventListener("click", () => {
            this._eventBus.emit("UI_CLICK");
            this._openAudioSettings("MENU");
        });

        // Stage Select actions
        document.getElementById("btn-stage-back").addEventListener("click", () => {
            this._eventBus.emit("UI_CLICK");
            this._eventBus.emit("RETURN_MENU");
        });
        document.getElementById("btn-reset-progress").addEventListener("click", () => {
            this._eventBus.emit("UI_CLICK");
            this._eventBus.emit("RESET_PROGRESS");
        });

        // Pause Menu actions
        if (this._pauseBtn) {
            this._pauseBtn.addEventListener("click", () => {
                this._pauseBtn.blur();
                this._eventBus.emit("UI_CLICK");
                this._eventBus.emit("PAUSE_TOGGLE");
            });
        }
        document.getElementById("btn-pause-resume").addEventListener("click", () => {
            this._eventBus.emit("UI_CLICK");
            this._eventBus.emit("RESUME_GAME");
        });
        document.getElementById("btn-pause-audio").addEventListener("click", () => {
            this._eventBus.emit("UI_CLICK");
            this._openAudioSettings("PAUSED");
        });
        document.getElementById("btn-pause-retry").addEventListener("click", () => {
            this._eventBus.emit("UI_CLICK");
            this._eventBus.emit("RETRY_STAGE");
        });
        document.getElementById("btn-pause-menu").addEventListener("click", () => {
            this._eventBus.emit("UI_CLICK");
            this._eventBus.emit("RETURN_MENU");
        });

        // Audio Settings sliders & buttons
        if (this._muteBtn) {
            this._muteBtn.addEventListener("click", () => {
                this._muteBtn.blur();
                this._toggleMute();
            });
        }
        if (this._modalMuteBtn) {
            this._modalMuteBtn.addEventListener("click", () => {
                this._toggleMute();
            });
        }
        if (this._bgmSlider) {
            this._bgmSlider.addEventListener("input", (e) => {
                if (!this._audio) return;
                this._audio.unlock();
                this._audio.setBgmVolume(Number(e.target.value) / 100);
                this._persistAndSyncAudio();
            });
        }
        if (this._sfxSlider) {
            this._sfxSlider.addEventListener("input", (e) => {
                if (!this._audio) return;
                this._audio.unlock();
                this._audio.setSfxVolume(Number(e.target.value) / 100);
                this._persistAndSyncAudio();
            });
            this._sfxSlider.addEventListener("change", () => {
                this._eventBus.emit("UI_CLICK");
            });
        }
        document.getElementById("btn-audio-reset").addEventListener("click", () => {
            if (!this._audio) return;
            this._audio.setBgmVolume(1.0);
            this._audio.setSfxVolume(1.0);
            this._audio.setMuted(false);
            this._persistAndSyncAudio();
            this._eventBus.emit("UI_CLICK");
        });
        document.getElementById("btn-audio-close").addEventListener("click", () => {
            this._eventBus.emit("UI_CLICK");
            this.closeAudioSettings();
        });

        // End Screen actions
        document.getElementById("btn-retry").addEventListener("click", () => {
            this._eventBus.emit("UI_CLICK");
            this._eventBus.emit("RETRY_STAGE");
        });
        this._btnNext.addEventListener("click", () => {
            this._eventBus.emit("UI_CLICK");
            this._eventBus.emit("NEXT_STAGE");
        });
        document.getElementById("btn-menu").addEventListener("click", () => {
            this._eventBus.emit("UI_CLICK");
            this._eventBus.emit("RETURN_MENU");
        });

        // Unit Shop & Skill buttons
        for (const btn of this._unitButtons) {
            btn.addEventListener("click", () => {
                btn.blur();
                this._eventBus.emit("SPAWN_REQUEST", btn.dataset.unit);
            });
        }

        if (this._skillBtn) {
            this._skillBtn.addEventListener("click", () => {
                this._skillBtn.blur();
                this._eventBus.emit("SKILL_REQUEST");
            });
        }

        const bindEdgeHold = (el, dir) => {
            const start = () => this._input.setEdgeCameraInput(dir, true);
            const stop = () => this._input.setEdgeCameraInput(dir, false);
            el.addEventListener("mousedown", start);
            el.addEventListener("mouseup", stop);
            el.addEventListener("mouseleave", stop);
            el.addEventListener("touchstart", (e) => { e.preventDefault(); start(); });
            el.addEventListener("touchend", stop);
        };
        bindEdgeHold(this._camLeftBtn, "LEFT");
        bindEdgeHold(this._camRightBtn, "RIGHT");
    }

    _hideAllOverlays() {
        this._startScreen.classList.add("hidden");
        this._stageSelectScreen.classList.add("hidden");
        this._howtoScreen.classList.add("hidden");
        this._pauseScreen.classList.add("hidden");
        this._audioSettingsScreen.classList.add("hidden");
        this._endScreen.classList.add("hidden");
    }

    showStartScreen(highScore) {
        this._hideAllOverlays();
        this._startHighScoreEl.textContent = String(highScore).padStart(4, "0");
        this._startScreen.classList.remove("hidden");
        this._setGameplayHudVisible(false);
    }

    showStageSelectScreen(stages, unlockedStage, clearedStages) {
        this._hideAllOverlays();
        this._setGameplayHudVisible(false);
        this._stageGridEl.innerHTML = "";

        for (let i = 0; i < stages.length; i++) {
            const st = stages[i];
            const isLocked = st.stageNumber > unlockedStage;
            const isCleared = clearedStages.includes(st.stageNumber);

            const card = document.createElement("button");
            card.className = `stage-card ${isLocked ? "is-locked" : "is-unlocked"} ${isCleared ? "is-cleared" : ""}`;
            card.disabled = isLocked;

            const topRow = document.createElement("div");
            topRow.className = "stage-card-top";
            const numBadge = document.createElement("span");
            numBadge.className = "stage-num-badge";
            numBadge.textContent = `STAGE ${st.stageNumber}`;

            const statusBadge = document.createElement("span");
            statusBadge.className = `stage-status-badge ${isLocked ? "locked" : (isCleared ? "cleared" : "open")}`;
            statusBadge.textContent = isLocked ? "🔒 Terkunci" : (isCleared ? "✓ Ditaklukkan" : "Siap Main");
            topRow.appendChild(numBadge);
            topRow.appendChild(statusBadge);

            const title = document.createElement("div");
            title.className = "stage-card-title";
            title.textContent = st.title.replace(/^Stage \d+:\s*/, "");

            const meta = document.createElement("div");
            meta.className = "stage-card-meta";
            meta.textContent = isLocked
                ? `Taklukkan Stage ${st.stageNumber - 1} untuk membuka`
                : `Kesulitan: ${st.difficulty} • Waktu: ${st.duration}s`;

            card.appendChild(topRow);
            card.appendChild(title);
            card.appendChild(meta);

            if (!isLocked) {
                const idx = i;
                card.addEventListener("click", () => {
                    this._eventBus.emit("UI_CLICK");
                    this._eventBus.emit("START_STAGE", { stageIndex: idx });
                });
            }

            this._stageGridEl.appendChild(card);
        }

        this._stageSelectScreen.classList.remove("hidden");
    }

    showGameplayHud() {
        this._hideAllOverlays();
        this._setGameplayHudVisible(true);
    }

    showPauseScreen() {
        this._audioSettingsScreen.classList.add("hidden");
        this._pauseScreen.classList.remove("hidden");
    }

    isAudioSettingsOpen() {
        return !this._audioSettingsScreen.classList.contains("hidden");
    }

    closeSubModalIfOpen() {
        if (this.isAudioSettingsOpen()) {
            this.closeAudioSettings();
            return true;
        }
        if (!this._howtoScreen.classList.contains("hidden")) {
            this._howtoScreen.classList.add("hidden");
            return true;
        }
        return false;
    }

    _openAudioSettings(source) {
        this._audioReturnTarget = source;
        this._syncAudioUi();
        if (source === "PAUSED") {
            this._pauseScreen.classList.add("hidden");
        }
        this._audioSettingsScreen.classList.remove("hidden");
    }

    closeAudioSettings() {
        this._audioSettingsScreen.classList.add("hidden");
        if (this._audioReturnTarget === "PAUSED") {
            this._pauseScreen.classList.remove("hidden");
        }
    }

    _toggleMute() {
        if (!this._audio) return;
        this._audio.unlock();
        this._audio.setMuted(!this._audio.isMuted());
        this._persistAndSyncAudio();
    }

    _persistAndSyncAudio() {
        if (!this._audio) return;
        if (this._storage && this._storage.saveAudioSettings) {
            this._storage.saveAudioSettings(this._audio.getAudioSettings());
        }
        this._syncAudioUi();
    }

    _syncAudioUi() {
        if (!this._audio) return;
        const bgmPct = Math.round(this._audio.getBgmVolume() * 100);
        const sfxPct = Math.round(this._audio.getSfxVolume() * 100);
        const muted = this._audio.isMuted();

        if (this._bgmSlider) this._bgmSlider.value = String(bgmPct);
        if (this._sfxSlider) this._sfxSlider.value = String(sfxPct);
        if (this._bgmValEl) this._bgmValEl.textContent = `${bgmPct}%`;
        if (this._sfxValEl) this._sfxValEl.textContent = `${sfxPct}%`;
        if (this._muteBtn) this._muteBtn.textContent = muted ? "🔇" : "🔊";
        if (this._modalMuteBtn) this._modalMuteBtn.textContent = muted ? "Audio: MUTED" : "Audio: ON";
    }

    showEndScreen({ isVictory, reason, score, highScore, timeRemaining, hasNextStage }) {
        this._hideAllOverlays();
        this._endTitleEl.textContent = isVictory ? "VICTORY" : "GAME OVER";
        this._endTitleEl.className = `end-title ${isVictory ? "victory" : "gameover"}`;
        this._endReasonEl.textContent = reason;
        this._endScoreEl.textContent = String(Math.floor(score)).padStart(4, "0");
        this._endHighScoreEl.textContent = String(Math.floor(highScore)).padStart(4, "0");
        this._endTimeEl.textContent = `${Math.max(0, Math.ceil(timeRemaining))} detik`;
        this._btnNext.classList.toggle("hidden", !(isVictory && hasNextStage));
        this._endScreen.classList.remove("hidden");
    }

    _setGameplayHudVisible(visible) {
        this._hudTop.classList.toggle("hidden", !visible);
        this._hudBottom.classList.toggle("hidden", !visible);
        this._camLeftBtn.classList.toggle("hidden", !visible);
        this._camRightBtn.classList.toggle("hidden", !visible);
        this._timeBadge.classList.toggle("hidden", !visible);
    }

    updateHud({ moral, stageNum, totalStages, timeRemaining, score, timeScale, resourceManager, combatSystem, skillState }) {
        this._moralEl.textContent = String(Math.floor(moral));
        this._stageEl.textContent = `${stageNum}/${totalStages}`;
        this._scoreEl.textContent = String(Math.floor(score)).padStart(4, "0");

        const sec = Math.max(0, Math.ceil(timeRemaining));
        this._timerEl.textContent = `00:${String(sec).padStart(2, "0")}`;
        this._timerEl.classList.toggle("timer-critical", sec <= 10);

        this._timeBadge.textContent = `${timeScale.toFixed(1)}x`;

        for (const btn of this._unitButtons) {
            const key = btn.dataset.unit;
            const canSpawn = resourceManager.canAfford(key) && combatSystem.canSpawnPlayerUnit(key);
            btn.disabled = !canSpawn;
            const cdBar = btn.querySelector(".unit-cd-bar");
            if (cdBar) {
                cdBar.style.width = `${resourceManager.getCooldownProgress(key) * 100}%`;
            }
        }

        if (this._skillBtn && skillState) {
            this._skillBtn.disabled = !skillState.isReady;
            this._skillBtn.classList.toggle("is-ready", skillState.isReady);
            this._skillBtn.classList.toggle("is-active", skillState.isActive);
            if (this._skillStatusEl) {
                if (skillState.isActive) {
                    this._skillStatusEl.textContent = "HUJAN AKTIF!";
                } else if (skillState.isReady) {
                    this._skillStatusEl.textContent = "SIAP [SPACE]";
                } else {
                    this._skillStatusEl.textContent = `CD: ${Math.ceil(skillState.remainingCooldown)}s`;
                }
            }
            if (this._skillCdBarEl) {
                this._skillCdBarEl.style.width = `${skillState.cooldownProgress * 100}%`;
            }
        }
    }
}
