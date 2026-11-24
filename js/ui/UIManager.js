"use strict";

/**
 * Manages DOM screens (Menu, Stage Select, Pause, Audio Settings, End Screen),
 * HUD updates, and user interactions (SRP).
 */
class UIManager {
    constructor(eventBus, inputHandler, audioService, storageService, assetService = null) {
        this._eventBus = eventBus;
        this._input = inputHandler;
        this._audio = audioService;
        this._storage = storageService;
        this._assets = assetService;

        this._startScreen = document.getElementById("start-screen");
        this._stageSelectScreen = document.getElementById("stage-select-screen");
        this._stageGridEl = document.getElementById("stage-grid");
        this._stageCoinsEl = document.getElementById("stage-coins");
        this._shopScreen = document.getElementById("shop-screen");
        this._shopCoinsEl = document.getElementById("shop-coins");
        this._shopFeedbackEl = document.getElementById("shop-feedback");
        this._shopRegularSlotsEl = document.getElementById("shop-regular-slots");
        this._shopBuffSlotEl = document.getElementById("shop-buff-slot");
        this._shopCatalogGridEl = document.getElementById("shop-catalog-grid");
        this._shopFilterButtons = Array.from(document.querySelectorAll(".shop-filter-btn"));
        this._btnShopBack = document.getElementById("btn-shop-back");
        this._btnShopNext = document.getElementById("btn-shop-next");
        this._howtoScreen = document.getElementById("howto-screen");
        this._pauseScreen = document.getElementById("pause-screen");
        this._audioSettingsScreen = document.getElementById("audio-settings-screen");
        this._endScreen = document.getElementById("end-screen");
        this._endCoinsRowEl = document.getElementById("end-coins-row");
        this._endCoinsEl = document.getElementById("end-coins");
        this._btnEndShop = document.getElementById("btn-end-shop");
        this._lastEndNextStageIndex = null;
        this._shopNextStageIndex = null;

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
        this._assetImages = Array.from(document.querySelectorAll("img[data-asset]"));
        this._bindDOMEvents();
        this._syncAudioUi();
        this._bindAssetImages();
    }

    _bindAssetImages() {
        if (!this._assets) return;
        const applyAsset = (imgEl) => {
            const id = imgEl.dataset.asset;
            if (this._assets.isReady(id)) {
                imgEl.src = this._assets.getSourceUrl(id);
                imgEl.classList.remove("hidden");
            } else {
                imgEl.classList.add("hidden");
            }
        };

        for (const imgEl of this._assetImages) {
            applyAsset(imgEl);
        }
        this._assets.subscribeOnUpdate((updatedId) => {
            for (const imgEl of this._assetImages) {
                if (imgEl.dataset.asset === updatedId) {
                    applyAsset(imgEl);
                }
            }
        });
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
        document.getElementById("btn-stage-shop").addEventListener("click", () => {
            this._eventBus.emit("UI_CLICK");
            this._eventBus.emit("OPEN_SHOP", {});
        });
        document.getElementById("btn-reset-progress").addEventListener("click", () => {
            this._eventBus.emit("UI_CLICK");
            this._eventBus.emit("RESET_PROGRESS");
        });

        // Shop & Loadout modal actions
        for (const filterBtn of this._shopFilterButtons) {
            filterBtn.addEventListener("click", () => {
                this._eventBus.emit("UI_CLICK");
                this._eventBus.emit("SHOP_FILTER", { category: filterBtn.dataset.shopFilter });
            });
        }
        if (this._btnShopBack) {
            this._btnShopBack.addEventListener("click", () => {
                this._eventBus.emit("UI_CLICK");
                this._eventBus.emit("OPEN_STAGE_SELECT");
            });
        }
        if (this._btnShopNext) {
            this._btnShopNext.addEventListener("click", () => {
                if (this._shopNextStageIndex === null) return;
                this._eventBus.emit("UI_CLICK");
                this._eventBus.emit("START_STAGE", { stageIndex: this._shopNextStageIndex });
            });
        }

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
        if (this._btnEndShop) {
            this._btnEndShop.addEventListener("click", () => {
                this._eventBus.emit("UI_CLICK");
                this._eventBus.emit("OPEN_SHOP", { nextStageIndex: this._lastEndNextStageIndex });
            });
        }
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
                const unitKey = btn.dataset.unit;
                if (unitKey) {
                    this._eventBus.emit("SPAWN_REQUEST", unitKey);
                }
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
        if (this._shopScreen) this._shopScreen.classList.add("hidden");
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

    showStageSelectScreen(stages, unlockedStage, clearedStages, coins = 0) {
        this._hideAllOverlays();
        this._setGameplayHudVisible(false);
        if (this._stageCoinsEl) {
            this._stageCoinsEl.textContent = String(coins);
        }
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

    _getUnitIconAssetId(unitKey) {
        if (!unitKey) return "";
        return UNIT_KEY_TO_ICON_ID[unitKey] || UNIT_KEY_TO_ASSET_ID[unitKey] || "";
    }

    syncHudLoadout(hudSlotKeys) {
        for (let i = 0; i < this._unitButtons.length; i++) {
            const btn = this._unitButtons[i];
            const key = Array.isArray(hudSlotKeys) ? hudSlotKeys[i] : null;
            const cfg = key ? UNIT_CONFIGS[key] : null;
            const nameEl = btn.querySelector(".unit-name");
            const costEl = btn.querySelector(".unit-cost");
            const imgEl = btn.querySelector(".btn-icon-img");

            if (cfg) {
                btn.dataset.unit = key;
                btn.classList.remove("is-slot-empty");
                btn.title = cfg.roleLabel || cfg.name;
                if (nameEl) nameEl.textContent = cfg.shortLabel || cfg.name;
                if (costEl) costEl.textContent = `Cost: ${cfg.cost}`;
                if (imgEl) {
                    const iconId = this._getUnitIconAssetId(key);
                    imgEl.dataset.asset = iconId;
                    if (this._assets && iconId && this._assets.isReady(iconId)) {
                        imgEl.src = this._assets.getSourceUrl(iconId);
                        imgEl.classList.remove("hidden");
                    } else {
                        imgEl.classList.add("hidden");
                    }
                }
            } else {
                btn.dataset.unit = "";
                btn.classList.add("is-slot-empty");
                btn.disabled = true;
                btn.title = i === 3 ? "Slot Buff Global Kosong (Atur di Shop)" : "Slot Kosong (Atur di Shop)";
                if (nameEl) nameEl.textContent = "Kosong";
                if (costEl) costEl.textContent = i === 3 ? "Slot Buff" : "Slot Kosong";
                if (imgEl) {
                    imgEl.dataset.asset = "";
                    imgEl.classList.add("hidden");
                }
            }
        }
    }

    showShopScreen({
        coins,
        catalog,
        regularSlots,
        globalBuffSlot,
        ownedSet,
        activeFilter,
        nextStageIndex,
        canEnterBattle,
        feedbackText,
        isError
    }) {
        this._hideAllOverlays();
        this._setGameplayHudVisible(false);
        this._shopNextStageIndex = typeof nextStageIndex === "number" ? nextStageIndex : null;

        if (this._shopCoinsEl) {
            this._shopCoinsEl.textContent = String(coins);
        }

        if (this._shopFeedbackEl) {
            if (feedbackText) {
                this._shopFeedbackEl.textContent = feedbackText;
                this._shopFeedbackEl.classList.toggle("is-error", Boolean(isError));
                this._shopFeedbackEl.classList.remove("hidden");
            } else {
                this._shopFeedbackEl.classList.add("hidden");
            }
        }

        for (const filterBtn of this._shopFilterButtons) {
            filterBtn.classList.toggle("is-active", filterBtn.dataset.shopFilter === activeFilter);
        }

        if (this._shopRegularSlotsEl) {
            this._shopRegularSlotsEl.innerHTML = "";
            for (let i = 0; i < SHOP_CONFIG.MAX_REGULAR_SLOTS; i++) {
                this._shopRegularSlotsEl.appendChild(
                    this._createLoadoutSlotCard(regularSlots[i], UNIT_SLOT_CATEGORIES.REGULAR, i)
                );
            }
        }

        if (this._shopBuffSlotEl) {
            this._shopBuffSlotEl.innerHTML = "";
            this._shopBuffSlotEl.appendChild(
                this._createLoadoutSlotCard(globalBuffSlot, UNIT_SLOT_CATEGORIES.GLOBAL_BUFF, 0)
            );
        }

        if (this._shopCatalogGridEl) {
            this._shopCatalogGridEl.innerHTML = "";
            for (let i = 0; i < catalog.length; i++) {
                const cfg = catalog[i];
                const owned = ownedSet.has(cfg.key);
                const equipped = regularSlots.includes(cfg.key) || globalBuffSlot === cfg.key;
                this._shopCatalogGridEl.appendChild(
                    this._createShopUnitCard(cfg, owned, equipped, coins)
                );
            }
        }

        if (this._btnShopNext) {
            const hasNext = this._shopNextStageIndex !== null;
            this._btnShopNext.classList.toggle("hidden", !hasNext);
            if (hasNext) {
                this._btnShopNext.disabled = !canEnterBattle;
                this._btnShopNext.textContent = canEnterBattle
                    ? `Lanjut Stage ${STAGE_CONFIGS[this._shopNextStageIndex].stageNumber}`
                    : "Pasang Min. 1 Unit Biasa";
            }
        }

        if (this._shopScreen) {
            this._shopScreen.classList.remove("hidden");
        }
    }

    _createLoadoutSlotCard(unitKey, category, slotIndex) {
        const card = document.createElement("div");
        if (!unitKey || !UNIT_CONFIGS[unitKey]) {
            card.className = "loadout-slot-card is-empty";
            card.textContent = category === UNIT_SLOT_CATEGORIES.GLOBAL_BUFF ? "Buff Kosong" : `Slot ${slotIndex + 1} Kosong`;
            return card;
        }

        const cfg = UNIT_CONFIGS[unitKey];
        card.className = "loadout-slot-card";
        card.dataset.tooltipUnit = unitKey;

        const iconId = this._getUnitIconAssetId(unitKey);
        if (this._assets && iconId && this._assets.isReady(iconId)) {
            const icon = document.createElement("img");
            icon.className = "loadout-slot-icon";
            icon.src = this._assets.getSourceUrl(iconId);
            icon.alt = cfg.name;
            card.appendChild(icon);
        }

        const info = document.createElement("div");
        info.className = "loadout-slot-info";
        const nm = document.createElement("div");
        nm.className = "loadout-slot-name";
        nm.textContent = cfg.name;
        const cost = document.createElement("div");
        cost.className = "loadout-slot-cost";
        cost.textContent = `Moral: ${cfg.cost}`;
        info.appendChild(nm);
        info.appendChild(cost);
        card.appendChild(info);

        const removeBtn = document.createElement("button");
        removeBtn.className = "btn-slot-unequip";
        removeBtn.textContent = "Lepas";
        removeBtn.addEventListener("click", () => {
            this._eventBus.emit("SHOP_UNEQUIP", { unitKey, category, index: slotIndex });
        });
        card.appendChild(removeBtn);
        return card;
    }

    _createShopUnitCard(cfg, owned, equipped, coins) {
        const isBuff = cfg.slotCategory === UNIT_SLOT_CATEGORIES.GLOBAL_BUFF;
        const card = document.createElement("div");
        card.className = `shop-unit-card ${isBuff ? "is-buff" : ""} ${equipped ? "is-equipped" : ""}`;
        card.dataset.tooltipUnit = cfg.key;

        const top = document.createElement("div");
        top.className = "shop-unit-top";

        const iconId = this._getUnitIconAssetId(cfg.key);
        if (this._assets && iconId && this._assets.isReady(iconId)) {
            const icon = document.createElement("img");
            icon.className = "shop-unit-icon";
            icon.src = this._assets.getSourceUrl(iconId);
            icon.alt = cfg.name;
            top.appendChild(icon);
        }

        const meta = document.createElement("div");
        meta.className = "shop-unit-meta";
        const title = document.createElement("div");
        title.className = "shop-unit-title";
        title.textContent = cfg.name;
        const role = document.createElement("div");
        role.className = "shop-unit-role";
        role.textContent = cfg.roleLabel || "";
        meta.appendChild(title);
        meta.appendChild(role);
        top.appendChild(meta);
        card.appendChild(top);

        const badges = document.createElement("div");
        badges.className = "shop-unit-badges";
        const catTag = document.createElement("span");
        catTag.className = `shop-cat-tag ${isBuff ? "buff" : ""}`;
        catTag.textContent = isBuff ? "GLOBAL BUFF" : "UNIT BIASA";
        const moralTag = document.createElement("span");
        moralTag.className = "shop-moral-tag";
        moralTag.textContent = `Moral ${cfg.cost}`;
        badges.appendChild(catTag);
        badges.appendChild(moralTag);
        card.appendChild(badges);

        const actionBtn = document.createElement("button");
        if (!owned) {
            const canAfford = coins >= cfg.shopPrice;
            actionBtn.className = `shop-unit-action ${canAfford ? "buy-ready" : "buy-locked"}`;
            actionBtn.textContent = canAfford ? `Beli • ${cfg.shopPrice} Koin` : `Kurang • ${cfg.shopPrice} Koin`;
            actionBtn.addEventListener("click", () => {
                this._eventBus.emit("SHOP_BUY", { unitKey: cfg.key });
            });
        } else if (equipped) {
            actionBtn.className = "shop-unit-action unequip-btn";
            actionBtn.textContent = "Terpasang (Klik Lepas)";
            actionBtn.addEventListener("click", () => {
                this._eventBus.emit("SHOP_UNEQUIP", { unitKey: cfg.key });
            });
        } else {
            actionBtn.className = "shop-unit-action equip-btn";
            actionBtn.textContent = isBuff ? "Pasang ke Slot Buff" : "Pasang ke Slot";
            actionBtn.addEventListener("click", () => {
                this._eventBus.emit("SHOP_EQUIP", { unitKey: cfg.key });
            });
        }
        card.appendChild(actionBtn);

        return card;
    }

    showEndScreen({ isVictory, reason, score, highScore, timeRemaining, coinsEarned = 0, totalCoins = 0, hasNextStage, nextStageIndex = null }) {
        this._hideAllOverlays();
        this._lastEndNextStageIndex = isVictory ? nextStageIndex : null;
        this._endTitleEl.textContent = isVictory ? "VICTORY" : "GAME OVER";
        this._endTitleEl.className = `end-title ${isVictory ? "victory" : "gameover"}`;
        this._endReasonEl.textContent = reason;
        this._endScoreEl.textContent = String(Math.floor(score)).padStart(4, "0");
        this._endHighScoreEl.textContent = String(Math.floor(highScore)).padStart(4, "0");
        this._endTimeEl.textContent = `${Math.max(0, Math.ceil(timeRemaining))} detik`;
        if (this._endCoinsRowEl && this._endCoinsEl) {
            this._endCoinsRowEl.classList.toggle("hidden", !isVictory);
            this._endCoinsEl.textContent = `+${coinsEarned} Koin (Total: ${totalCoins})`;
        }
        if (this._btnEndShop) {
            this._btnEndShop.textContent = isVictory ? "Masuk Fase Shop →" : "Atur Formasi / Shop";
        }
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
            const cdBar = btn.querySelector(".unit-cd-bar");
            if (!key) {
                btn.disabled = true;
                if (cdBar) cdBar.style.width = "0%";
                continue;
            }
            const canSpawn = resourceManager.canAfford(key) && combatSystem.canSpawnPlayerUnit(key);
            btn.disabled = !canSpawn;
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
