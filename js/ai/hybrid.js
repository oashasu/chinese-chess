// 混合策略 AI - 结合 MCTS 和 Minimax 的优势

class HybridAI {
    constructor() {
        this.name = 'Hybrid';
        this.mcts = new MCTSAI(500);
        this.minimax = new MinimaxAI(3);
        this.evaluator = new GreedyAI();
        this.nodesSearched = 0;
    }

    /**
     * 选择最佳走法
     */
    getMove(board, side, timeLimit = 5000) {
        this.nodesSearched = 0;
        const startTime = performance.now();

        // 开局阶段（前10步）使用 MCTS
        const moveCount = this._countMoves(board);
        if (moveCount < 10) {
            return this.mcts.getMove(board, side, timeLimit);
        }

        // 残局阶段（棋子少于8个）使用 Minimax
        const pieceCount = this._countPieces(board);
        if (pieceCount <= 8) {
            return this.minimax.getMove(board, side, timeLimit);
        }

        // 中局使用混合策略
        return this._hybridSearch(board, side, timeLimit);
    }

    /**
     * 混合搜索
     */
    _hybridSearch(board, side, timeLimit) {
        const startTime = performance.now();

        // 第一阶段：MCTS 快速筛选候选走法
        const mctsTime = timeLimit * 0.4;
        const candidates = this._mctsCandidateSelection(board, side, mctsTime);

        // 第二阶段：Minimax 深度分析候选走法
        const remainingTime = timeLimit - (performance.now() - startTime);
        if (candidates.length === 0 || remainingTime <= 0) {
            return this.minimax.getMove(board, side, remainingTime);
        }

        // 对候选走法进行深度搜索
        let bestMove = null;
        let bestScore = -Infinity;

        for (const move of candidates) {
            const newBoard = MoveGenerator.makeMove(board, move);
            const score = this._minimaxWithMemo(newBoard, 4, -Infinity, Infinity, false, side);

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }

            // 超时检查
            if (performance.now() - startTime > timeLimit) {
                break;
            }
        }

        return bestMove || candidates[0];
    }

    /**
     * MCTS 候选筛选
     */
    _mctsCandidateSelection(board, side, timeLimit) {
        const startTime = performance.now();
        const root = new MCTSNode(null, null, side);
        root.untriedMoves = MoveGenerator.generateAllMoves(board, side);

        if (root.untriedMoves.length <= 3) {
            return root.untriedMoves;
        }

        // 快速模拟
        let iterations = 0;
        const maxIterations = 200;

        while (iterations < maxIterations && performance.now() - startTime < timeLimit) {
            this._simulateQuick(root, board, side);
            iterations++;
        }

        // 选择前 5 个最佳候选
        const scoredChildren = root.children.map(child => ({
            move: child.move,
            score: child.visits > 0 ? child.wins / child.visits : 0
        }));

        scoredChildren.sort((a, b) => b.score - a.score);
        return scoredChildren.slice(0, 5).map(c => c.move);
    }

    /**
     * 快速模拟（简化版）
     */
    _simulateQuick(root, board, side) {
        let node = root;
        let currentBoard = board.map(row => [...row]);
        let currentSide = side;

        // 选择
        while (node.isFullyExpanded() && node.children.length > 0) {
            node = node.selectBest();
            currentBoard = MoveGenerator.makeMove(currentBoard, node.move);
            currentSide = currentSide === 'red' ? 'black' : 'red';
        }

        // 扩展
        if (node.untriedMoves === null) {
            node.untriedMoves = MoveGenerator.generateAllMoves(currentBoard, currentSide);
        }

        if (node.untriedMoves.length > 0) {
            const moveIndex = Math.floor(Math.random() * node.untriedMoves.length);
            const move = node.untriedMoves.splice(moveIndex, 1)[0];

            const childNode = new MCTSNode(node, move, currentSide);
            node.children.push(childNode);
            node = childNode;

            currentBoard = MoveGenerator.makeMove(currentBoard, move);
            currentSide = currentSide === 'red' ? 'black' : 'red';
        }

        // 快速评估
        const winner = this._quickRollout(currentBoard, currentSide);

        // 回溯
        while (node !== null) {
            node.visits++;
            if (winner === node.side) {
                node.wins++;
            } else if (winner === 'draw') {
                node.wins += 0.5;
            }
            node = node.parent;
        }
    }

    /**
     * 快速模拟（10步）
     */
    _quickRollout(board, side) {
        let currentBoard = board.map(row => [...row]);
        let currentSide = side;
        let maxMoves = 10;

        while (maxMoves-- > 0) {
            const moves = MoveGenerator.generateAllMoves(currentBoard, currentSide);
            if (moves.length === 0) {
                return currentSide === 'red' ? 'black' : 'red';
            }

            const move = moves[Math.floor(Math.random() * moves.length)];
            currentBoard = MoveGenerator.makeMove(currentBoard, move);
            currentSide = currentSide === 'red' ? 'black' : 'red';
        }

        const score = this.evaluator.evaluate(currentBoard, 'red');
        if (score > 50) return 'red';
        if (score < -50) return 'black';
        return 'draw';
    }

    /**
     * Minimax 带记忆（简化版）
     */
    _minimaxWithMemo(board, depth, alpha, beta, isMaximizing, originalSide) {
        if (depth === 0) {
            return this.evaluator.evaluate(board, originalSide);
        }

        const currentSide = isMaximizing ? originalSide : (originalSide === 'red' ? 'black' : 'red');
        const moves = MoveGenerator.generateAllMoves(board, currentSide);

        if (moves.length === 0) {
            return isMaximizing ? -99999 : 99999;
        }

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                const newBoard = MoveGenerator.makeMove(board, move);
                const evalScore = this._minimaxWithMemo(newBoard, depth - 1, alpha, beta, false, originalSide);
                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                const newBoard = MoveGenerator.makeMove(board, move);
                const evalScore = this._minimaxWithMemo(newBoard, depth - 1, alpha, beta, true, originalSide);
                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    /**
     * 统计走法数
     */
    _countMoves(board) {
        // 简化：根据棋子位置估算
        let count = 0;
        for (let row = 0; row <= 9; row++) {
            for (let col = 0; col <= 8; col++) {
                const piece = board[row][col];
                if (piece && piece.type === PIECE_TYPES.PAWN) {
                    // 兵/卒的位置可以估算步数
                    if (piece.side === 'red') {
                        count += 6 - row;
                    } else {
                        count += row;
                    }
                }
            }
        }
        return Math.min(count, 20);
    }

    /**
     * 统计棋子数
     */
    _countPieces(board) {
        let count = 0;
        for (let row = 0; row <= 9; row++) {
            for (let col = 0; col <= 8; col++) {
                if (board[row][col]) count++;
            }
        }
        return count;
    }

    /**
     * 评估局面
     */
    evaluate(board, side) {
        return this.evaluator.evaluate(board, side);
    }

    /**
     * 获取搜索统计
     */
    getStats() {
        return {
            nodesSearched: this.nodesSearched
        };
    }
}
