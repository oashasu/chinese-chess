// Minimax + Alpha-Beta 剪枝 AI

class MinimaxAI {
    constructor(depth = 4) {
        this.name = 'Minimax';
        this.depth = depth;
        this.evaluator = new GreedyAI();
        this.nodesSearched = 0;
    }

    /**
     * 选择最佳走法
     */
    getMove(board, side, timeLimit = 5000) {
        this.nodesSearched = 0;
        const startTime = performance.now();

        let bestMove = null;
        let bestScore = side === 'red' ? -Infinity : Infinity;

        const moves = MoveGenerator.generateAllMoves(board, side);
        if (moves.length === 0) return null;

        // 迭代加深
        for (let currentDepth = 1; currentDepth <= this.depth; currentDepth++) {
            let currentBestMove = null;
            let currentBestScore = side === 'red' ? -Infinity : Infinity;

            // 打乱走法顺序增加随机性
            const shuffledMoves = shuffle(moves);

            for (const move of shuffledMoves) {
                // 超时检查
                if (performance.now() - startTime > timeLimit) {
                    return bestMove || move;
                }

                const newBoard = MoveGenerator.makeMove(board, move);
                const score = this._minimax(newBoard, currentDepth - 1, -Infinity, Infinity, false, side);

                // 红方最大化，黑方最小化（评估始终以红方为正方向）
                if (side === 'red') {
                    if (score > currentBestScore) {
                        currentBestScore = score;
                        currentBestMove = move;
                    }
                } else {
                    if (score < currentBestScore) {
                        currentBestScore = score;
                        currentBestMove = move;
                    }
                }
            }

            // 只有完整搜索完一层才更新最佳结果
            if (performance.now() - startTime <= timeLimit) {
                bestMove = currentBestMove;
                bestScore = currentBestScore;
            }
        }

        return bestMove;
    }

    /**
     * Minimax 搜索 + Alpha-Beta 剪枝
     */
    _minimax(board, depth, alpha, beta, isMaximizing, originalSide) {
        this.nodesSearched++;

        // 终止条件
        if (depth === 0) {
            return this.evaluator.evaluate(board, originalSide);
        }

        const currentSide = isMaximizing ? originalSide : (originalSide === 'red' ? 'black' : 'red');
        const moves = MoveGenerator.generateAllMoves(board, currentSide);

        // 无合法走法（被将死）
        if (moves.length === 0) {
            return isMaximizing ? -99999 : 99999;
        }

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                const newBoard = MoveGenerator.makeMove(board, move);
                const evalScore = this._minimax(newBoard, depth - 1, alpha, beta, false, originalSide);
                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);

                if (beta <= alpha) break; // Beta 剪枝
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                const newBoard = MoveGenerator.makeMove(board, move);
                const evalScore = this._minimax(newBoard, depth - 1, alpha, beta, true, originalSide);
                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);

                if (beta <= alpha) break; // Alpha 剪枝
            }
            return minEval;
        }
    }

    /**
     * 评估局面（委托给 GreedyAI）
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

/**
 * 带杀棋检测的 Minimax
 */
class MinimaxWithCheckAI extends MinimaxAI {
    constructor(depth = 4) {
        super(depth);
        this.name = 'Minimax+Check';
    }

    /**
     * 选择最佳走法（带杀棋检测）
     */
    getMove(board, side, timeLimit = 5000) {
        this.nodesSearched = 0;
        const startTime = performance.now();

        const moves = MoveGenerator.generateAllMoves(board, side);
        if (moves.length === 0) return null;

        // 优先检查是否能立即获胜
        for (const move of moves) {
            const newBoard = MoveGenerator.makeMove(board, move);
            if (this._isCheckmate(newBoard, side === 'red' ? 'black' : 'red')) {
                return move;
            }
        }

        // 检查是否必须应将
        const inCheck = this._isInCheck(board, side);
        const filteredMoves = inCheck ? this._filterCheckMoves(board, moves, side) : moves;

        if (filteredMoves.length === 0) return moves[0];

        // 正常搜索
        return super.getMove(board, side, timeLimit);
    }

    /**
     * 检查是否被将军
     */
    _isInCheck(board, side) {
        const kingPos = this._findKing(board, side);
        if (!kingPos) return false;

        const opponentSide = side === 'red' ? 'black' : 'red';
        const opponentMoves = MoveGenerator.generateAllMoves(board, opponentSide);

        return opponentMoves.some(move =>
            move.toRow === kingPos.row && move.toCol === kingPos.col
        );
    }

    /**
     * 查找将/帅位置
     */
    _findKing(board, side) {
        for (let row = 0; row <= 9; row++) {
            for (let col = 0; col <= 8; col++) {
                const piece = board[row][col];
                if (piece && piece.type === PIECE_TYPES.KING && piece.side === side) {
                    return { row, col };
                }
            }
        }
        return null;
    }

    /**
     * 检查是否被将死
     */
    _isCheckmate(board, side) {
        const moves = MoveGenerator.generateAllMoves(board, side);

        // 无合法走法
        if (moves.length === 0) return true;

        // 所有走法都会被将军
        const inCheck = this._isInCheck(board, side);
        if (!inCheck) return false;

        const validMoves = this._filterCheckMoves(board, moves, side);
        return validMoves.length === 0;
    }

    /**
     * 过滤掉被将军的走法
     */
    _filterCheckMoves(board, moves, side) {
        return moves.filter(move => {
            const newBoard = MoveGenerator.makeMove(board, move);
            return !this._isInCheck(newBoard, side);
        });
    }
}
