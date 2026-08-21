/**
 * AlphaZero ONNX AI - 基于神经网络的象棋 AI
 *
 * 使用 ONNX Runtime Web 在浏览器内运行训练好的神经网络模型
 * 结合 MCTS 搜索，实现 AlphaZero 风格的棋力
 */

class AlphaZeroAI {
    constructor(modelPath, mctsSimulations = 200, explorationParam = 1.414) {
        this.name = 'AlphaZero';
        this.modelPath = modelPath;
        this.simulations = mctsSimulations;
        this.explorationParam = explorationParam;

        this.session = null;
        this.modelLoaded = false;
        this.nodesSearched = 0;
    }

    /**
     * 加载 ONNX 模型
     */
    async loadModel() {
        if (this.modelLoaded) return;

        try {
            // 动态加载 ONNX Runtime Web
            if (typeof ort === 'undefined') {
                throw new Error('ONNX Runtime 未加载');
            }

            this.session = await ort.InferenceSession.create(this.modelPath, {
                executionProviders: ['wasm']
            });

            this.modelLoaded = true;
            console.log('AlphaZero 模型加载成功');
        } catch (error) {
            console.error('模型加载失败:', error);
            throw error;
        }
    }

    /**
     * 选择最佳走法
     */
    async getMove(board, side, timeLimit = 5000) {
        if (!this.modelLoaded) {
            await this.loadModel();
        }

        this.nodesSearched = 0;
        const startTime = performance.now();

        // 生成所有合法走法
        const validMoves = MoveGenerator.generateAllMoves(board, side);
        if (validMoves.length === 0) return null;

        // 如果只有一步合法走法，直接返回
        if (validMoves.length === 1) {
            return validMoves[0];
        }

        // 获取合法走法掩码
        const validMask = this._getValidMovesMask(validMoves);

        // 获取当前棋盘状态张量
        const stateTensor = this._boardToTensor(board, side);

        // 神经网络评估根节点
        const rootPolicy = await this._evaluate(stateTensor);

        // 创建 MCTS 根节点
        const root = this._createMCTSNode(null, null, side, rootPolicy, validMask);

        // MCTS 搜索
        let iteration = 0;
        while (iteration < this.simulations) {
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
            if (child.visitCount > maxVisits) {
                maxVisits = child.visitCount;
                bestMove = child.move;
            }
        }

        return bestMove;
    }

    /**
     * 评估棋盘状态
     */
    async _evaluate(stateTensor) {
        const feeds = {
            input: new ort.Tensor('float32', stateTensor, [1, 14, 10, 9])
        };

        const results = await this.session.run(feeds);

        const policy = results.policy.data;
        const value = results.value.data[0];

        return { policy: Array.from(policy), value: value };
    }

    /**
     * 棋盘状态转张量
     */
    _boardToTensor(board, side) {
        const tensor = new Float32Array(14 * 10 * 9);

        for (let row = 0; row <= 9; row++) {
            for (let col = 0; col <= 8; col++) {
                const piece = board[row][col];
                if (piece) {
                    const pieceType = Object.values(PIECE_TYPES).indexOf(piece.type);
                    const sideOffset = piece.side === 'red' ? 0 : 7;
                    const index = (pieceType + sideOffset) * 90 + row * 9 + col;
                    tensor[index] = 1.0;
                }
            }
        }

        return tensor;
    }

    /**
     * 获取合法走法掩码
     */
    _getValidMovesMask(validMoves) {
        const mask = new Array(8100).fill(0);

        for (const move of validMoves) {
            const fromIdx = move.fromRow * 9 + move.fromCol;
            const toIdx = move.toRow * 9 + move.toCol;
            const actionIdx = fromIdx * 90 + toIdx;
            mask[actionIdx] = 1;
        }

        return mask;
    }

    /**
     * 创建 MCTS 节点
     */
    _createMCTSNode(parent, move, side, policy, validMask) {
        const node = {
            parent: parent,
            move: move,
            side: side,
            visitCount: 0,
            valueSum: 0,
            children: [],
            expanded: false,
            policy: policy,
            validMask: validMask
        };

        return node;
    }

    /**
     * MCTS 模拟
     */
    async _simulate(root, board, side) {
        let node = root;
        let currentBoard = board.map(row => [...row]);
        let currentSide = side;

        // 选择阶段
        while (node.expanded && node.children.length > 0) {
            node = this._selectBestChild(node);
            currentBoard = MoveGenerator.makeMove(currentBoard, node.move);
            currentSide = currentSide === 'red' ? 'black' : 'red';
        }

        // 扩展阶段
        if (!node.expanded) {
            const stateTensor = this._boardToTensor(currentBoard, currentSide);
            const evalResult = await this._evaluate(stateTensor);

            // 获取当前局面的合法走法
            const currentMoves = MoveGenerator.generateAllMoves(currentBoard, currentSide);
            const currentMask = this._getValidMovesMask(currentMoves);

            // 展开子节点
            const validIndices = currentMask.map((v, i) => v ? i : -1).filter(i => i !== -1);
            const totalProb = validIndices.reduce((sum, idx) => sum + evalResult.policy[idx], 0);

            for (const idx of validIndices) {
                const prior = totalProb > 0 ? evalResult.policy[idx] / totalProb : 1.0 / validIndices.length;

                // 解码走法
                const fromIdx = Math.floor(idx / 90);
                const toIdx = idx % 90;
                const fromRow = Math.floor(fromIdx / 9);
                const fromCol = fromIdx % 9;
                const toRow = Math.floor(toIdx / 9);
                const toCol = toIdx % 9;

                const captured = currentBoard[toRow][toCol];
                const move = {
                    fromRow, fromCol, toRow, toCol,
                    captured: captured,
                    side: currentSide
                };

                const child = this._createMCTSNode(node, move, currentSide, evalResult.policy, currentMask);
                node.children.push(child);
            }

            node.expanded = true;

            // 反向传播
            this._backup(node, evalResult.value);
        }
    }

    /**
     * 选择最佳子节点（PUCT 公式）
     */
    _selectBestChild(node) {
        let bestChild = null;
        let bestScore = -Infinity;

        for (const child of node.children) {
            const q = child.visitCount > 0 ? child.valueSum / child.visitCount : 0;
            const u = this.explorationParam * child.policy * Math.sqrt(node.visitCount) / (1 + child.visitCount);
            const score = q + u;

            if (score > bestScore) {
                bestScore = score;
                bestChild = child;
            }
        }

        return bestChild;
    }

    /**
     * 反向传播
     */
    _backup(node, value) {
        while (node !== null) {
            node.visitCount++;
            node.valueSum += value;
            value = -value; // 零和博弈，翻转视角
            node = node.parent;
        }
    }

    /**
     * 获取搜索统计
     */
    getStats() {
        return {
            nodesSearched: this.nodesSearched,
            simulations: this.simulations,
            modelLoaded: this.modelLoaded
        };
    }
}
