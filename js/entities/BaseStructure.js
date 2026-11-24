"use strict";

/**
 * Static base structure entity (Panggung Utama on left, Markas Polisi on right).
 * Substitutable anywhere an Entity/IDamageable/IInspectable target is expected (LSP).
 */
class BaseStructure extends Entity {
    constructor(x, maxHp, faction, label, options = {}) {
        super(x, 120, 150, maxHp, faction);
        this.label = label;
        const isPlayer = faction === FACTIONS.PLAYER;
        this.displayName = options.displayName || label;
        this.assetId = options.assetId || (isPlayer ? ASSET_IDS.BASE_PANGGUNG : ASSET_IDS.BASE_MARKAS);
        this.subtitle = options.subtitle || (isPlayer ? "Markas Faksi Pendemo" : "Markas Faksi Kepolisian");
        this.description = options.description || (isPlayer
            ? "Titik spawn seluruh massa aksi (Orator berorasi dari atas panggung)."
            : "Markas pertahanan polisi. Runtuh = Victory!");
    }

    getHpRatio() {
        return this.maxHp > 0 ? this.hp / this.maxHp : 0;
    }

    getAssetId() {
        return this.assetId;
    }

    toTooltipData() {
        const isPlayer = this.faction === FACTIONS.PLAYER;
        return {
            title: this.label,
            subtitle: this.subtitle,
            factionKind: isPlayer ? "player" : "enemy",
            badgeText: `${Math.round(this.getHpRatio() * 100)}% HP`,
            hpCurrent: Math.ceil(this.hp),
            hpMax: this.maxHp,
            stats: [
                { label: "Status", value: "Struktur Statis" },
                { label: "Posisi X", value: `${this.x} px` },
                { label: "Kondisi", value: isPlayer ? "Jaga jangan sampai 0 HP" : "Hancurkan untuk Menang" }
            ],
            note: this.description
        };
    }
}
