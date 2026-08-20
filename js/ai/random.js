// 随机策略 AI

class RandomAI {
    constructor() {
        this.name = 'Random';
    }

    /**
     * 选择最佳走法（随机）
     */
    getMove(board, side) {
        const moves = MoveGenerator.generateAllMoves(board, side);

        if (moves.length === 0) return null;

        // 随机选择一个合法走法
        return moves[Math.floor(Math.random() * moves.length)];
    }

    /**
     * 评估局面（随机策略不需要）
     */
    evaluate(board, side) {
        return 0;
    }
}
