// Zobrist Hashing - 用于快速局面哈希和循环检测

class ZobristHash {
    constructor() {
        // 初始化随机数表
        this.pieceTable = {};  // [side][type][row][col] -> hash
        this.sideHash = 0;     // 轮到哪方走子的哈希

        this._initRandomTable();
    }

    /**
     * 初始化随机数表
     */
    _initRandomTable() {
        const sides = ['red', 'black'];
        const types = ['king', 'advisor', 'elephant', 'horse', 'rook', 'cannon', 'pawn'];

        for (const side of sides) {
            this.pieceTable[side] = {};
            for (const type of types) {
                this.pieceTable[side][type] = [];
                for (let row = 0; row <= 9; row++) {
                    this.pieceTable[side][type][row] = [];
                    for (let col = 0; col <= 8; col++) {
                        this.pieceTable[side][type][row][col] = this._random64();
                    }
                }
            }
        }

        this.sideHash = this._random64();
    }

    /**
     * 生成 64 位随机数
     */
    _random64() {
        // 使用两个 32 位随机数组合成 64 位
        const high = Math.floor(Math.random() * 0x100000000);
        const low = Math.floor(Math.random() * 0x100000000);
        return (BigInt(high) << 32n) | BigInt(low);
    }

    /**
     * 计算初始局面的哈希值
     */
    computeHash(board) {
        let hash = 0n;

        for (let row = 0; row <= 9; row++) {
            for (let col = 0; col <= 8; col++) {
                const piece = board[row][col];
                if (piece) {
                    hash ^= this.pieceTable[piece.side][piece.type][row][col];
                }
            }
        }

        // 如果是黑方走子，异或 sideHash
        if (board.currentSide === 'black') {
            hash ^= this.sideHash;
        }

        return hash;
    }

    /**
     * 增量更新哈希值（走子后）
     */
    updateHash(hash, move, board) {
        let newHash = hash;

        // 移除起始位置的棋子
        const piece = board[move.fromRow][move.fromCol];
        if (piece) {
            newHash ^= this.pieceTable[piece.side][piece.type][move.fromRow][move.fromCol];
        }

        // 如果目标位置有棋子（吃子），移除被吃的棋子
        const captured = board[move.toRow][move.toCol];
        if (captured) {
            newHash ^= this.pieceTable[captured.side][captured.type][move.toRow][move.toCol];
        }

        // 添加目标位置的棋子
        if (piece) {
            newHash ^= this.pieceTable[piece.side][piece.type][move.toRow][move.toCol];
        }

        // 切换走子方
        newHash ^= this.sideHash;

        return newHash;
    }
}

/**
 * 局面历史记录器 - 用于检测重复局面和长将
 */
class PositionHistory {
    constructor() {
        this.history = new Map();  // hash -> count
        this.moveHistory = [];     // 走法历史
        this.captureHistory = [];  // 吃子历史（用于60步规则）
        this.checkHistory = [];    // 将军历史（用于长将检测）
    }

    /**
     * 记录一步走法
     */
    recordMove(hash, move, isInCheck) {
        // 更新局面计数
        this.history.set(hash, (this.history.get(hash) || 0) + 1);

        // 记录走法
        this.moveHistory.push({
            hash,
            move,
            timestamp: Date.now()
        });

        // 记录是否吃子
        const isCapture = move.captured !== null;
        this.captureHistory.push(isCapture);

        // 记录是否将军
        this.checkHistory.push(isInCheck);
    }

    /**
     * 检查是否三次重复局面
     */
    isThreefoldRepetition(hash) {
        return (this.history.get(hash) || 0) >= 3;
    }

    /**
     * 获取局面重复次数
     */
    getRepeatCount(hash) {
        return this.history.get(hash) || 0;
    }

    /**
     * 检查 60 步无吃子规则
     */
    isSixtyMoveRule() {
        if (this.captureHistory.length < 60) return false;

        // 检查最近 60 步是否有吃子
        const recent60 = this.captureHistory.slice(-60);
        return !recent60.some(captured => captured);
    }

    /**
     * 获取无吃子步数
     */
    getNoCaptureCount() {
        let count = 0;
        for (let i = this.captureHistory.length - 1; i >= 0; i--) {
            if (this.captureHistory[i]) break;
            count++;
        }
        return count;
    }

    /**
     * 检测长将（连续将军同一局面）
     * 规则：连续将军同一局面超过3次判负
     */
    detectPerpetualCheck(hash, currentSide) {
        // 查找相同局面的所有出现
        const occurrences = this.moveHistory.filter(m => m.hash === hash);

        if (occurrences.length < 3) return false;

        // 检查最近3次是否都是将军
        const last3Checks = this.checkHistory.slice(-6, -1);
        const allChecks = last3Checks.every(isCheck => isCheck);

        // 检查是否同一方在将军
        const last3Moves = occurrences.slice(-3);
        const sameSide = last3Moves.every(m => {
            const move = this.moveHistory.find(h => h.hash === m.hash);
            return move && move.move.side === currentSide;
        });

        return allChecks && sameSide;
    }

    /**
     * 悔棋 - 移除最后一步
     */
    undoLastMove() {
        if (this.moveHistory.length === 0) return;

        const lastMove = this.moveHistory.pop();
        const count = this.history.get(lastMove.hash);
        if (count === 1) {
            this.history.delete(lastMove.hash);
        } else {
            this.history.set(lastMove.hash, count - 1);
        }

        this.captureHistory.pop();
        this.checkHistory.pop();
    }

    /**
     * 清空历史
     */
    clear() {
        this.history.clear();
        this.moveHistory = [];
        this.captureHistory = [];
        this.checkHistory = [];
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            totalMoves: this.moveHistory.length,
            uniquePositions: this.history.size,
            noCaptureCount: this.getNoCaptureCount()
        };
    }
}
