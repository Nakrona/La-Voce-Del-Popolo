"use strict";

/**
 * Manages horizontal side-scrolling viewport clamped strictly within world boundaries.
 * Uses unscaled raw delta time (dtRaw) so camera remains responsive during Slow-Mo.
 */
class Camera {
    constructor(worldWidth, viewportWidth, panSpeed) {
        this._worldWidth = worldWidth;
        this._viewportWidth = viewportWidth;
        this._panSpeed = panSpeed;
        this.x = 0;
    }

    get maxX() {
        return Math.max(0, this._worldWidth - this._viewportWidth);
    }

    reset() {
        this.x = 0;
    }

    update(dtRaw, direction) {
        if (direction === 0) return;
        this.x += direction * this._panSpeed * dtRaw;
        if (this.x < 0) this.x = 0;
        if (this.x > this.maxX) this.x = this.maxX;
    }

    isVisible(entityX, entityWidth, margin = 80) {
        const halfW = entityWidth * 0.5;
        return (entityX + halfW >= this.x - margin) &&
               (entityX - halfW <= this.x + this._viewportWidth + margin);
    }
}
