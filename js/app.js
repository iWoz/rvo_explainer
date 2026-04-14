/**
 * Main application controller.
 * Manages tabs, simulations, UI bindings, and the animation loop.
 */
class App {
    constructor() {
        // ── Tab: 算法对比 (Comparison) ──────────────────────
        this.compCanvasL = document.getElementById('comp-canvas-left');
        this.compCanvasR = document.getElementById('comp-canvas-right');
        this.rendererL = new Renderer(this.compCanvasL);
        this.rendererR = new Renderer(this.compCanvasR);
        this.simL = new Simulator();
        this.simR = new Simulator();

        // ── Tab: 自由实验 (Playground) ──────────────────────
        this.playCanvas = document.getElementById('play-canvas');
        this.rendererP = new Renderer(this.playCanvas);
        this.simP = new Simulator();

        // ── State ───────────────────────────────────────────
        this.activeTab = 'theory';
        this.animFrameId = null;
        this.lastTime = 0;

        // Comparison state
        this.compScene = 'headOn';
        this.compAlgoL = 'VO';
        this.compAlgoR = 'RVO';
        this.compRunning = false;

        // Playground state
        this.playScene = 'circleSwap';
        this.playAlgo = 'RVO';
        this.playRunning = false;
        this.playPlacingAgent = false;
        this.playTempStart = null;

        // Theory state
        this.theoryCanvas = document.getElementById('theory-canvas');
        this.rendererT = new Renderer(this.theoryCanvas);
        this.simT = new Simulator();
        this.theoryStep = 0;
        this.theoryRunning = false;
        this.theoryAlgo = 'RVO';

        this._init();
    }

    _init() {
        this._resizeCanvases();
        window.addEventListener('resize', () => this._resizeCanvases());

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
        });

        // ── Theory controls ─────────────────────────────────
        document.getElementById('theory-algo').addEventListener('change', e => {
            this.theoryAlgo = e.target.value;
            this.simT.algorithm = this.theoryAlgo;
            this._resetTheory();
        });
        document.getElementById('theory-play').addEventListener('click', () => {
            this.theoryRunning = !this.theoryRunning;
            document.getElementById('theory-play').textContent = this.theoryRunning ? '⏸ 暂停' : '▶ 播放';
        });
        document.getElementById('theory-reset').addEventListener('click', () => {
            this._resetTheory();
        });
        document.getElementById('theory-step').addEventListener('click', () => {
            this.theoryRunning = false;
            document.getElementById('theory-play').textContent = '▶ 播放';
            this.simT.step();
        });

        // ── Comparison controls ─────────────────────────────
        document.getElementById('comp-scene').addEventListener('change', e => {
            this.compScene = e.target.value;
            this._resetComparison();
        });
        document.getElementById('comp-algo-left').addEventListener('change', e => {
            this.compAlgoL = e.target.value;
            this.simL.algorithm = this.compAlgoL;
            document.getElementById('comp-label-left').textContent = this.compAlgoL === 'NONE' ? '无避障' : this.compAlgoL;
            this._resetComparison();
        });
        document.getElementById('comp-algo-right').addEventListener('change', e => {
            this.compAlgoR = e.target.value;
            this.simR.algorithm = this.compAlgoR;
            document.getElementById('comp-label-right').textContent = this.compAlgoR === 'NONE' ? '无避障' : this.compAlgoR;
            this._resetComparison();
        });
        document.getElementById('comp-play').addEventListener('click', () => {
            this.compRunning = !this.compRunning;
            document.getElementById('comp-play').textContent = this.compRunning ? '⏸ 暂停' : '▶ 播放';
        });
        document.getElementById('comp-reset').addEventListener('click', () => {
            this._resetComparison();
        });
        document.getElementById('comp-step').addEventListener('click', () => {
            this.compRunning = false;
            document.getElementById('comp-play').textContent = '▶ 播放';
            this.simL.step();
            this.simR.step();
        });

        // ── Playground controls ─────────────────────────────
        document.getElementById('play-scene').addEventListener('change', e => {
            this.playScene = e.target.value;
            this._resetPlayground();
        });
        document.getElementById('play-algo').addEventListener('change', e => {
            this.playAlgo = e.target.value;
            this.simP.algorithm = this.playAlgo;
        });
        document.getElementById('play-play').addEventListener('click', () => {
            this.playRunning = !this.playRunning;
            document.getElementById('play-play').textContent = this.playRunning ? '⏸ 暂停' : '▶ 播放';
        });
        document.getElementById('play-reset').addEventListener('click', () => {
            this._resetPlayground();
        });
        document.getElementById('play-step').addEventListener('click', () => {
            this.playRunning = false;
            document.getElementById('play-play').textContent = '▶ 播放';
            this.simP.step();
        });

        // Time horizon slider
        document.getElementById('play-horizon').addEventListener('input', e => {
            const val = parseFloat(e.target.value);
            document.getElementById('play-horizon-val').textContent = val.toFixed(1);
            this.simP.timeHorizon = val;
            this.simL.timeHorizon = val;
            this.simR.timeHorizon = val;
            this.simT.timeHorizon = val;
        });

        // Speed slider
        document.getElementById('play-speed').addEventListener('input', e => {
            const val = parseFloat(e.target.value);
            document.getElementById('play-speed-val').textContent = val;
            for (const a of this.simP.agents) a.maxSpeed = val;
        });

        // Display toggles
        document.getElementById('show-cones').addEventListener('change', e => {
            const v = e.target.checked;
            this.rendererL.showVOCones = v;
            this.rendererR.showVOCones = v;
            this.rendererP.showVOCones = v;
            this.rendererT.showVOCones = v;
        });
        document.getElementById('show-velocity').addEventListener('change', e => {
            const v = e.target.checked;
            this.rendererL.showVelocities = v;
            this.rendererR.showVelocities = v;
            this.rendererP.showVelocities = v;
            this.rendererT.showVelocities = v;
        });
        document.getElementById('show-trails').addEventListener('change', e => {
            const v = e.target.checked;
            this.rendererL.showTrails = v;
            this.rendererR.showTrails = v;
            this.rendererP.showTrails = v;
            this.rendererT.showTrails = v;
        });
        document.getElementById('show-goals').addEventListener('change', e => {
            const v = e.target.checked;
            this.rendererL.showGoals = v;
            this.rendererR.showGoals = v;
            this.rendererP.showGoals = v;
            this.rendererT.showGoals = v;
        });
        document.getElementById('show-velspace').addEventListener('change', e => {
            const v = e.target.checked;
            this.rendererL.showVelocitySpace = v;
            this.rendererR.showVelocitySpace = v;
            this.rendererP.showVelocitySpace = v;
            this.rendererT.showVelocitySpace = v;
        });

        // Canvas click — select agents
        this._setupCanvasClick(this.compCanvasL, this.simL);
        this._setupCanvasClick(this.compCanvasR, this.simR);
        this._setupCanvasClick(this.playCanvas, this.simP);
        this._setupCanvasClick(this.theoryCanvas, this.simT);

        // Populate scene dropdowns
        this._populateSceneDropdowns();

        // Initialize only the active tab; others are lazy-initialized on switch
        this._theoryInited = false;
        this._compInited = false;
        this._playInited = false;
        this._switchTab('theory');

        // Start animation loop
        this._animate(0);
    }

    _resizeCanvases() {
        const resize = (canvas, container) => {
            if (!container) return;
            const rect = container.getBoundingClientRect();
            // Only resize if container has actual dimensions (visible)
            if (rect.width > 0 && rect.height > 0) {
                canvas.width = rect.width;
                canvas.height = rect.height;
            }
        };

        resize(this.compCanvasL, this.compCanvasL.parentElement);
        resize(this.compCanvasR, this.compCanvasR.parentElement);
        resize(this.playCanvas, this.playCanvas.parentElement);
        resize(this.theoryCanvas, this.theoryCanvas.parentElement);
    }

    _populateSceneDropdowns() {
        const scenes = Scenes.list();
        ['comp-scene', 'play-scene'].forEach(id => {
            const sel = document.getElementById(id);
            sel.innerHTML = '';
            for (const s of scenes) {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.name + ' — ' + s.desc;
                sel.appendChild(opt);
            }
        });
        document.getElementById('comp-scene').value = 'headOn';
        document.getElementById('play-scene').value = 'circleSwap';
    }

    _switchTab(tabId) {
        this.activeTab = tabId;
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        document.querySelectorAll('.tab-content').forEach(tc => {
            tc.classList.toggle('active', tc.id === 'tab-' + tabId);
        });
        // Resize after DOM update so hidden→visible tabs get correct dimensions
        requestAnimationFrame(() => {
            this._resizeCanvases();
            if (tabId === 'theory' && !this._theoryInited) {
                this._theoryInited = true;
                this._resetTheory();
            } else if (tabId === 'comparison' && !this._compInited) {
                this._compInited = true;
                this._resetComparison();
            } else if (tabId === 'comparison') {
                // Re-create scenes with new canvas dimensions on resize
                const w = this.compCanvasL.width;
                if (w > 0 && this.simL.agents.length === 0) this._resetComparison();
            } else if (tabId === 'playground' && !this._playInited) {
                this._playInited = true;
                this._resetPlayground();
            }
        });
    }

    // ── Theory ──────────────────────────────────────────────

    _resetTheory() {
        Agent._nextId = 0;
        const agents = Scenes.headOn(this.theoryCanvas.width, this.theoryCanvas.height);
        agents[0].selected = true;
        this.simT.setAgents(agents);
        this.simT.algorithm = this.theoryAlgo;
        this.rendererT.clearTrails();
        this.theoryRunning = false;
        document.getElementById('theory-play').textContent = '▶ 播放';
        // Do one step so cones are computed for display
        this.simT.step();
        this._updateTheoryDescription();
    }

    _updateTheoryDescription() {
        const desc = document.getElementById('theory-desc');
        const algo = this.theoryAlgo;
        if (algo === 'NONE') {
            desc.innerHTML = `
                <h3>无避障算法 (No Avoidance)</h3>
                <p>每个智能体 <strong>直接朝目标移动</strong>，不考虑其他智能体。当两个智能体的路径交叉时，它们会直接 <strong>穿过彼此</strong>（发生碰撞）。</p>
                <p>这是最简单的情况——智能体之间没有任何协调。现实中，这会导致碰撞事故。</p>
                <p class="hint">点击 <strong>▶ 播放</strong> 观察两个智能体如何碰撞。</p>
            `;
        } else if (algo === 'VO') {
            desc.innerHTML = `
                <h3>速度障碍 (Velocity Obstacle, VO)</h3>
                <p><strong>核心思想：</strong>对于智能体 A，计算出所有会导致与智能体 B 碰撞的速度集合——这个集合在速度空间中形成一个 <span class="highlight-cone">锥形区域</span>（即"速度障碍"）。</p>
                <p><strong>避障方式：</strong>智能体 A 选择 <span class="highlight-green">期望速度</span> 最近的、落在锥体 <strong>外部</strong> 的速度作为实际速度。</p>
                <div class="math-block">
                    VO<sub>A|B</sub> = { <strong>v</strong><sub>A</sub> | ∃t &gt; 0 : ‖(<strong>p</strong><sub>A</sub> + <strong>v</strong><sub>A</sub>·t) − (<strong>p</strong><sub>B</sub> + <strong>v</strong><sub>B</sub>·t)‖ &lt; r<sub>A</sub> + r<sub>B</sub> }
                </div>
                <p><strong>问题：</strong>VO 假设 B 保持原速度不变，A 独自承担全部避障责任。当双方都使用 VO 时，两者都会过度调整，导致 <span class="highlight-red">振荡抖动</span>。</p>
                <p class="hint">观察右上角 <strong>速度空间</strong> 图：红色锥体是 VO，白点是实际选择的速度。点击智能体可切换查看对象。</p>
            `;
        } else if (algo === 'RVO') {
            desc.innerHTML = `
                <h3>互惠速度障碍 (Reciprocal Velocity Obstacle, RVO)</h3>
                <p><strong>核心改进：</strong>RVO 让双方 <strong>各承担一半</strong> 的避障责任。VO 的锥体顶点在 <strong>v</strong><sub>B</sub>，而 RVO 将其移到 (<strong>v</strong><sub>A</sub> + <strong>v</strong><sub>B</sub>) / 2。</p>
                <div class="math-block">
                    RVO<sub>A|B</sub> = { <strong>v</strong> | 2<strong>v</strong> − <strong>v</strong><sub>A</sub> ∈ VO<sub>A|B</sub> }
                </div>
                <p><strong>效果：</strong>双方各调整约 50%，加在一起恰好完成完整避障。避免了 VO 的 <span class="highlight-red">振荡问题</span>，运动轨迹更 <span class="highlight-green">平滑自然</span>。</p>
                <p class="hint">对比 VO 和 RVO：切换上方算法选择器，观察锥体顶点位置的变化和运动轨迹的差异。</p>
            `;
        } else if (algo === 'ORCA') {
            desc.innerHTML = `
                <h3>最优互惠碰撞避免 (ORCA)</h3>
                <p><strong>核心改进：</strong>ORCA 是 RVO 的数学优化版本。它将锥体约束转化为 <span class="highlight-yellow">半平面约束</span>（黄色虚线），然后用 <strong>线性规划</strong> 求解最优速度。</p>
                <div class="math-block">
                    ORCA<sub>A|B</sub> = { <strong>v</strong> | (<strong>v</strong> − (<strong>v</strong><sub>A</sub> + ½<strong>u</strong>)) · <strong>n̂</strong> ≥ 0 }
                </div>
                <p><strong>优势：</strong>① 数学上可证明无碰撞 ② 计算效率更高（线性规划 vs 采样） ③ 支持大规模场景。</p>
                <p class="hint">黄色虚线是 ORCA 半平面约束，智能体选择满足所有约束且最接近期望速度的速度。</p>
            `;
        }
    }

    // ── Comparison ──────────────────────────────────────────

    _resetComparison() {
        Agent._nextId = 0;
        const agentsL = Scenes.create(this.compScene, this.compCanvasL.width, this.compCanvasL.height);
        Agent._nextId = 0;
        const agentsR = Scenes.create(this.compScene, this.compCanvasR.width, this.compCanvasR.height);

        // Select first agent in both
        if (agentsL.length > 0) agentsL[0].selected = true;
        if (agentsR.length > 0) agentsR[0].selected = true;

        this.simL.setAgents(agentsL);
        this.simR.setAgents(agentsR);
        this.simL.algorithm = this.compAlgoL;
        this.simR.algorithm = this.compAlgoR;
        this.rendererL.clearTrails();
        this.rendererR.clearTrails();
        this.compRunning = false;
        document.getElementById('comp-play').textContent = '▶ 播放';
    }

    // ── Playground ──────────────────────────────────────────

    _resetPlayground() {
        Agent._nextId = 0;
        const agents = Scenes.create(this.playScene, this.playCanvas.width, this.playCanvas.height);
        if (agents.length > 0) agents[0].selected = true;
        this.simP.setAgents(agents);
        this.simP.algorithm = this.playAlgo;
        this.rendererP.clearTrails();
        this.playRunning = false;
        document.getElementById('play-play').textContent = '▶ 播放';
    }

    // ── Canvas interaction ──────────────────────────────────

    _setupCanvasClick(canvas, sim) {
        canvas.addEventListener('click', e => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            const click = new Vec2(x, y);

            // Find nearest agent within click radius
            let nearest = null;
            let nearestDist = 30;
            for (const agent of sim.agents) {
                const d = click.distTo(agent.position);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearest = agent;
                }
            }

            // Deselect all, select nearest
            for (const a of sim.agents) a.selected = false;
            if (nearest) nearest.selected = true;
        });
    }

    // ── Animation loop ──────────────────────────────────────

    _animate(time) {
        const dt = Math.min((time - this.lastTime) / 1000, 0.05);
        this.lastTime = time;

        // Accumulator for fixed timestep
        if (this.activeTab === 'theory') {
            if (this.theoryRunning) {
                this.simT.step();
            }
            this.rendererT.drawFrame(this.simT);
        } else if (this.activeTab === 'comparison') {
            if (this.compRunning) {
                this.simL.step();
                this.simR.step();
            }
            this.rendererL.drawFrame(this.simL);
            this.rendererR.drawFrame(this.simR);
        } else if (this.activeTab === 'playground') {
            if (this.playRunning) {
                this.simP.step();
            }
            this.rendererP.drawFrame(this.simP);
        }

        this.animFrameId = requestAnimationFrame(t => this._animate(t));
    }
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
