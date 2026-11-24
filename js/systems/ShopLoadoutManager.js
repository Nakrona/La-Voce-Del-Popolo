"use strict";

/**
 * Manages Shop catalog purchases, persistent currency (Koin Aksi), owned roster,
 * and strict Loadout slot constraints: maximum 3 Regular units + 1 Global Buff unit (SRP, OCP, DIP).
 */
class ShopLoadoutManager {
    constructor(unitConfigs, storageService, eventBus, shopConfig = SHOP_CONFIG) {
        this._configs = unitConfigs;
        this._storage = storageService;
        this._eventBus = eventBus;
        this._shopCfg = shopConfig;

        this._coins = 0;
        this._ownedUnits = new Set();
        this._regularSlots = [null, null, null];
        this._globalBuffSlot = null;

        this.reloadFromStorage();
    }

    reloadFromStorage() {
        this._coins = Math.max(0, Math.floor(this._storage.getCoins() || 0));

        const defaults = this._shopCfg.DEFAULT_OWNED_UNITS;
        const storedOwned = this._storage.getOwnedUnits();
        this._ownedUnits = new Set(defaults);
        if (Array.isArray(storedOwned)) {
            for (let i = 0; i < storedOwned.length; i++) {
                const key = storedOwned[i];
                if (this._isPlayerUnit(key)) {
                    this._ownedUnits.add(key);
                }
            }
        }
        this._storage.saveOwnedUnits(Array.from(this._ownedUnits));

        const storedLoadout = this._storage.getLoadout();
        this._applySanitizedLoadout(storedLoadout);
        this._persistLoadout();
    }

    _isPlayerUnit(unitKey) {
        const cfg = this._configs[unitKey];
        return Boolean(cfg && cfg.faction === FACTIONS.PLAYER);
    }

    _applySanitizedLoadout(raw) {
        const fallbackReg = [...this._shopCfg.DEFAULT_REGULAR_SLOTS];
        const fallbackBuff = this._shopCfg.DEFAULT_GLOBAL_BUFF_SLOT;

        if (!raw || !Array.isArray(raw.regular)) {
            this._regularSlots = fallbackReg.slice(0, this._shopCfg.MAX_REGULAR_SLOTS);
            this._globalBuffSlot = this._ownedUnits.has(fallbackBuff) ? fallbackBuff : null;
            return;
        }

        const seen = new Set();
        const sanitizedReg = [];
        for (let i = 0; i < this._shopCfg.MAX_REGULAR_SLOTS; i++) {
            const key = raw.regular[i];
            if (key && this._ownedUnits.has(key) && !seen.has(key) && this._configs[key].slotCategory === UNIT_SLOT_CATEGORIES.REGULAR) {
                sanitizedReg.push(key);
                seen.add(key);
            } else {
                sanitizedReg.push(null);
            }
        }
        this._regularSlots = sanitizedReg;

        const rawBuff = raw.globalBuff;
        if (rawBuff && this._ownedUnits.has(rawBuff) && this._configs[rawBuff].slotCategory === UNIT_SLOT_CATEGORIES.GLOBAL_BUFF) {
            this._globalBuffSlot = rawBuff;
        } else {
            this._globalBuffSlot = null;
        }
    }

    _persistLoadout() {
        this._storage.saveLoadout({
            regular: [...this._regularSlots],
            globalBuff: this._globalBuffSlot
        });
    }

    getCoins() {
        return this._coins;
    }

    awardStageCoins(stageCfg, wasAlreadyCleared) {
        if (!stageCfg || !stageCfg.coinReward) return 0;
        const ratio = wasAlreadyCleared ? (this._shopCfg.REPLAY_COIN_RATIO || 0.6) : 1.0;
        const earned = Math.max(10, Math.round(stageCfg.coinReward * ratio));
        this._coins += earned;
        this._storage.saveCoins(this._coins);
        return earned;
    }

    isOwned(unitKey) {
        return this._ownedUnits.has(unitKey);
    }

    isEquipped(unitKey) {
        return this._regularSlots.includes(unitKey) || this._globalBuffSlot === unitKey;
    }

    getRegularSlots() {
        return [...this._regularSlots];
    }

    getGlobalBuffSlot() {
        return this._globalBuffSlot;
    }

    getEquippedRegularCount() {
        let count = 0;
        for (let i = 0; i < this._regularSlots.length; i++) {
            if (this._regularSlots[i]) count++;
        }
        return count;
    }

    /**
     * Returns strict 4-slot binding [Regular0, Regular1, Regular2, GlobalBuff] mapped to HUD & keys 1..4.
     */
    getHudSlotKeys() {
        return [...this._regularSlots, this._globalBuffSlot];
    }

    getSlotUnitKey(slotIndex) {
        if (slotIndex >= 0 && slotIndex < this._shopCfg.MAX_REGULAR_SLOTS) {
            return this._regularSlots[slotIndex] || null;
        }
        if (slotIndex === this._shopCfg.MAX_REGULAR_SLOTS) {
            return this._globalBuffSlot || null;
        }
        return null;
    }

    getCatalogUnits(categoryFilter = "ALL") {
        const list = [];
        const keys = Object.keys(this._configs);
        for (let i = 0; i < keys.length; i++) {
            const cfg = this._configs[keys[i]];
            if (cfg.faction !== FACTIONS.PLAYER) continue;
            if (categoryFilter === "REGULAR" && cfg.slotCategory !== UNIT_SLOT_CATEGORIES.REGULAR) continue;
            if (categoryFilter === "GLOBAL_BUFF" && cfg.slotCategory !== UNIT_SLOT_CATEGORIES.GLOBAL_BUFF) continue;
            list.push(cfg);
        }
        return list;
    }

    canBuyUnit(unitKey) {
        const cfg = this._configs[unitKey];
        if (!cfg || cfg.faction !== FACTIONS.PLAYER) return false;
        if (this.isOwned(unitKey)) return false;
        return this._coins >= (cfg.shopPrice || 0);
    }

    buyUnit(unitKey) {
        const cfg = this._configs[unitKey];
        if (!cfg || cfg.faction !== FACTIONS.PLAYER) {
            return { ok: false, reason: "INVALID_UNIT" };
        }
        if (this.isOwned(unitKey)) {
            return { ok: false, reason: "ALREADY_OWNED" };
        }
        const price = cfg.shopPrice || 0;
        if (this._coins < price) {
            this._eventBus.emit("SHOP_ERROR_SFX");
            return { ok: false, reason: "INSUFFICIENT_COINS" };
        }

        this._coins -= price;
        this._storage.saveCoins(this._coins);
        this._ownedUnits.add(unitKey);
        this._storage.saveOwnedUnits(Array.from(this._ownedUnits));

        // Convenience auto-equip if an open slot exists in that unit's category
        let autoEquipped = false;
        if (cfg.slotCategory === UNIT_SLOT_CATEGORIES.REGULAR) {
            const emptyIdx = this._regularSlots.indexOf(null);
            if (emptyIdx >= 0) {
                this._regularSlots[emptyIdx] = unitKey;
                this._persistLoadout();
                autoEquipped = true;
            }
        } else if (cfg.slotCategory === UNIT_SLOT_CATEGORIES.GLOBAL_BUFF && !this._globalBuffSlot) {
            this._globalBuffSlot = unitKey;
            this._persistLoadout();
            autoEquipped = true;
        }

        this._eventBus.emit("SHOP_BUY_SFX", { unitKey });
        this._eventBus.emit("LOADOUT_CHANGED");
        return { ok: true, autoEquipped };
    }

    equipUnit(unitKey) {
        const cfg = this._configs[unitKey];
        if (!cfg || !this.isOwned(unitKey)) {
            this._eventBus.emit("SHOP_ERROR_SFX");
            return { ok: false, reason: "NOT_OWNED" };
        }
        if (this.isEquipped(unitKey)) {
            return { ok: true, alreadyEquipped: true };
        }

        if (cfg.slotCategory === UNIT_SLOT_CATEGORIES.GLOBAL_BUFF) {
            this._globalBuffSlot = unitKey;
            this._persistLoadout();
            this._eventBus.emit("SHOP_EQUIP_SFX", { unitKey });
            this._eventBus.emit("LOADOUT_CHANGED");
            return { ok: true };
        }

        const emptyIndex = this._regularSlots.indexOf(null);
        if (emptyIndex === -1) {
            this._eventBus.emit("SHOP_ERROR_SFX");
            return { ok: false, reason: "SLOTS_FULL" };
        }

        this._regularSlots[emptyIndex] = unitKey;
        this._persistLoadout();
        this._eventBus.emit("SHOP_EQUIP_SFX", { unitKey });
        this._eventBus.emit("LOADOUT_CHANGED");
        return { ok: true, slotIndex: emptyIndex };
    }

    unequipUnit(unitKey) {
        const regIdx = this._regularSlots.indexOf(unitKey);
        if (regIdx >= 0) {
            this._regularSlots[regIdx] = null;
            this._persistLoadout();
            this._eventBus.emit("SHOP_UNEQUIP_SFX", { unitKey });
            this._eventBus.emit("LOADOUT_CHANGED");
            return { ok: true };
        }
        if (this._globalBuffSlot === unitKey) {
            this._globalBuffSlot = null;
            this._persistLoadout();
            this._eventBus.emit("SHOP_UNEQUIP_SFX", { unitKey });
            this._eventBus.emit("LOADOUT_CHANGED");
            return { ok: true };
        }
        return { ok: false, reason: "NOT_EQUIPPED" };
    }

    unequipSlot(category, index = 0) {
        if (category === UNIT_SLOT_CATEGORIES.GLOBAL_BUFF) {
            if (!this._globalBuffSlot) return { ok: false };
            const prev = this._globalBuffSlot;
            this._globalBuffSlot = null;
            this._persistLoadout();
            this._eventBus.emit("SHOP_UNEQUIP_SFX", { unitKey: prev });
            this._eventBus.emit("LOADOUT_CHANGED");
            return { ok: true };
        }
        if (index >= 0 && index < this._regularSlots.length && this._regularSlots[index]) {
            const prev = this._regularSlots[index];
            this._regularSlots[index] = null;
            this._persistLoadout();
            this._eventBus.emit("SHOP_UNEQUIP_SFX", { unitKey: prev });
            this._eventBus.emit("LOADOUT_CHANGED");
            return { ok: true };
        }
        return { ok: false };
    }

    canEnterBattle() {
        return this.getEquippedRegularCount() >= 1;
    }

    resetAll() {
        this._coins = 0;
        this._ownedUnits = new Set(this._shopCfg.DEFAULT_OWNED_UNITS);
        this._regularSlots = [...this._shopCfg.DEFAULT_REGULAR_SLOTS];
        this._globalBuffSlot = this._shopCfg.DEFAULT_GLOBAL_BUFF_SLOT;
        this._storage.saveCoins(0);
        this._storage.saveOwnedUnits(Array.from(this._ownedUnits));
        this._persistLoadout();
        this._eventBus.emit("LOADOUT_CHANGED");
    }
}
