/**
 * Agent — a circular entity that navigates toward a goal.
 */
class Agent {
    static _nextId = 0;

    constructor(position, goal, options = {}) {
        this.id = Agent._nextId++;
        this.position = position.clone();
        this.goal = goal.clone();
        this.velocity = options.velocity ? options.velocity.clone() : Vec2.zero();
        this.radius = options.radius || 15;
        this.maxSpeed = options.maxSpeed || 80;
        this.color = options.color || '#4A90D9';
        this.preferredVelocity = Vec2.zero();
        this.newVelocity = Vec2.zero();

        // Visual state
        this.selected = false;
        this.reachedGoal = false;

        // Save initial state for reset
        this._initPosition = position.clone();
        this._initGoal = goal.clone();
        this._initVelocity = this.velocity.clone();
    }

    computePreferredVelocity() {
        const toGoal = this.goal.sub(this.position);
        const dist = toGoal.length();
        if (dist < 3) {
            this.preferredVelocity = Vec2.zero();
            this.reachedGoal = true;
        } else {
            this.preferredVelocity = toGoal.normalize().scale(
                Math.min(this.maxSpeed, dist * 2)
            );
            this.reachedGoal = false;
        }
    }

    update(dt) {
        this.velocity = this.newVelocity.clone();
        this.position = this.position.add(this.velocity.scale(dt));
    }

    reset() {
        this.position = this._initPosition.clone();
        this.goal = this._initGoal.clone();
        this.velocity = this._initVelocity.clone();
        this.preferredVelocity = Vec2.zero();
        this.newVelocity = Vec2.zero();
        this.reachedGoal = false;
    }

    clone() {
        const a = new Agent(this._initPosition, this._initGoal, {
            velocity: this._initVelocity,
            radius: this.radius,
            maxSpeed: this.maxSpeed,
            color: this.color
        });
        return a;
    }
}
