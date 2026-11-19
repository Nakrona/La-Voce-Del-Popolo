"use strict";

/**
 * Lightweight EventBus implementing the Observer pattern.
 * Supports Dependency Inversion Principle (DIP) by decoupling gameplay systems from UI.
 */
class EventBus {
    constructor() {
        this._listeners = new Map();
    }

    on(eventName, callback) {
        if (!this._listeners.has(eventName)) {
            this._listeners.set(eventName, []);
        }
        this._listeners.get(eventName).push(callback);
    }

    emit(eventName, payload) {
        const callbacks = this._listeners.get(eventName);
        if (!callbacks) return;
        for (let i = 0; i < callbacks.length; i++) {
            callbacks[i](payload);
        }
    }
}
