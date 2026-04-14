/**
 * Predefined scenarios for demonstrating VO/RVO.
 */
const Scenes = {

    COLORS: [
        '#4A90D9', '#E74C3C', '#2ECC71', '#F39C12',
        '#9B59B6', '#1ABC9C', '#E67E22', '#3498DB',
        '#E84393', '#00B894', '#FDCB6E', '#6C5CE7',
        '#FF7675', '#74B9FF', '#A29BFE', '#55E6C1'
    ],

    /**
     * Two agents head-on collision.
     */
    headOn(canvasW, canvasH) {
        const cy = canvasH / 2;
        const margin = 80;
        return [
            new Agent(new Vec2(margin, cy), new Vec2(canvasW - margin, cy),
                { color: '#4A90D9', radius: 18, maxSpeed: 80 }),
            new Agent(new Vec2(canvasW - margin, cy), new Vec2(margin, cy),
                { color: '#E74C3C', radius: 18, maxSpeed: 80 })
        ];
    },

    /**
     * Two agents crossing at 90 degrees.
     */
    crossPaths(canvasW, canvasH) {
        const cx = canvasW / 2;
        const cy = canvasH / 2;
        const d = Math.min(canvasW, canvasH) * 0.35;
        return [
            new Agent(new Vec2(cx - d, cy), new Vec2(cx + d, cy),
                { color: '#4A90D9', radius: 18, maxSpeed: 80 }),
            new Agent(new Vec2(cx, cy - d), new Vec2(cx, cy + d),
                { color: '#E74C3C', radius: 18, maxSpeed: 80 })
        ];
    },

    /**
     * Three agents in a triangle.
     */
    triangle(canvasW, canvasH) {
        const cx = canvasW / 2;
        const cy = canvasH / 2;
        const r = Math.min(canvasW, canvasH) * 0.3;
        const agents = [];
        for (let i = 0; i < 3; i++) {
            const angle = (2 * Math.PI * i) / 3 - Math.PI / 2;
            const oppAngle = angle + Math.PI;
            agents.push(new Agent(
                new Vec2(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r),
                new Vec2(cx + Math.cos(oppAngle) * r, cy + Math.sin(oppAngle) * r),
                { color: Scenes.COLORS[i], radius: 16, maxSpeed: 70 }
            ));
        }
        return agents;
    },

    /**
     * N agents in a circle, each heading to the opposite side.
     */
    circleSwap(canvasW, canvasH, n = 8) {
        const cx = canvasW / 2;
        const cy = canvasH / 2;
        const r = Math.min(canvasW, canvasH) * 0.35;
        const agents = [];
        for (let i = 0; i < n; i++) {
            const angle = (2 * Math.PI * i) / n;
            const oppAngle = angle + Math.PI;
            agents.push(new Agent(
                new Vec2(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r),
                new Vec2(cx + Math.cos(oppAngle) * r, cy + Math.sin(oppAngle) * r),
                { color: Scenes.COLORS[i % Scenes.COLORS.length], radius: 14, maxSpeed: 70 }
            ));
        }
        return agents;
    },

    /**
     * Two groups passing through a bottleneck.
     */
    bottleneck(canvasW, canvasH) {
        const agents = [];
        const rows = 3;
        const cols = 3;
        const spacing = 35;
        const leftX = 70;
        const rightX = canvasW - 70;
        const startY = canvasH / 2 - ((rows - 1) * spacing) / 2;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const idx = r * cols + c;
                // Left group → right
                agents.push(new Agent(
                    new Vec2(leftX + c * spacing, startY + r * spacing),
                    new Vec2(rightX - c * spacing, startY + r * spacing),
                    { color: Scenes.COLORS[idx % 8], radius: 12, maxSpeed: 65 }
                ));
                // Right group → left
                agents.push(new Agent(
                    new Vec2(rightX - c * spacing, startY + r * spacing + spacing * 0.5),
                    new Vec2(leftX + c * spacing, startY + r * spacing + spacing * 0.5),
                    { color: Scenes.COLORS[(idx + 8) % 16], radius: 12, maxSpeed: 65 }
                ));
            }
        }
        return agents;
    },

    /**
     * Four groups from four corners heading to opposite corners.
     */
    fourCorners(canvasW, canvasH) {
        const agents = [];
        const margin = 80;
        const groupSize = 4;
        const spread = 25;
        const corners = [
            { start: new Vec2(margin, margin), goal: new Vec2(canvasW - margin, canvasH - margin) },
            { start: new Vec2(canvasW - margin, margin), goal: new Vec2(margin, canvasH - margin) },
            { start: new Vec2(canvasW - margin, canvasH - margin), goal: new Vec2(margin, margin) },
            { start: new Vec2(margin, canvasH - margin), goal: new Vec2(canvasW - margin, margin) },
        ];

        let idx = 0;
        // Deterministic grid offsets within each group
        const positions = [
            new Vec2(-spread, -spread), new Vec2(spread, -spread),
            new Vec2(-spread, spread), new Vec2(spread, spread)
        ];
        for (const corner of corners) {
            for (let i = 0; i < groupSize; i++) {
                const offset = positions[i];
                agents.push(new Agent(
                    corner.start.add(offset),
                    corner.goal.add(offset.negate()),
                    { color: Scenes.COLORS[idx % 16], radius: 12, maxSpeed: 60 }
                ));
                idx++;
            }
        }
        return agents;
    },

    /**
     * Deadlock scenario: 4 agents at compass points.
     */
    deadlock(canvasW, canvasH) {
        const cx = canvasW / 2;
        const cy = canvasH / 2;
        const d = Math.min(canvasW, canvasH) * 0.32;
        return [
            new Agent(new Vec2(cx, cy - d), new Vec2(cx, cy + d),
                { color: '#4A90D9', radius: 16, maxSpeed: 75 }),
            new Agent(new Vec2(cx, cy + d), new Vec2(cx, cy - d),
                { color: '#E74C3C', radius: 16, maxSpeed: 75 }),
            new Agent(new Vec2(cx - d, cy), new Vec2(cx + d, cy),
                { color: '#2ECC71', radius: 16, maxSpeed: 75 }),
            new Agent(new Vec2(cx + d, cy), new Vec2(cx - d, cy),
                { color: '#F39C12', radius: 16, maxSpeed: 75 })
        ];
    },

    /** Scene list for UI */
    list() {
        return [
            { id: 'headOn', name: '正面相遇', desc: '两个智能体迎面而行' },
            { id: 'crossPaths', name: '十字交叉', desc: '两个智能体十字交叉' },
            { id: 'triangle', name: '三角交换', desc: '三个智能体三角对穿' },
            { id: 'circleSwap', name: '圆形交换', desc: '环形排列互换位置' },
            { id: 'bottleneck', name: '双向通行', desc: '两组智能体对向穿行' },
            { id: 'fourCorners', name: '四角穿越', desc: '四组从对角出发' },
            { id: 'deadlock', name: '十字对穿', desc: '四向互相穿越' }
        ];
    },

    /** Create agents for a scene by id */
    create(id, canvasW, canvasH) {
        switch (id) {
            case 'headOn': return Scenes.headOn(canvasW, canvasH);
            case 'crossPaths': return Scenes.crossPaths(canvasW, canvasH);
            case 'triangle': return Scenes.triangle(canvasW, canvasH);
            case 'circleSwap': return Scenes.circleSwap(canvasW, canvasH);
            case 'bottleneck': return Scenes.bottleneck(canvasW, canvasH);
            case 'fourCorners': return Scenes.fourCorners(canvasW, canvasH);
            case 'deadlock': return Scenes.deadlock(canvasW, canvasH);
            default: return Scenes.headOn(canvasW, canvasH);
        }
    }
};
