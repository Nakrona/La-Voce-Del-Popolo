"use strict";

/**
 * Static base structure entity (Panggung Utama on left, Markas Polisi on right).
 * Substitutable anywhere an Entity/IDamageable/IInspectable target is expected (LSP).
 */
class BaseStructure extends Entity {
    constructor(x, maxHp, faction, label) {
        super(x, 120, 150, maxHp, faction);
        this.label = label;
    }

    getHpRatio() {
        return this.maxHp > 0 ? this.hp / this.maxHp : 0;
    }

    toTooltipData() {
        const isPlayer = this.faction === FACTIONS.PLAYER;
        return {
            title: this.label,
            subtitle: isPlayer ? "Markas Faksi Pendemo" : "Markas Faksi Kepolisian",
            factionKind: isPlayer ? "player" : "enemy",
            badgeText: `${Math.round(this.getHpRatio() * 100)}% HP`,
            hpCurrent: Math.ceil(this.hp),
            hpMax: this.maxHp,
            stats: [
                { label: "Status", value: "Struktur Statis" },
                { label: "Posisi X", value: `${this.x} px` },
                { label: "Kondisi", value: isPlayer ? "Jaga jangan sampai 0 HP" : "Hancurkan untuk Menang" }
            ],
            note: isPlayer
                ? "Titik spawn seluruh massa aksi (Orator berorasi dari atas panggung)."
                : "Markas pertahanan polisi. Runtuh = Victory!"
        };
    }
}
