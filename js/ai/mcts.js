// 蒙特卡洛树搜索 (MCTS) AI - 类似 AlphaGo 的核心算法

class MCTSNode {
    constructor(parent, move, side) {
        this.parent = parent;
        this.move = move;
        this.side = side;  // 走这步棋的一方

        this.wins = 0;
        this.visits = 0;
        this.children = [];
        this.untriedMoves = null;  // 延迟生成
    }

    /**
     * UCB1 公式
     */
    ucb1(explorationParam = 1.414) {
        if (this.visits === 0) return Infinity;
        const exploitation = this.wins / this.visits;
        const exploration = explorationParam * Math.sqrt(Math.log(this.parent.visits) / this.visits);
        return exploitation + exploration;
    }

    /**
     * 是否完全展开
     */
    isFullyExpanded() {
        return this.untriedMoves !== null && this.untriedMoves.length === 0;
    }

    /**
     * 选择最佳子节点（UCB1）
     */
    selectBest() {
        let bestChild = null;
        let bestUCB = -Infinity;

        for (const child of this.children) {
            const ucb = child.ucb1();
            if (ucb > bestUCB) {
                bestUCB = ucb;
                bestChild = child;
            }
        }

        return bestChild;
    }
}

class MCTSAI {
    constructor(simulations = 1000, explorationParam = 1.414) {
        this.name = 'MCTS';
        this.simulations = simulations;
        this.explorationParam = explorationParam;
        this.evaluator = new GreedyAI();
        this.nodesSearched = 0;
    }

    /**
     * 选择最佳走法
     */
    getMove(board, side, timeLimit = 5000) {
        this.nodesSearched = 0;
        const startTime = performance.now();

        const root = new MCTSNode(null, null, side);
        root.untriedMoves = MoveGenerator.generateAllMoves(board, side);

        if (root.untriedMoves.length === 0) return null;

        // 如果只有一步合法走法，直接返回
        if (root.untriedMoves.length === 1) {
            return root.untriedMoves[0];
        }

        // 迭代模拟
        let iteration = 0;
        while (iteration < this.simulations) {
            // 超时检查
            if (performance.now() - startTime > timeLimit) {
                break;
            }

            this._simulate(root, board, side);
            iteration++;
        }

        // 选择访问次数最多的走法
        let bestMove = null;
        let maxVisits = -1;

        for (const child of root.children) {
            if (child.visits > maxVisits) {
                maxVisits = child.visits;
                bestMove = child.move;
            }
        }

        return bestMove;
    }

    /**
     * 执行一次模拟
     */
    _simulate(root, board, side) {
        let node = root;
        let currentBoard = board.map(row => [...row]);
        let currentSide = side;

        // 选择阶段（Selection）
        while (node.isFullyExpanded() && node.children.length > 0) {
            node = node.selectBest();
            // 防止选择到终局节点（无子节点的叶子）导致无限循环
            if (node.children.length === 0 && node.untriedMoves !== null && node.untriedMoves.length === 0) {
                break;
            }
            currentBoard = MoveGenerator.makeMove(currentBoard, node.move);
            currentSide = currentSide === 'red' ? 'black' : 'red';
        }

        // 扩展阶段（Expansion）
        if (!this._isTerminal(currentBoard, currentSide)) {
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
        }

        // 模拟阶段（Simulation / Rollout）
        const winner = this._rollout(currentBoard, currentSide);

        // 回溯阶段（Backpropagation）
        while (node !== null) {
            node.visits++;
            this.nodesSearched++;

            // 如果获胜方是走这步棋的一方，增加胜场
            if (winner === node.side) {
                node.wins++;
            } else if (winner === 'draw') {
                node.wins += 0.5;
            }

            node = node.parent;
        }
    }

    /**
     * 随机模拟（Rollout）
     */
    _rollout(board, side) {
        let currentBoard = board.map(row => [...row]);
        let currentSide = side;
        let maxMoves = 100;  // 防止无限循环

        while (maxMoves-- > 0) {
            if (this._isTerminal(currentBoard, currentSide)) {
                return this._getWinner(currentBoard, currentSide);
            }

            const moves = MoveGenerator.generateAllMoves(currentBoard, currentSide);
            if (moves.length === 0) {
                return currentSide === 'red' ? 'black' : 'red';  // 无子可动判负
            }

            // 随机选择一步
            const move = moves[Math.floor(Math.random() * moves.length)];
            currentBoard = MoveGenerator.makeMove(currentBoard, move);
            currentSide = currentSide === 'red' ? 'black' : 'red';
        }

        // 超过最大步数，使用评估函数判断
        const score = this.evaluator.evaluate(currentBoard, 'red');
        if (score > 50) return 'red';
        if (score < -50) return 'black';
        return 'draw';
    }

    /**
     * 检查是否终局
     */
    _isTerminal(board, side) {
        const moves = MoveGenerator.generateAllMoves(board, side);
        if (moves.length === 0) return true;

        // 检查将/帅是否被吃
        let redKing = false, blackKing = false;
        for (let row = 0; row <= 9; row++) {
            for (let col = 0; col <= 8; col++) {
                const piece = board[row][col];
                if (piece && piece.type === PIECE_TYPES.KING) {
                    if (piece.side === 'red') redKing = true;
                    if (piece.side === 'black') blackKing = true;
                }
            }
        }

        return !redKing || !blackKing;
    }

    /**
     * 获取获胜方
     */
    _getWinner(board, side) {
        let redKing = false, blackKing = false;
        for (let row = 0; row <= 9; row++) {
            for (let col = 0; col <= 8; col++) {
                const piece = board[row][col];
                if (piece && piece.type === PIECE_TYPES.KING) {
                    if (piece.side === 'red') redKing = true;
                    if (piece.side === 'black') blackKing = true;
                }
            }
        }

        if (!redKing) return 'black';
        if (!blackKing) return 'red';

        // 无合法走法
        const moves = MoveGenerator.generateAllMoves(board, side);
        if (moves.length === 0) {
            return side === 'red' ? 'black' : 'red';
        }

        return null;
    }

    /**
     * 获取搜索统计
     */
    getStats() {
        return {
            nodesSearched: this.nodesSearched,
            simulations: this.simulations
        };
    }
}

/**
 * RAVE (Rapid Action Value Estimation) 改进版 MCTS
 */
class MCTSRAVEAI extends MCTSAI {
    constructor(simulations = 1000, explorationParam = 1.414) {
        super(simulations, explorationParam);
        this.name = 'MCTS-RAVE';
        this.raveWeight = 0.5;
    }

    /**
     * 选择最佳走法（带 RAVE）
     */
    getMove(board, side, timeLimit = 5000) {
        // 使用标准 MCTS 实现，RAVE 优化在此简化版本中省略
        return super.getMove(board, side, timeLimit);
    }
}
