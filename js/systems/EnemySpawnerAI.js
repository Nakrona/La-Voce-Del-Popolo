"use strict";

/**
 * Controls enemy AI wave spawning per stage configuration.
 * Follows SRP and OCP: driven purely by stage wave definitions.
 */
class EnemySpawnerAI {
    constructor() {
        this._stageConfig = null;
        this._elapsed = 0;
        this._scheduledFired = [];
        this._nextPeriodicTime = 0;
        this._patternIndex = 0;
        this._emergencyTriggered = false;
    }

    resetForStage(stageConfig) {
        this._stageConfig = stageConfig;
        this._elapsed = 0;
        this._scheduledFired = stageConfig.scheduledEvents.map(() => false);
        this._nextPeriodicTime = stageConfig.periodicSpawn.startTime;
        this._patternIndex = 0;
        this._emergencyTriggered = false;
    }

    update(dtEff, enemyBase, spawnCallback) {
        if (!this._stageConfig) return;
        this._elapsed += dtEff;

        // 1. Scheduled scripted events
        const events = this._stageConfig.scheduledEvents;
        for (let i = 0; i < events.length; i++) {
            if (!this._scheduledFired[i] && this._elapsed >= events[i].time) {
                this._scheduledFired[i] = true;
                for (let c = 0; c < events[i].count; c++) {
                    spawnCallback(events[i].unit, c * 28);
                }
            }
        }

        // 2. Periodic waves
        const periodic = this._stageConfig.periodicSpawn;
        if (this._elapsed >= this._nextPeriodicTime) {
            const waveUnits = periodic.pattern[this._patternIndex % periodic.pattern.length];
            for (let i = 0; i < waveUnits.length; i++) {
                spawnCallback(waveUnits[i], i * 32);
            }
            this._patternIndex++;
            this._nextPeriodicTime += periodic.interval;
        }

        // 3. Emergency defense trigger when Enemy Base drops below HP threshold
        const emergency = this._stageConfig.emergencyWave;
        if (!this._emergencyTriggered && emergency && enemyBase.getHpRatio() <= emergency.hpThresholdRatio) {
            this._emergencyTriggered = true;
            for (let c = 0; c < emergency.count; c++) {
                spawnCallback(emergency.unit, c * 30);
            }
        }
    }
}
