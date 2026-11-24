"use strict";

/**
 * Abstract state contract for FiniteStateMachine (ISP & OCP).
 */
class IState {
    get name() {
        throw new Error("State must define a name getter.");
    }

    onEnter(context, payload) {}
    onUpdate(dt, context) {}
    onExit(context) {}
}

/**
 * Reusable deterministic Finite State Machine with reentrancy protection (DRY & SRP).
 * Shared across GameEngine lifecycle, Unit combat behaviors, and Tooltip UI states.
 */
class FiniteStateMachine {
    constructor(statesList, context, initialStateName) {
        this._context = context;
        this._states = new Map();
        for (let i = 0; i < statesList.length; i++) {
            const st = statesList[i];
            this._states.set(st.name, st);
        }

        this._currentState = null;
        this._previousStateName = null;
        this._isTransitioning = false;
        this._pendingTransition = null;

        if (initialStateName) {
            this.changeState(initialStateName);
        }
    }

    getCurrentStateName() {
        return this._currentState ? this._currentState.name : null;
    }

    getPreviousStateName() {
        return this._previousStateName;
    }

    isIn(stateName) {
        return this._currentState !== null && this._currentState.name === stateName;
    }

    changeState(nextStateName, payload = null) {
        const nextState = this._states.get(nextStateName);
        if (!nextState) {
            throw new Error(`Unknown FSM state: ${nextStateName}`);
        }
        if (this._currentState && this._currentState.name === nextStateName && payload === null) {
            return;
        }

        if (this._isTransitioning) {
            this._pendingTransition = { nextStateName, payload };
            return;
        }

        this._isTransitioning = true;
        try {
            if (this._currentState) {
                this._previousStateName = this._currentState.name;
                this._currentState.onExit(this._context);
            }
            this._currentState = nextState;
            this._currentState.onEnter(this._context, payload);
        } finally {
            this._isTransitioning = false;
        }

        if (this._pendingTransition) {
            const queued = this._pendingTransition;
            this._pendingTransition = null;
            this.changeState(queued.nextStateName, queued.payload);
        }
    }

    update(dt) {
        if (this._currentState) {
            this._currentState.onUpdate(dt, this._context);
        }
    }
}
