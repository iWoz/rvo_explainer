/**
 * Simulator — steps the simulation using a chosen algorithm.
 */
class Simulator {
    constructor() {
        this.agents = [];
        this.algorithm = 'RVO'; // 'VO', 'RVO', 'ORCA'
        this.timeHorizon = 5;
        this.dt = 1 / 60;
        this.time = 0;
        this.paused = true;
        this.stepCount = 0;

        // Per-agent debug data (cones / lines for rendering)
        this.debugData = new Map();
    }

    setAgents(agents) {
        this.agents = agents;
        this.time = 0;
        this.stepCount = 0;
        this.debugData.clear();
    }

    reset() {
        this.agents.forEach(a => a.reset());
        this.time = 0;
        this.stepCount = 0;
        this.debugData.clear();
    }

    allReachedGoal() {
        return this.agents.every(a => a.reachedGoal);
    }

    step() {
        this.debugData.clear();

        // 1. Compute preferred velocities
        for (const agent of this.agents) {
            agent.computePreferredVelocity();
        }

        // 2. Compute new velocities using the selected algorithm
        if (this.algorithm === 'NONE') {
            for (const agent of this.agents) {
                agent.newVelocity = agent.preferredVelocity.clone();
            }
        } else if (this.algorithm === 'VO' || this.algorithm === 'RVO') {
            this._stepVORVO();
        } else if (this.algorithm === 'ORCA') {
            this._stepORCA();
        }

        // 3. Update positions
        for (const agent of this.agents) {
            agent.update(this.dt);
        }

        this.time += this.dt;
        this.stepCount++;
    }

    _stepVORVO() {
        const isRVO = this.algorithm === 'RVO';
        for (const agent of this.agents) {
            const cones = [];
            for (const other of this.agents) {
                if (other.id === agent.id) continue;
                const cone = isRVO
                    ? Algorithms.computeRVOCone(agent, other, this.timeHorizon)
                    : Algorithms.computeVOCone(agent, other, this.timeHorizon);
                cone.otherAgent = other;
                cones.push(cone);
            }
            this.debugData.set(agent.id, { cones });
            agent.newVelocity = Algorithms.selectVelocity(
                cones, agent.preferredVelocity, agent.maxSpeed
            );
        }
    }

    _stepORCA() {
        for (const agent of this.agents) {
            const lines = [];
            // Also compute VO cones for visualization (using RVO shift)
            const cones = [];
            for (const other of this.agents) {
                if (other.id === agent.id) continue;
                const line = Algorithms.computeORCALine(agent, other, this.timeHorizon);
                line.otherAgent = other;
                lines.push(line);

                const cone = Algorithms.computeRVOCone(agent, other, this.timeHorizon);
                cone.otherAgent = other;
                cones.push(cone);
            }
            this.debugData.set(agent.id, { cones, orcaLines: lines });
            agent.newVelocity = Algorithms.selectVelocityORCA(
                lines, agent.preferredVelocity, agent.maxSpeed
            );
        }
    }
}
