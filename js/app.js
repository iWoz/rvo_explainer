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
        this.orcaLessonStep = 0;
        this.orcaLessonSteps = [
            { label: '1 看碰撞风险' },
            { label: '2 搬进速度空间' },
            { label: '3 算出 1/2u' },
            { label: '4 切成半平面' },
            { label: '5 选最优速度' }
        ];

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
            this._refreshTheoryDescriptionData();
        });

        document.getElementById('theory-desc').addEventListener('click', e => {
            const stepBtn = e.target.closest('[data-orca-step]');
            if (stepBtn) {
                this._setOrcaLessonStep(parseInt(stepBtn.dataset.orcaStep, 10));
                return;
            }

            const navBtn = e.target.closest('[data-orca-nav]');
            if (navBtn) {
                const delta = navBtn.dataset.orcaNav === 'prev' ? -1 : 1;
                this._setOrcaLessonStep(this.orcaLessonStep + delta);
            }
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
            this._refreshTheoryDescriptionData();
        });
        document.getElementById('show-velocity').addEventListener('change', e => {
            const v = e.target.checked;
            this.rendererL.showVelocities = v;
            this.rendererR.showVelocities = v;
            this.rendererP.showVelocities = v;
            this.rendererT.showVelocities = v;
            this._refreshTheoryDescriptionData();
        });
        document.getElementById('show-trails').addEventListener('change', e => {
            const v = e.target.checked;
            this.rendererL.showTrails = v;
            this.rendererR.showTrails = v;
            this.rendererP.showTrails = v;
            this.rendererT.showTrails = v;
            this._refreshTheoryDescriptionData();
        });
        document.getElementById('show-goals').addEventListener('change', e => {
            const v = e.target.checked;
            this.rendererL.showGoals = v;
            this.rendererR.showGoals = v;
            this.rendererP.showGoals = v;
            this.rendererT.showGoals = v;
            this._refreshTheoryDescriptionData();
        });
        document.getElementById('show-velspace').addEventListener('change', e => {
            const v = e.target.checked;
            this.rendererL.showVelocitySpace = v;
            this.rendererR.showVelocitySpace = v;
            this.rendererP.showVelocitySpace = v;
            this.rendererT.showVelocitySpace = v;
            this._refreshTheoryDescriptionData();
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

            if (tabId === 'theory') {
                this._refreshTheoryDescriptionData();
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
        this.orcaLessonStep = 0;
        this.theoryRunning = false;
        document.getElementById('theory-play').textContent = '▶ 播放';
        this._updateTheoryRendererLesson();
        // Do one step so cones are computed for display
        this.simT.step();
        this._updateTheoryDescription();
        this._refreshTheoryDescriptionData();
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
                <div class="lesson-shell">
                    <div class="lesson-intro">
                        <h3>最优互惠碰撞避免 (ORCA)</h3>
                        <p><strong>一句话：</strong>ORCA 不直接“猜一个绕开的速度”，而是先算出当前速度 <strong>至少需要被推开多少</strong>，再把这个要求写成 <span class="highlight-yellow">半平面约束</span>，最后从所有合法速度里挑一个最接近目标的解。</p>
                    </div>

                    <div class="lesson-toolbar">
                        <span class="lesson-badge" id="orca-focus-badge">当前观察</span>
                        <div class="lesson-nav">
                            <button type="button" class="ctrl-btn" data-orca-nav="prev">← 上一步</button>
                            <button type="button" class="ctrl-btn" data-orca-nav="next">下一步 →</button>
                        </div>
                    </div>

                    <div class="lesson-stepper">
                        ${this.orcaLessonSteps.map((step, index) => `
                            <button type="button" class="lesson-step-chip" data-orca-step="${index}">
                                <span>${step.label}</span>
                            </button>
                        `).join('')}
                    </div>

                    <div class="lesson-metrics" id="orca-metrics"></div>
                    <div class="lesson-stage" id="orca-step-body"></div>

                    <div class="math-block">
                        ORCA<sub>A|B</sub> = { <strong>v</strong> | (<strong>v</strong> − (<strong>v</strong><sub>A</sub> + ½<strong>u</strong>)) · <strong>n̂</strong> ≥ 0 }
                    </div>
                    <p class="hint" id="orca-lesson-hint"></p>
                </div>
            `;
            this._updateTheoryRendererLesson();
            this._refreshOrcaLessonPanel();
        }
    }

    _updateTheoryRendererLesson() {
        this.rendererT.lessonMode = this.theoryAlgo === 'ORCA' ? 'ORCA' : null;
        this.rendererT.lessonStep = this.orcaLessonStep;
    }

    _refreshTheoryDescriptionData() {
        this._updateTheoryRendererLesson();
        if (this.theoryAlgo === 'ORCA') {
            this._refreshOrcaLessonPanel();
        }
    }

    _setOrcaLessonStep(step) {
        const maxStep = this.orcaLessonSteps.length - 1;
        this.orcaLessonStep = Math.max(0, Math.min(maxStep, step));
        this._refreshTheoryDescriptionData();
    }

    _getSelectedTheoryAgent() {
        let selected = this.simT.agents.find(agent => agent.selected);
        if (!selected && this.simT.agents.length > 0) {
            selected = this.simT.agents[0];
            selected.selected = true;
        }
        return selected || null;
    }

    _getPrimaryOrcaContext() {
        const agent = this._getSelectedTheoryAgent();
        if (!agent) return null;

        const debugData = this.simT.debugData.get(agent.id);
        const lines = debugData?.orcaLines || [];
        if (lines.length === 0) {
            return {
                agent,
                debugData,
                lines,
                lineCount: 0,
                violatingCount: 0
            };
        }

        let primaryLine = lines[0];
        let bestScore = Infinity;
        let violatingCount = 0;

        for (const line of lines) {
            const signed = Algorithms.signedDistanceToORCALine(line, agent.preferredVelocity);
            if (signed < 0) violatingCount++;

            const score = signed < 0 ? signed : 1000 + Math.abs(signed);
            if (score < bestScore) {
                bestScore = score;
                primaryLine = line;
            }
        }

        const normal = primaryLine.normal || primaryLine.direction.perp();
        const preferredSigned = Algorithms.signedDistanceToORCALine(primaryLine, agent.preferredVelocity);
        const other = primaryLine.otherAgent;
        const rawDistance = other ? agent.position.distTo(other.position) : primaryLine.distance;
        const kindLabels = {
            truncation: '时间窗圆盘',
            cone: '锥体边界',
            collision: '重叠分离'
        };

        return {
            agent,
            debugData,
            lines,
            line: primaryLine,
            other,
            normal,
            preferredSigned,
            lineCount: lines.length,
            violatingCount,
            totalShiftMag: primaryLine.u.length(),
            sharedShiftMag: primaryLine.responsibilityShift.length(),
            chosenDelta: agent.velocity.distTo(agent.preferredVelocity),
            rawDistance,
            clearance: Math.max(0, rawDistance - primaryLine.combinedRadius),
            kindLabel: kindLabels[primaryLine.constraintKind] || '边界约束'
        };
    }

    _refreshOrcaLessonPanel() {
        const focusBadge = document.getElementById('orca-focus-badge');
        const metrics = document.getElementById('orca-metrics');
        const stepBody = document.getElementById('orca-step-body');
        const hint = document.getElementById('orca-lesson-hint');
        if (!focusBadge || !metrics || !stepBody || !hint) return;

        const context = this._getPrimaryOrcaContext();
        if (!context) return;

        const observerLabel = context.other
            ? `当前观察：Agent ${context.agent.id} 对 Agent ${context.other.id}`
            : `当前观察：Agent ${context.agent.id}`;
        focusBadge.textContent = observerLabel;

        metrics.innerHTML = this._buildOrcaMetrics(context);
        stepBody.innerHTML = this._buildOrcaStepContent(context);

        document.querySelectorAll('#theory-desc [data-orca-step]').forEach(btn => {
            const stepIndex = parseInt(btn.dataset.orcaStep, 10);
            btn.classList.toggle('active', stepIndex === this.orcaLessonStep);
        });

        document.querySelectorAll('#theory-desc [data-orca-nav]').forEach(btn => {
            const isPrev = btn.dataset.orcaNav === 'prev';
            btn.disabled = isPrev
                ? this.orcaLessonStep === 0
                : this.orcaLessonStep === this.orcaLessonSteps.length - 1;
        });

        const hidden = [];
        if (!this.rendererT.showVelocitySpace) hidden.push('速度空间');
        if (!this.rendererT.showVOCones) hidden.push('VO 锥体');
        hint.textContent = hidden.length > 0
            ? `当前已关闭 ${hidden.join(' / ')}，分步高亮会减少。建议保持这两个开关开启，再配合“单步”或“播放”观察 ORCA 约束如何更新；点击左侧智能体还能切换观察对象。`
            : '建议保持“速度空间”和“VO 锥体”开启，再配合“单步”或“播放”观察绿色期望速度如何被推到黄色约束的合法侧；点击左侧智能体还能切换观察对象。';
    }

    _buildOrcaMetrics(context) {
        if (!context.line) {
            return `
                <div class="lesson-metric">
                    <span>约束状态</span>
                    <strong>暂无 ORCA 约束</strong>
                </div>
            `;
        }

        const prefState = context.preferredSigned < 0 ? '落在非法侧' : '已在合法侧';
        return `
            <div class="lesson-metric">
                <span>主约束类型</span>
                <strong>${context.kindLabel}</strong>
            </div>
            <div class="lesson-metric">
                <span>期望速度状态</span>
                <strong>${prefState}</strong>
            </div>
            <div class="lesson-metric">
                <span>违规约束数</span>
                <strong>${context.violatingCount} / ${context.lineCount}</strong>
            </div>
            <div class="lesson-metric">
                <span>A 分担改变量</span>
                <strong>|1/2u| = ${context.sharedShiftMag.toFixed(1)}</strong>
            </div>
            <div class="lesson-metric">
                <span>当前速度偏移</span>
                <strong>${context.chosenDelta.toFixed(1)}</strong>
            </div>
        `;
    }

    _buildOrcaStepContent(context) {
        if (!context.line) {
            return `
                <div class="lesson-stage-head">
                    <span class="lesson-overline">步骤 ${this.orcaLessonStep + 1} / ${this.orcaLessonSteps.length}</span>
                    <h4>${this.orcaLessonSteps[this.orcaLessonStep].label}</h4>
                </div>
                <p>当前没有可展示的 ORCA 约束。请先保持理论页中的智能体处于相互影响状态。</p>
            `;
        }

        const stageNo = this.orcaLessonStep + 1;
        const prefPenalty = Math.max(0, -context.preferredSigned);

        if (this.orcaLessonStep === 0) {
            return `
                <div class="lesson-stage-head">
                    <span class="lesson-overline">步骤 ${stageNo} / ${this.orcaLessonSteps.length}</span>
                    <h4>先确认“照直走”为什么会撞</h4>
                </div>
                <p>ORCA 的第一步不是立刻找绕路，而是先问一句：如果 Agent ${context.agent.id} 和 Agent ${context.other.id} 都继续保持当前趋势，在未来 ${context.line.timeHorizon.toFixed(1)} 秒里会不会进入彼此的安全半径？</p>
                <p>左侧世界坐标会强调两者连线和安全间距。只要绿色期望速度会把两人继续推向同一块空间，就说明必须修正。</p>
                <div class="lesson-mini-grid">
                    <div><span>当前中心距</span><strong>${context.rawDistance.toFixed(1)}</strong></div>
                    <div><span>安全距离</span><strong>${context.line.combinedRadius.toFixed(1)}</strong></div>
                    <div><span>净间距</span><strong>${context.clearance.toFixed(1)}</strong></div>
                    <div><span>时间窗 τ</span><strong>${context.line.timeHorizon.toFixed(1)} s</strong></div>
                </div>
                <div class="lesson-callout">读图顺序：先看世界坐标里的两人连线，再去看速度空间中的绿色期望速度是否冲进了危险区。</div>
            `;
        }

        if (this.orcaLessonStep === 1) {
            return `
                <div class="lesson-stage-head">
                    <span class="lesson-overline">步骤 ${stageNo} / ${this.orcaLessonSteps.length}</span>
                    <h4>把碰撞判断搬到速度空间</h4>
                </div>
                <p>一旦切换到速度空间，问题就变成：哪些速度在未来 ${context.line.timeHorizon.toFixed(1)} 秒内会导致碰撞？这些速度构成一整块禁区，而不是一个单独点。</p>
                <p>当前主约束由 Agent ${context.other.id} 贡献。绿色期望速度如果落在非法侧，说明“朝目标直冲”会撞上去。</p>
                <div class="lesson-mini-grid">
                    <div><span>主约束</span><strong>${context.kindLabel}</strong></div>
                    <div><span>v_pref 状态</span><strong>${context.preferredSigned < 0 ? '已进入禁区' : '已经脱离禁区'}</strong></div>
                    <div><span>越界深度</span><strong>${prefPenalty.toFixed(1)}</strong></div>
                    <div><span>约束总数</span><strong>${context.lineCount}</strong></div>
                </div>
                <div class="lesson-callout">这也是 ORCA 比“看位置绕路”更清楚的地方：它直接回答“什么速度不能选”。</div>
            `;
        }

        if (this.orcaLessonStep === 2) {
            return `
                <div class="lesson-stage-head">
                    <span class="lesson-overline">步骤 ${stageNo} / ${this.orcaLessonSteps.length}</span>
                    <h4>先求出最小修正量，再只分担一半</h4>
                </div>
                <p>ORCA 会先算一个最小修正向量 <strong>u</strong>：只要把相对速度推出危险区这么多，就足够安全，不多绕一步。</p>
                <p>但 Agent ${context.agent.id} 不会承担全部责任。它只拿走 <strong>1/2u</strong>，另一半默认由对方承担，这就是“互惠”的来源。</p>
                <div class="lesson-mini-grid">
                    <div><span>|u|</span><strong>${context.totalShiftMag.toFixed(1)}</strong></div>
                    <div><span>|1/2u|</span><strong>${context.sharedShiftMag.toFixed(1)}</strong></div>
                    <div><span>当前边界点</span><strong>${this._formatVec(context.line.point)}</strong></div>
                    <div><span>投影来源</span><strong>${context.kindLabel}</strong></div>
                </div>
                <div class="lesson-callout">左侧速度空间里会把“当前速度 → 约束边界点”的那一小段推开量单独标出来，这就是 Agent A 实际承担的修正。</div>
            `;
        }

        if (this.orcaLessonStep === 3) {
            return `
                <div class="lesson-stage-head">
                    <span class="lesson-overline">步骤 ${stageNo} / ${this.orcaLessonSteps.length}</span>
                    <h4>把“别撞车”写成一条半平面约束</h4>
                </div>
                <p>有了边界点 <strong>v<sub>A</sub> + 1/2u</strong>，再取法向 <strong>n</strong>，就能得到一条 ORCA 线。线的合法侧就是 Agent ${context.agent.id} 此刻允许选择的全部速度。</p>
                <p>这一步非常关键：ORCA 不再围着锥体采样，而是把避障变成一组线性约束，后面就能交给线性规划处理。</p>
                <div class="lesson-mini-grid">
                    <div><span>法向 n</span><strong>${this._formatVec(context.normal)}</strong></div>
                    <div><span>线方向</span><strong>${this._formatVec(context.line.direction)}</strong></div>
                    <div><span>v_pref 到边界</span><strong>${prefPenalty.toFixed(1)}</strong></div>
                    <div><span>边界点</span><strong>${this._formatVec(context.line.point)}</strong></div>
                </div>
                <div class="lesson-callout">黄色虚线是边界，黄色半透明区域是合法侧。只要速度点落在那一侧，就满足这条约束。</div>
            `;
        }

        return `
            <div class="lesson-stage-head">
                <span class="lesson-overline">步骤 ${stageNo} / ${this.orcaLessonSteps.length}</span>
                <h4>在所有合法速度里，挑离目标最近的那个</h4>
            </div>
            <p>把所有邻居给出的半平面求交集之后，ORCA 只做最后一件事：在这个合法区域里找一个最接近绿色期望速度的解。</p>
            <p>当前这个理论页场景里主要只有 ${context.lineCount} 条约束，所以结果很好读。换到拥挤场景时，最优速度往往会落在多条边界的交点上。</p>
            <div class="lesson-mini-grid">
                <div><span>v_pref</span><strong>${this._formatVec(context.agent.preferredVelocity)}</strong></div>
                <div><span>v_new</span><strong>${this._formatVec(context.agent.velocity)}</strong></div>
                <div><span>改动代价</span><strong>${context.chosenDelta.toFixed(1)}</strong></div>
                <div><span>选中约束数</span><strong>${context.lineCount}</strong></div>
            </div>
            <div class="lesson-callout">观察绿色点和白色点的间距：这段差值就是“为了安全，ORCA 逼着速度偏离目标多少”。</div>
        `;
    }

    _formatVec(vec) {
        if (!vec) return '(0.0, 0.0)';
        return `(${vec.x.toFixed(1)}, ${vec.y.toFixed(1)})`;
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

            if (sim === this.simT) {
                this._refreshTheoryDescriptionData();
            }
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
                this._refreshTheoryDescriptionData();
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
