// roundRect polyfill for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
        const r = typeof radii === 'number' ? radii : (radii && radii[0]) || 0;
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
    };
}

/**
 * Renderer — draws simulation state on a canvas.
 * Supports world-space view and velocity-space inset.
 */
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.showVOCones = true;
        this.showVelocities = true;
        this.showGoals = true;
        this.showTrails = true;
        this.showVelocitySpace = true;

        // Trails
        this.trails = new Map();
        this.maxTrailLength = 120;

        // Colors
        this.bgColor = '#0f1923';
        this.gridColor = 'rgba(255,255,255,0.04)';
    }

    clear() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = this.bgColor;
        ctx.fillRect(0, 0, w, h);

        // Grid
        ctx.strokeStyle = this.gridColor;
        ctx.lineWidth = 1;
        const gridSize = 40;
        for (let x = gridSize; x < w; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = gridSize; y < h; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
    }

    recordTrail(agent) {
        if (!this.trails.has(agent.id)) {
            this.trails.set(agent.id, []);
        }
        const trail = this.trails.get(agent.id);
        trail.push(agent.position.clone());
        if (trail.length > this.maxTrailLength) trail.shift();
    }

    clearTrails() {
        this.trails.clear();
    }

    drawTrail(agent) {
        if (!this.showTrails) return;
        const trail = this.trails.get(agent.id);
        if (!trail || trail.length < 2) return;
        const ctx = this.ctx;

        for (let i = 1; i < trail.length; i++) {
            const alpha = (i / trail.length) * 0.4;
            ctx.beginPath();
            ctx.strokeStyle = agent.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
            ctx.lineWidth = 2;
            ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
            ctx.lineTo(trail[i].x, trail[i].y);
            ctx.stroke();
        }
    }

    drawAgent(agent) {
        const ctx = this.ctx;
        const p = agent.position;

        // Glow for selected agent
        if (agent.selected) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, agent.radius + 6, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Body
        ctx.beginPath();
        ctx.arc(p.x, p.y, agent.radius, 0, Math.PI * 2);
        ctx.fillStyle = agent.color;
        ctx.globalAlpha = agent.reachedGoal ? 0.4 : 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Direction indicator
        if (agent.velocity.length() > 1) {
            const dir = agent.velocity.normalize();
            ctx.beginPath();
            ctx.arc(p.x + dir.x * agent.radius * 0.5, p.y + dir.y * agent.radius * 0.5,
                3, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        }

        // ID label
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(agent.id, p.x, p.y);
    }

    drawGoal(agent) {
        if (!this.showGoals) return;
        const ctx = this.ctx;
        const g = agent.goal;

        // Goal cross
        const s = 6;
        ctx.strokeStyle = agent.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(g.x - s, g.y - s);
        ctx.lineTo(g.x + s, g.y + s);
        ctx.moveTo(g.x + s, g.y - s);
        ctx.lineTo(g.x - s, g.y + s);
        ctx.stroke();

        // Circle
        ctx.beginPath();
        ctx.arc(g.x, g.y, s + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Dashed line from agent to goal
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = agent.color + '40';
        ctx.lineWidth = 1;
        ctx.moveTo(agent.position.x, agent.position.y);
        ctx.lineTo(g.x, g.y);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    drawVelocityArrow(agent) {
        if (!this.showVelocities) return;
        const ctx = this.ctx;
        const p = agent.position;
        // Scale velocity vectors for visibility (0.5 = half length)
        const vs = 0.5;

        // Preferred velocity (green, dashed)
        if (agent.preferredVelocity.length() > 1) {
            const pv = agent.preferredVelocity.scale(vs);
            this._drawArrow(ctx, p.x, p.y, p.x + pv.x, p.y + pv.y,
                'rgba(46,204,113,0.6)', 1.5, [4, 3]);
        }

        // Actual velocity (white, solid)
        if (agent.velocity.length() > 1) {
            const v = agent.velocity.scale(vs);
            this._drawArrow(ctx, p.x, p.y, p.x + v.x, p.y + v.y,
                '#ffffff', 2, []);
        }
    }

    drawVOCones(agent, debugData) {
        if (!this.showVOCones || !debugData) return;
        const ctx = this.ctx;
        const cones = debugData.cones;
        if (!cones) return;

        for (const cone of cones) {
            if (cone.overlapping) continue;
            this._drawCone(ctx, cone, agent);
        }

        // Draw ORCA lines if available
        if (debugData.orcaLines) {
            for (const line of debugData.orcaLines) {
                this._drawORCALine(ctx, line, agent);
            }
        }
    }

    _drawCone(ctx, cone, agent) {
        // In world-space, draw the cone centered at the agent's position,
        // using the cone's angular spread to show which directions are blocked.
        const drawDist = 400;
        const origin = agent.position;
        ctx.save();

        const otherColor = cone.otherAgent ? cone.otherAgent.color : '#E74C3C';
        ctx.fillStyle = otherColor;
        ctx.globalAlpha = 0.06;

        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);

        const leftEnd = origin.add(Vec2.fromAngle(cone.leftAngle, drawDist));

        ctx.lineTo(leftEnd.x, leftEnd.y);
        ctx.arc(origin.x, origin.y, drawDist,
            cone.leftAngle, cone.rightAngle, false);
        ctx.closePath();
        ctx.fill();

        // Cone edges
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = otherColor;
        ctx.lineWidth = 1;
        const rightEnd = origin.add(Vec2.fromAngle(cone.rightAngle, drawDist));
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(leftEnd.x, leftEnd.y);
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(rightEnd.x, rightEnd.y);
        ctx.stroke();

        ctx.restore();
    }

    _drawORCALine(ctx, line, agent) {
        // In world-space, draw ORCA lines offset from the agent's position
        // (they're in velocity space, so we just show them as indicators near the agent)
        ctx.save();
        const p = agent.position;
        const len = 60;
        const lp = line.point;
        const center = new Vec2(p.x + lp.x * 0.5, p.y + lp.y * 0.5);
        const p1 = center.add(line.direction.scale(len));
        const p2 = center.sub(line.direction.scale(len));

        ctx.strokeStyle = 'rgba(241,196,15,0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    /**
     * Draw velocity-space inset for the selected agent.
     */
    drawVelocitySpace(agent, debugData, x, y, size) {
        if (!this.showVelocitySpace || !agent) return;
        const ctx = this.ctx;
        const half = size / 2;
        const cx = x + half;
        const cy = y + half;
        const scale = half / (agent.maxSpeed * 1.3);

        ctx.save();

        // Background
        ctx.fillStyle = 'rgba(10, 15, 25, 0.92)';
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, 8);
        ctx.fill();
        ctx.stroke();

        // Clip to inset
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, 8);
        ctx.clip();

        // Max speed circle
        ctx.beginPath();
        ctx.arc(cx, cy, agent.maxSpeed * scale, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Crosshair
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.moveTo(x, cy);
        ctx.lineTo(x + size, cy);
        ctx.moveTo(cx, y);
        ctx.lineTo(cx, y + size);
        ctx.stroke();

        // Draw VO/RVO cones in velocity space
        if (debugData && debugData.cones) {
            for (const cone of debugData.cones) {
                if (cone.overlapping) continue;
                this._drawVelSpaceCone(ctx, cone, cx, cy, scale);
            }
        }

        // Draw ORCA lines in velocity space
        if (debugData && debugData.orcaLines) {
            for (const line of debugData.orcaLines) {
                const p = new Vec2(cx + line.point.x * scale, cy + line.point.y * scale);
                const d = line.direction.scale(size);
                ctx.beginPath();
                ctx.moveTo(p.x - d.x, p.y - d.y);
                ctx.lineTo(p.x + d.x, p.y + d.y);
                ctx.strokeStyle = 'rgba(241,196,15,0.5)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 3]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        // Preferred velocity (green dot + arrow)
        if (agent.preferredVelocity) {
            const pv = agent.preferredVelocity;
            const pvx = cx + pv.x * scale;
            const pvy = cy + pv.y * scale;
            this._drawArrow(ctx, cx, cy, pvx, pvy, 'rgba(46,204,113,0.8)', 1.5, [3, 2]);
            ctx.beginPath();
            ctx.arc(pvx, pvy, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#2ecc71';
            ctx.fill();
        }

        // Chosen velocity (blue/white dot + arrow)
        if (agent.velocity && agent.velocity.length() > 0.5) {
            const v = agent.velocity;
            const vx = cx + v.x * scale;
            const vy = cy + v.y * scale;
            this._drawArrow(ctx, cx, cy, vx, vy, '#fff', 2, []);
            ctx.beginPath();
            ctx.arc(vx, vy, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        }

        // Labels
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('速度空间 · Agent ' + agent.id, x + 8, y + 16);

        // Legend
        const ly = y + size - 10;
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(x + 8, ly - 8, 8, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('期望', x + 20, ly);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 58, ly - 8, 8, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('实际', x + 70, ly);

        ctx.restore();
    }

    _drawVelSpaceCone(ctx, cone, cx, cy, scale) {
        const drawDist = 500;
        ctx.save();

        const apexX = cx + cone.apex.x * scale;
        const apexY = cy + cone.apex.y * scale;

        const otherColor = cone.otherAgent ? cone.otherAgent.color : '#E74C3C';
        ctx.fillStyle = otherColor;
        ctx.globalAlpha = 0.15;

        ctx.beginPath();
        ctx.moveTo(apexX, apexY);

        const leftEnd = new Vec2(
            apexX + Math.cos(cone.leftAngle) * drawDist,
            apexY + Math.sin(cone.leftAngle) * drawDist
        );
        const rightEnd = new Vec2(
            apexX + Math.cos(cone.rightAngle) * drawDist,
            apexY + Math.sin(cone.rightAngle) * drawDist
        );

        ctx.lineTo(leftEnd.x, leftEnd.y);
        ctx.arc(apexX, apexY, drawDist, cone.leftAngle, cone.rightAngle, false);
        ctx.closePath();
        ctx.fill();

        // Edges
        ctx.strokeStyle = otherColor;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(apexX, apexY);
        ctx.lineTo(leftEnd.x, leftEnd.y);
        ctx.moveTo(apexX, apexY);
        ctx.lineTo(rightEnd.x, rightEnd.y);
        ctx.stroke();

        // Apex dot
        ctx.beginPath();
        ctx.arc(apexX, apexY, 2.5, 0, Math.PI * 2);
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = otherColor;
        ctx.fill();

        ctx.restore();
    }

    _drawArrow(ctx, x1, y1, x2, y2, color, width, dash) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 2) return;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrowhead
        const headLen = Math.min(8, len * 0.3);
        const angle = Math.atan2(dy, dx);
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - 0.35), y2 - headLen * Math.sin(angle - 0.35));
        ctx.lineTo(x2 - headLen * Math.cos(angle + 0.35), y2 - headLen * Math.sin(angle + 0.35));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    /**
     * Draw the full frame for a simulation.
     */
    drawFrame(simulator) {
        this.clear();

        const selectedAgent = simulator.agents.find(a => a.selected);

        // Trails
        for (const agent of simulator.agents) {
            this.recordTrail(agent);
            this.drawTrail(agent);
        }

        // Goals
        for (const agent of simulator.agents) {
            this.drawGoal(agent);
        }

        // VO cones (for selected agent, or all if few agents)
        for (const agent of simulator.agents) {
            if (simulator.agents.length <= 4 || agent.selected) {
                const dd = simulator.debugData.get(agent.id);
                this.drawVOCones(agent, dd);
            }
        }

        // Velocity arrows
        for (const agent of simulator.agents) {
            this.drawVelocityArrow(agent);
        }

        // Agents
        for (const agent of simulator.agents) {
            this.drawAgent(agent);
        }

        // Velocity space inset
        if (selectedAgent) {
            const dd = simulator.debugData.get(selectedAgent.id);
            const insetSize = Math.min(220, this.canvas.width * 0.3);
            this.drawVelocitySpace(selectedAgent, dd,
                this.canvas.width - insetSize - 12, 12, insetSize);
        }

        // Info overlay
        this._drawInfo(simulator);
    }

    _drawInfo(simulator) {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`算法: ${simulator.algorithm}  |  t: ${simulator.time.toFixed(2)}s  |  步: ${simulator.stepCount}`,
            10, this.canvas.height - 10);
    }
}
