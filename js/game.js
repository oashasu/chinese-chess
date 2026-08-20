// 游戏主逻辑

class ChessGame {
    constructor() {
        this.board = null;
        this.zobrist = null;
        this.history = null;
        this.moveHistory = [];
        this.gameOver = false;
        this.winner = null;

        // AI 实例
        this.aiInstances = {
            random: new RandomAI(),
            greedy: new GreedyAI(),
            minimax: new MinimaxAI(4),
            mcts: new MCTSAI(1000),
            hybrid: new HybridAI()
        };

        // 游戏配置
        this.config = {
            mode: 'pve',  // pve: 人机, eve: 机机
            redPlayer: 'human',
            blackPlayer: 'mcts',
            searchDepth: 4,
            mctsSimulations: 1000,
            thinkTime: 5000
        };
    }

    /**
     * 初始化游戏
     */
    init(canvas) {
        this.board = new ChessBoard(canvas);
        this.zobrist = new ZobristHash();
        this.history = new PositionHistory();

        // 计算初始局面的哈希
        this.currentHash = this.zobrist.computeHash(this.board.pieces);
        this.history.recordMove(this.currentHash, null, false);
    }

    /**
     * 开始新游戏
     */
    newGame() {
        this.board.reset();
        this.history.clear();
        this.moveHistory = [];
        this.gameOver = false;
        this.winner = null;

        this.currentHash = this.zobrist.computeHash(this.board.pieces);
        this.history.recordMove(this.currentHash, null, false);

        return true;
    }

    /**
     * 设置游戏配置
     */
    setConfig(config) {
        this.config = { ...this.config, ...config };

        // 更新 AI 参数
        if (config.searchDepth !== undefined) {
            this.aiInstances.minimax.depth = config.searchDepth;
        }
        if (config.mctsSimulations !== undefined) {
            this.aiInstances.mcts.simulations = config.mctsSimulations;
        }
        if (config.thinkTime !== undefined) {
            this.config.thinkTime = config.thinkTime;
        }
    }

    /**
     * 处理人类玩家点击
     */
    handleClick(x, y) {
        if (this.gameOver) return null;
        if (!this._isHumanTurn()) return null;

        const move = this.board.handleClick(x, y);
        if (move) {
            return this.makeMove(move);
        }
        return null;
    }

    /**
     * 执行走法
     */
    makeMove(move) {
        // 检查是否合法
        const validMoves = MoveGenerator.generateAllMoves(this.board.pieces, this.board.currentSide);
        const isValid = validMoves.some(m =>
            m.fromRow === move.fromRow && m.fromCol === move.fromCol &&
            m.toRow === move.toRow && m.toCol === move.toCol
        );

        if (!isValid) return false;

        // 执行走法
        this.board.makeMove(move);
        this.moveHistory.push(move);

        // 更新哈希
        this.currentHash = this.zobrist.updateHash(this.currentHash, move, this.board.pieces);

        // 检查将军
        const opponentSide = this.board.currentSide;
        const inCheck = this._isInCheck(opponentSide);

        // 记录历史
        this.history.recordMove(this.currentHash, move, inCheck);

        // 检查游戏结束条件
        const gameResult = this._checkGameEnd();
        if (gameResult) {
            this.gameOver = true;
            this.winner = gameResult.winner;
            return { success: true, result: gameResult };
        }

        return { success: true, result: null };
    }

    /**
     * AI 走棋
     */
    async makeAIMove() {
        if (this.gameOver) return null;
        if (this._isHumanTurn()) return null;

        const side = this.board.currentSide;
        const aiType = side === 'red' ? this.config.redPlayer : this.config.blackPlayer;
        const ai = this.aiInstances[aiType];

        if (!ai) return null;

        // 异步执行 AI 计算
        return new Promise((resolve) => {
            setTimeout(() => {
                const move = ai.getMove(this.board.pieces, side, this.config.thinkTime);

                if (!move) {
                    resolve(null);
                    return;
                }

                const result = this.makeMove(move);
                resolve(result);
            }, 100);
        });
    }

    /**
     * 自动对弈（机机模式）
     */
    async autoPlay(callback) {
        if (this.config.mode !== 'eve') return;
        if (this.gameOver) return;

        while (!this.gameOver) {
            const result = await this.makeAIMove();

            if (callback) {
                callback({
                    move: this.moveHistory[this.moveHistory.length - 1],
                    result,
                    board: this.board.getState()
                });
            }

            if (result && result.result) {
                break;
            }

            // 短暂延迟，便于观察
            await this._sleep(500);
        }
    }

    /**
     * 悔棋
     */
    undo() {
        if (this.moveHistory.length === 0) return false;

        const lastMove = this.moveHistory.pop();
        this.board.undoMove(lastMove);
        this.history.undoLastMove();

        // 重新计算哈希
        if (this.moveHistory.length > 0) {
            // 重新计算哈希比较复杂，这里简化处理
            this.currentHash = this.zobrist.computeHash(this.board.pieces);
        }

        this.gameOver = false;
        this.winner = null;

        return true;
    }

    /**
     * 检查游戏结束
     */
    _checkGameEnd() {
        const currentSide = this.board.currentSide;
        const moves = MoveGenerator.generateAllMoves(this.board.pieces, currentSide);

        // 无合法走法
        if (moves.length === 0) {
            const winner = currentSide === 'red' ? 'black' : 'red';
            return { winner, reason: 'checkmate' };
        }

        // 三次重复局面
        if (this.history.isThreefoldRepetition(this.currentHash)) {
            return { winner: 'draw', reason: 'threefold_repetition' };
        }

        // 60步无吃子
        if (this.history.isSixtyMoveRule()) {
            return { winner: 'draw', reason: 'sixty_move_rule' };
        }

        // 长将检测
        if (this.history.detectPerpetualCheck(this.currentHash, currentSide)) {
            const winner = currentSide === 'red' ? 'black' : 'red';
            return { winner, reason: 'perpetual_check' };
        }

        return null;
    }

    /**
     * 检查是否被将军
     */
    _isInCheck(side) {
        const kingPos = this._findKing(side);
        if (!kingPos) return false;

        const opponentSide = side === 'red' ? 'black' : 'red';
        const opponentMoves = MoveGenerator.generateAllMoves(this.board.pieces, opponentSide);

        return opponentMoves.some(move =>
            move.toRow === kingPos.row && move.toCol === kingPos.col
        );
    }

    /**
     * 查找将/帅位置
     */
    _findKing(side) {
        for (let row = 0; row <= 9; row++) {
            for (let col = 0; col <= 8; col++) {
                const piece = this.board.pieces[row][col];
                if (piece && piece.type === PIECE_TYPES.KING && piece.side === side) {
                    return { row, col };
                }
            }
        }
        return null;
    }

    /**
     * 检查是否是人类玩家的回合
     */
    _isHumanTurn() {
        const side = this.board.currentSide;
        const player = side === 'red' ? this.config.redPlayer : this.config.blackPlayer;
        return player === 'human';
    }

    /**
     * 获取评估分数
     */
    getEvaluation() {
        const evaluator = this.aiInstances.greedy;
        return evaluator.evaluate(this.board.pieces, 'red');
    }

    /**
     * 获取走法历史
     */
    getMoveHistory() {
        return this.moveHistory.map((move, index) => {
            const notation = moveToChineseNotation(move, this.board.pieces);
            return {
                index: index + 1,
                move,
                notation,
                side: move.side
            };
        });
    }

    /**
     * 获取循环检测信息
     */
    getCycleInfo() {
        return {
            repeatCount: this.history.getRepeatCount(this.currentHash),
            noCaptureCount: this.history.getNoCaptureCount(),
            stats: this.history.getStats()
        };
    }

    /**
     * 睡眠函数
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
