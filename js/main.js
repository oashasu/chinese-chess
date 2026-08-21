// 主程序和 UI 交互

class ChessApp {
    constructor() {
        this.game = new ChessGame();
        this.canvas = null;
        this.isAutoPlaying = false;

        // DOM 元素
        this.elements = {};
    }

    /**
     * 初始化应用
     */
    init() {
        this.canvas = document.getElementById('chess-board');
        this.game.init(this.canvas);

        this._cacheElements();
        this._bindEvents();
        this._updateUI();

        // 初始渲染 - 使用 requestAnimationFrame 确保 DOM 准备好
        requestAnimationFrame(() => {
            this.game.board.render();
        });
    }

    /**
     * 缓存 DOM 元素
     */
    _cacheElements() {
        this.elements = {
            // 模式选择
            modePVE: document.querySelector('input[value="pve"]'),
            modeEVE: document.querySelector('input[value="eve"]'),

            // 玩家配置
            redPlayer: document.getElementById('red-player'),
            blackPlayer: document.getElementById('black-player'),

            // AI 参数
            searchDepth: document.getElementById('search-depth'),
            depthValue: document.getElementById('depth-value'),
            mctsSimulations: document.getElementById('mcts-simulations'),
            simulationsValue: document.getElementById('simulations-value'),
            thinkTime: document.getElementById('think-time'),
            timeValue: document.getElementById('time-value'),

            // 控制按钮
            newGame: document.getElementById('new-game'),
            undoMove: document.getElementById('undo-move'),
            autoPlay: document.getElementById('auto-play'),
            stopPlay: document.getElementById('stop-play'),

            // 状态显示
            moveCount: document.getElementById('move-count'),
            currentPlayer: document.getElementById('current-player'),
            gameStatus: document.getElementById('game-status'),
            moveList: document.getElementById('move-list'),
            evalFill: document.getElementById('eval-fill'),
            evalText: document.getElementById('eval-text'),
            repeatCount: document.getElementById('repeat-count'),
            noCaptureCount: document.getElementById('no-capture-count'),
            checkStatus: document.getElementById('check-status')
        };
    }

    /**
     * 绑定事件
     */
    _bindEvents() {
        // 模式切换
        this.elements.modePVE.addEventListener('change', () => this._onModeChange());
        this.elements.modeEVE.addEventListener('change', () => this._onModeChange());

        // 玩家配置
        this.elements.redPlayer.addEventListener('change', () => this._onPlayerChange());
        this.elements.blackPlayer.addEventListener('change', () => this._onPlayerChange());

        // AI 参数
        this.elements.searchDepth.addEventListener('input', (e) => {
            this.elements.depthValue.textContent = e.target.value;
            this.game.setConfig({ searchDepth: parseInt(e.target.value) });
        });

        this.elements.mctsSimulations.addEventListener('input', (e) => {
            this.elements.simulationsValue.textContent = e.target.value;
            this.game.setConfig({ mctsSimulations: parseInt(e.target.value) });
        });

        this.elements.thinkTime.addEventListener('input', (e) => {
            this.elements.timeValue.textContent = e.target.value;
            this.game.setConfig({ thinkTime: parseInt(e.target.value) * 1000 });
        });

        // 控制按钮
        this.elements.newGame.addEventListener('click', () => this._onNewGame());
        this.elements.undoMove.addEventListener('click', () => this._onUndo());
        this.elements.autoPlay.addEventListener('click', () => this._onAutoPlay());
        this.elements.stopPlay.addEventListener('click', () => this._onStopPlay());

        // 棋盘点击
        this.canvas.addEventListener('click', (e) => this._onCanvasClick(e));
    }

    /**
     * 模式切换
     */
    _onModeChange() {
        const mode = document.querySelector('input[name="mode"]:checked').value;
        this.game.setConfig({ mode });

        if (mode === 'pve') {
            this.elements.redPlayer.value = 'human';
            this.elements.blackPlayer.value = 'mcts';
            this.elements.blackPlayer.disabled = false;
        } else {
            this.elements.redPlayer.value = 'minimax';
            this.elements.blackPlayer.value = 'mcts';
        }

        this._onPlayerChange();
    }

    /**
     * 玩家配置变更
     */
    _onPlayerChange() {
        this.game.setConfig({
            redPlayer: this.elements.redPlayer.value,
            blackPlayer: this.elements.blackPlayer.value
        });
    }

    /**
     * 新游戏
     */
    _onNewGame() {
        this.isAutoPlaying = false;
        this.elements.autoPlay.disabled = false;
        this.elements.stopPlay.disabled = true;

        this.game.newGame();
        this._updateUI();
    }

    /**
     * 悔棋
     */
    _onUndo() {
        if (this.isAutoPlaying) return;

        // 人机模式下悔两步
        if (this.game.config.mode === 'pve') {
            this.game.undo();
            this.game.undo();
        } else {
            this.game.undo();
        }

        this._updateUI();
    }

    /**
     * 自动对弈
     */
    async _onAutoPlay() {
        if (this.game.config.mode !== 'eve') {
            alert('请先切换到机机对弈模式');
            return;
        }

        this.isAutoPlaying = true;
        this.elements.autoPlay.disabled = true;
        this.elements.stopPlay.disabled = false;

        await this.game.autoPlay((data) => {
            this._updateUI();
        });

        this.isAutoPlaying = false;
        this.elements.autoPlay.disabled = false;
        this.elements.stopPlay.disabled = true;

        this._updateUI();
    }

    /**
     * 停止自动对弈
     */
    _onStopPlay() {
        this.isAutoPlaying = false;
        this.elements.autoPlay.disabled = false;
        this.elements.stopPlay.disabled = true;
    }

    /**
     * 棋盘点击
     */
    async _onCanvasClick(e) {
        if (this.isAutoPlaying) return;
        if (this.game.gameOver) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const result = this.game.handleClick(x, y);

        if (result && result.success) {
            this._updateUI();

            // AI 回合
            if (!this.game.gameOver && !this.game._isHumanTurn()) {
                await this._aiTurn();
            }
        }
    }

    /**
     * AI 回合
     */
    async _aiTurn() {
        this.elements.gameStatus.textContent = 'AI 思考中...';
        this.elements.gameStatus.classList.add('thinking');

        const result = await this.game.makeAIMove();

        this.elements.gameStatus.classList.remove('thinking');
        this._updateUI();
    }

    /**
     * 更新 UI
     */
    _updateUI() {
        // 回合数
        this.elements.moveCount.textContent = this.game.moveHistory.length;

        // 当前玩家
        const side = this.game.board.currentSide;
        this.elements.currentPlayer.textContent = side === 'red' ? '红方' : '黑方';

        // 游戏状态
        if (this.game.gameOver) {
            if (this.game.winner === 'draw') {
                this.elements.gameStatus.textContent = '和棋！';
            } else {
                const winnerName = this.game.winner === 'red' ? '红方' : '黑方';
                this.elements.gameStatus.textContent = `${winnerName}胜！`;
            }
        } else {
            this.elements.gameStatus.textContent = '';
        }

        // 走法历史
        this._updateMoveList();

        // 评估条
        this._updateEvaluation();

        // 循环检测信息
        this._updateCycleInfo();
    }

    /**
     * 更新走法列表
     */
    _updateMoveList() {
        const history = this.game.getMoveHistory();
        this.elements.moveList.innerHTML = '';

        // 倒序显示最新的 50 步
        const recent = history.slice(-50).reverse();

        for (const item of recent) {
            const div = document.createElement('div');
            div.className = `move-item ${item.side}`;
            div.innerHTML = `
                <span>${item.index}. ${item.side === 'red' ? '红' : '黑'}</span>
                <span>${item.notation}</span>
            `;
            this.elements.moveList.appendChild(div);
        }
    }

    /**
     * 更新评估条
     */
    _updateEvaluation() {
        const evalScore = this.game.getEvaluation();

        // 将评估分数转换为百分比 (假设 -100 到 100 的范围)
        const normalized = Math.max(-100, Math.min(100, evalScore));
        const percentage = 50 + normalized / 2;

        this.elements.evalFill.style.width = `${percentage}%`;
        this.elements.evalText.textContent = (evalScore / 10).toFixed(1);
    }

    /**
     * 更新循环检测信息
     */
    _updateCycleInfo() {
        const cycleInfo = this.game.getCycleInfo();

        this.elements.repeatCount.textContent = cycleInfo.repeatCount;
        this.elements.noCaptureCount.textContent = cycleInfo.noCaptureCount;

        // 检查状态
        const inCheck = this.game._isInCheck(this.game.board.currentSide);
        this.elements.checkStatus.textContent = inCheck ? '将军！' : '无';
        this.elements.checkStatus.style.color = inCheck ? '#c41e3a' : 'inherit';
    }
}

// 启动应用 - 直接执行，因为 script 在 body 底部
const app = new ChessApp();
app.init();
window.app = app;  // 挂载到 window 便于调试
