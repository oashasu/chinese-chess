// 贪心策略 AI

class GreedyAI {
    constructor() {
        this.name = 'Greedy';
    }

    /**
     * 选择最佳走法（贪心）
     */
    getMove(board, side) {
        const moves = MoveGenerator.generateAllMoves(board, side);

        if (moves.length === 0) return null;

        let bestMove = null;
        let bestScore = -Infinity;

        for (const move of moves) {
            const newBoard = MoveGenerator.makeMove(board, move);
            const score = this.evaluate(newBoard, side);

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove;
    }

    /**
     * 评估局面
     */
    evaluate(board, side) {
        let score = 0;

        for (let row = 0; row <= 9; row++) {
            for (let col = 0; col <= 8; col++) {
                const piece = board[row][col];
                if (piece) {
                    const value = this._getPieceValue(piece, row, col);
                    if (piece.side === side) {
                        score += value;
                    } else {
                        score -= value;
                    }
                }
            }
        }

        return score;
    }

    /**
     * 获取棋子价值（包含位置权重）
     */
    _getPieceValue(piece, row, col) {
        const baseValue = PIECE_VALUES[piece.type];
        const positionBonus = this._getPositionBonus(piece, row, col);
        return baseValue + positionBonus;
    }

    /**
     * 位置加权
     */
    _getPositionBonus(piece, row, col) {
        switch (piece.type) {
            case PIECE_TYPES.KING:
                return 0;
            case PIECE_TYPES.ADVISOR:
                return this._advisorPositionBonus(row, col, piece.side);
            case PIECE_TYPES.ELEPHANT:
                return this._elephantPositionBonus(row, col, piece.side);
            case PIECE_TYPES.HORSE:
                return this._horsePositionBonus(row, col, piece.side);
            case PIECE_TYPES.ROOK:
                return this._rookPositionBonus(row, col, piece.side);
            case PIECE_TYPES.CANNON:
                return this._cannonPositionBonus(row, col, piece.side);
            case PIECE_TYPES.PAWN:
                return this._pawnPositionBonus(row, col, piece.side);
            default:
                return 0;
        }
    }

    /**
     * 仕/士位置加权
     */
    _advisorPositionBonus(row, col, side) {
        // 中心位置更好
        if (col === 4) return 2;
        return 0;
    }

    /**
     * 象/相位置加权
     */
    _elephantPositionBonus(row, col, side) {
        // 防守位置
        if (side === 'red') {
            if (row >= 7 && col >= 2 && col <= 6) return 3;
        } else {
            if (row <= 2 && col >= 2 && col <= 6) return 3;
        }
        return 0;
    }

    /**
     * 马位置加权
     */
    _horsePositionBonus(row, col, side) {
        // 中心位置更好，过河后价值增加
        const centerDistance = Math.abs(col - 4) + Math.abs(row - 4.5);
        let bonus = (8 - centerDistance) * 0.5;

        // 过河加分
        if (side === 'red' && row <= 4) bonus += 5;
        if (side === 'black' && row >= 5) bonus += 5;

        return bonus;
    }

    /**
     * 车位置加权
     */
    _rookPositionBonus(row, col, side) {
        // 开放线路更好
        let bonus = 0;

        // 中心列加分
        if (col >= 2 && col <= 6) bonus += 2;

        // 过河加分
        if (side === 'red' && row <= 4) bonus += 10;
        if (side === 'black' && row >= 5) bonus += 10;

        return bonus;
    }

    /**
     * 炮位置加权
     */
    _cannonPositionBonus(row, col, side) {
        let bonus = 0;

        // 中路炮价值高
        if (col === 4) bonus += 3;

        // 过河加分
        if (side === 'red' && row <= 4) bonus += 5;
        if (side === 'black' && row >= 5) bonus += 5;

        return bonus;
    }

    /**
     * 兵/卒位置加权
     */
    _pawnPositionBonus(row, col, side) {
        let bonus = 0;

        // 过河后价值大增
        if (side === 'red') {
            if (row <= 4) {
                bonus += 15;
                // 靠近敌方九宫
                if (row <= 2 && col >= 3 && col <= 5) bonus += 10;
            }
        } else {
            if (row >= 5) {
                bonus += 15;
                if (row >= 7 && col >= 3 && col <= 5) bonus += 10;
            }
        }

        // 中兵价值高
        if (col === 4) bonus += 2;

        return bonus;
    }
}
