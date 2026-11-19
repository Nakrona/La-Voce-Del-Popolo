"use strict";

/**
 * Manages DOM screens, HUD stats, unit button states, and user click bindings (SRP).
 */
class UIManager {
    constructor(eventBus, inputHandler) {
        this._eventBus = eventBus;
        this._input = inputHandler;

        this._startScreen = document.getElementById("start-screen");
        this._howtoScreen = document.getElementById("howto-screen");
        this._endScreen = document.getElementById("end-screen");
        this._hudTop = document.getElementById("hud-top");
        this._hudBottom = document.getElementById("hud-bottom");
        this._camLeftBtn = document.getElementById("cam-left-btn");
        this._camRightBtn = document.getElementById("cam-right-btn");
        this._timeBadge = document.getElementById("timescale-badge");

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

        this._unitButtons = Array.from(document.querySelectorAll(".unit-btn"));
        this._bindDOMEvents();
    }

    _bindDOMEvents() {
        document.getElementById("btn-start").addEventListener("click", () => {
            this._eventBus.emit("START_GAME");
        });
        document.getElementById("btn-howto").addEventListener("click", () => {
            this._howtoScreen.classList.remove("hidden");
        });
        document.getElementById("btn-howto-close").addEventListener("click", () => {
            this._howtoScreen.classList.add("hidden");
        });
        document.getElementById("btn-retry").addEventListener("click", () => {
            this._eventBus.emit("RETRY_STAGE");
        });
        this._btnNext.addEventListener("click", () => {
            this._eventBus.emit("NEXT_STAGE");
        });
        document.getElementById("btn-menu").addEventListener("click", () => {
            this._eventBus.emit("RETURN_MENU");
        });

        for (const btn of this._unitButtons) {
            btn.addEventListener("click", () => {
                this._eventBus.emit("SPAWN_REQUEST", btn.dataset.unit);
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

    showStartScreen(highScore) {
        this._startHighScoreEl.textContent = String(highScore).padStart(4, "0");
        this._startScreen.classList.remove("hidden");
        this._howtoScreen.classList.add("hidden");
        this._endScreen.classList.add("hidden");
        this._setGameplayHudVisible(false);
    }

    showGameplayHud() {
        this._startScreen.classList.add("hidden");
        this._howtoScreen.classList.add("hidden");
        this._endScreen.classList.add("hidden");
        this._setGameplayHudVisible(true);
    }

    showEndScreen({ isVictory, reason, score, highScore, timeRemaining, hasNextStage }) {
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

    updateHud({ moral, stageNum, totalStages, timeRemaining, score, timeScale, resourceManager, combatSystem }) {
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
    }
}
