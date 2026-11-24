"use strict";

/**
 * Captures keyboard and pointer/edge-button states using boolean state latching
 * to avoid OS key-repeat stuttering when holding W, S, A, or D.
 * Follows Single Responsibility Principle (SRP).
 */
class InputHandler {
    constructor(eventBus) {
        this._eventBus = eventBus;
        this.moveCamLeft = false;
        this.moveCamRight = false;
        this.isSpeedUp = false;
        this.isSlowDown = false;
        this._edgeLeft = false;
        this._edgeRight = false;
        this._isKeyGDown = false;
        this._isF3Down = false;
        this._debugComboLatched = false;
        this._bindEvents();
    }

    _bindEvents() {
        window.addEventListener("keydown", (e) => this._onKeyDown(e));
        window.addEventListener("keyup", (e) => this._onKeyUp(e));
        window.addEventListener("blur", () => this.resetAll());
    }

    _onKeyDown(e) {
        const code = e.code;
        if (code === "KeyG") {
            this._isKeyGDown = true;
        } else if (code === "F3") {
            e.preventDefault();
            this._isF3Down = true;
        }

        if ((code === "KeyG" || code === "F3") && this._isKeyGDown && this._isF3Down && !this._debugComboLatched) {
            e.preventDefault();
            this._debugComboLatched = true;
            this._eventBus.emit("DEBUG_AUTO_WIN");
            return;
        }

        if (code === "KeyA" || code === "ArrowLeft") this.moveCamLeft = true;
        else if (code === "KeyD" || code === "ArrowRight") this.moveCamRight = true;
        else if (code === "KeyW" || code === "ArrowUp") this.isSpeedUp = true;
        else if (code === "KeyS" || code === "ArrowDown") this.isSlowDown = true;
        else if (code === "Digit1") this._eventBus.emit("SPAWN_SLOT_REQUEST", 0);
        else if (code === "Digit2") this._eventBus.emit("SPAWN_SLOT_REQUEST", 1);
        else if (code === "Digit3") this._eventBus.emit("SPAWN_SLOT_REQUEST", 2);
        else if (code === "Digit4") this._eventBus.emit("SPAWN_SLOT_REQUEST", 3);
        else if (code === "Space") {
            e.preventDefault();
            if (!e.repeat) {
                this._eventBus.emit("SKILL_REQUEST");
            }
        } else if (code === "Escape") {
            if (!e.repeat) {
                this._eventBus.emit("PAUSE_TOGGLE");
            }
        }
    }

    _onKeyUp(e) {
        const code = e.code;
        if (code === "KeyG") {
            this._isKeyGDown = false;
            this._debugComboLatched = false;
        } else if (code === "F3") {
            this._isF3Down = false;
            this._debugComboLatched = false;
        }
        if (code === "KeyA" || code === "ArrowLeft") this.moveCamLeft = false;
        else if (code === "KeyD" || code === "ArrowRight") this.moveCamRight = false;
        else if (code === "KeyW" || code === "ArrowUp") this.isSpeedUp = false;
        else if (code === "KeyS" || code === "ArrowDown") this.isSlowDown = false;
    }

    setEdgeCameraInput(direction, isActive) {
        if (direction === "LEFT") this._edgeLeft = isActive;
        if (direction === "RIGHT") this._edgeRight = isActive;
    }

    getCameraDirection() {
        const left = this.moveCamLeft || this._edgeLeft;
        const right = this.moveCamRight || this._edgeRight;
        if (left && !right) return -1;
        if (right && !left) return 1;
        return 0;
    }

    getTimeScale() {
        if (this.isSpeedUp && !this.isSlowDown) return 2.0;
        if (this.isSlowDown && !this.isSpeedUp) return 0.5;
        return 1.0;
    }

    resetAll() {
        this.moveCamLeft = false;
        this.moveCamRight = false;
        this.isSpeedUp = false;
        this.isSlowDown = false;
        this._edgeLeft = false;
        this._edgeRight = false;
        this._isKeyGDown = false;
        this._isF3Down = false;
        this._debugComboLatched = false;
    }
}
