"use strict";

/**
 * Manages pooled DOM <img> elements synced over the Canvas so animated .gif assets
 * play all frames natively at full framerate across file:// and HTTPS browsers (SRP).
 */
class DomSpriteLayer {
    constructor(overlayEl, bgCityImgEl, bgRoadImgEl) {
        this._overlayEl = overlayEl;
        this._bgCityImgEl = bgCityImgEl;
        this._bgRoadImgEl = bgRoadImgEl;
        this._spritePool = new Map(); // Entity/Object -> HTMLImageElement
        this._activeThisFrame = new Set();
    }

    beginFrame() {
        this._activeThisFrame.clear();
    }

    syncEnvironment(assetService, cameraX, viewportW) {
        this._syncBgLayer(this._bgCityImgEl, assetService, ASSET_IDS.ENV_BG_CITY);
        this._syncBgLayer(this._bgRoadImgEl, assetService, ASSET_IDS.ENV_ROAD);
    }

    _syncBgLayer(imgEl, assetService, assetId) {
        if (!imgEl) return;
        if (assetService && assetService.isGif(assetId)) {
            const url = assetService.getSourceUrl(assetId);
            if (imgEl.dataset.srcUrl !== url) {
                imgEl.src = url;
                imgEl.dataset.srcUrl = url;
            }
            imgEl.classList.remove("hidden");
        } else {
            imgEl.classList.add("hidden");
        }
    }

    syncEntity(entity, srcUrl, { x, y, width, height, cameraX, flipX = false, rotationRad = 0, hitFlash = false, slowed = false, hovered = false }) {
        if (!this._overlayEl || !srcUrl) return;
        this._activeThisFrame.add(entity);

        let img = this._spritePool.get(entity);
        if (!img) {
            img = document.createElement("img");
            img.className = "dom-gif-sprite";
            img.alt = "";
            img.draggable = false;
            this._overlayEl.appendChild(img);
            this._spritePool.set(entity, img);
        }

        if (img.dataset.srcUrl !== srcUrl) {
            img.src = srcUrl;
            img.dataset.srcUrl = srcUrl;
        }

        const viewLeftPct = ((x - cameraX) / WORLD_CONFIG.VIEWPORT_WIDTH) * 100;
        const viewWidthPct = (width / WORLD_CONFIG.VIEWPORT_WIDTH) * 100;

        if (viewLeftPct + viewWidthPct < -6 || viewLeftPct > 106) {
            img.style.display = "none";
            return;
        }

        const viewTopPct = (y / WORLD_CONFIG.VIEWPORT_HEIGHT) * 100;
        const viewHeightPct = (height / WORLD_CONFIG.VIEWPORT_HEIGHT) * 100;

        img.style.display = "block";
        img.style.left = `${viewLeftPct}%`;
        img.style.top = `${viewTopPct}%`;
        img.style.width = `${viewWidthPct}%`;
        img.style.height = `${viewHeightPct}%`;

        const transforms = [];
        if (flipX) transforms.push("scaleX(-1)");
        if (rotationRad !== 0) transforms.push(`rotate(${rotationRad.toFixed(3)}rad)`);
        img.style.transform = transforms.join(" ");

        if (hitFlash) {
            img.style.filter = "brightness(2.4)";
        } else if (slowed) {
            img.style.filter = "drop-shadow(0 0 4px #38bdf8)";
        } else {
            img.style.filter = "";
        }

        img.style.outline = hovered ? "2px dashed #fbbf24" : "";
    }

    endFrame() {
        for (const [entity, img] of this._spritePool.entries()) {
            if (!this._activeThisFrame.has(entity)) {
                img.remove();
                this._spritePool.delete(entity);
            }
        }
    }

    clearAll() {
        for (const img of this._spritePool.values()) {
            img.remove();
        }
        this._spritePool.clear();
        this._activeThisFrame.clear();
    }
}
