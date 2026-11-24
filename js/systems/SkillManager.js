"use strict";

/**
 * Coordinates the equipped ActiveSkill lifecycle and exposes clean UI state (SRP & DIP).
 * Depends only on the ActiveSkill abstraction, never concrete skill classes.
 */
class SkillManager {
    constructor(activeSkill) {
        this._activeSkill = activeSkill;
    }

    resetForStage() {
        if (this._activeSkill) {
            this._activeSkill.reset();
        }
    }

    activate(skillContext) {
        if (!this._activeSkill) return false;
        return this._activeSkill.activate(skillContext);
    }

    update(dtEff, skillContext) {
        if (!this._activeSkill) return;
        this._activeSkill.update(dtEff, skillContext);
    }

    getUiState() {
        if (!this._activeSkill) {
            return {
                name: "-",
                isReady: false,
                isActive: false,
                remainingCooldown: 0,
                cooldownProgress: 1
            };
        }
        return {
            name: this._activeSkill.name,
            isReady: this._activeSkill.isReady(),
            isActive: this._activeSkill.isActive(),
            remainingCooldown: this._activeSkill.remainingCooldown,
            cooldownProgress: this._activeSkill.getCooldownProgress()
        };
    }
}
