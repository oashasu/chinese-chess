// 棋盘渲染和逻辑

class ChessBoard {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // 棋盘配置
        this.cellSize = 70;
        this.offsetX = 40;
        this.offsetY = 40;

        // 棋盘状态
        this.pieces = null;
        this.currentSide = 'red';
        this.selectedPiece = null;
        this.validMoves = [];
        this.lastMove = null;
        this.highlightedSquares = [];

        // 初始化
        this._initBoard();
    }

    /**
     * 初始化棋盘
     */
    _initBoard() {
        this.pieces = createInitialPieces();
        this.currentSide = 'red';
        this.selectedPiece = null;
        this.validMoves = [];
        this.lastMove = null;
        this.highlightedSquares = [];
    }

    /**
     * 重置棋盘
     */
    reset() {
        this._initBoard();
        this.render();
    }

    /**
     * 渲染棋盘
     */
    render() {
        this._drawBoard();
        this._drawHighlights();
        this._drawPieces();
    }

    /**
     * 绘制棋盘背景
     */
    _drawBoard() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // 背景
        ctx.fillStyle = '#f0d9b5';
        ctx.fillRect(0, 0, width, height);

        // 边框
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 3;
        ctx.strokeRect(
            this.offsetX - 10,
            this.offsetY - 10,
            this.cellSize * 8 + 20,
            this.cellSize * 9 + 20
        );

        // 网格线
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;

        // 横线
        for (let row = 0; row <= 9; row++) {
            const y = this.offsetY + row * this.cellSize;
            ctx.beginPath();
            ctx.moveTo(this.offsetX, y);
            ctx.lineTo(this.offsetX + 8 * this.cellSize, y);
            ctx.stroke();
        }

        // 竖线
        for (let col = 0; col <= 8; col++) {
            // 上半部分
            if (col === 0 || col === 8) {
                ctx.beginPath();
                ctx.moveTo(this.offsetX + col * this.cellSize, this.offsetY);
                ctx.lineTo(this.offsetX + col * this.cellSize, this.offsetY + 9 * this.cellSize);
                ctx.stroke();
            } else {
                // 中间断开（楚河汉界）
                ctx.beginPath();
                ctx.moveTo(this.offsetX + col * this.cellSize, this.offsetY);
                ctx.lineTo(this.offsetX + col * this.cellSize, this.offsetY + 4 * this.cellSize);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(this.offsetX + col * this.cellSize, this.offsetY + 5 * this.cellSize);
                ctx.lineTo(this.offsetX + col * this.cellSize, this.offsetY + 9 * this.cellSize);
                ctx.stroke();
            }
        }

        // 九宫格斜线
        this._drawPalaceLines(0, 3, 2, 5);  // 黑方九宫
        this._drawPalaceLines(7, 3, 9, 5);  // 红方九宫

        // 楚河汉界
        ctx.fillStyle = '#f0d9b5';
        ctx.fillRect(
            this.offsetX + 1,
            this.offsetY + 4 * this.cellSize + 1,
            8 * this.cellSize - 2,
            this.cellSize - 2
        );

        ctx.font = 'bold 36px serif';
        ctx.fillStyle = '#8b4513';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const riverY = this.offsetY + 4.5 * this.cellSize;
        ctx.fillText('楚 河', this.offsetX + 2 * this.cellSize, riverY);
        ctx.fillText('汉 界', this.offsetX + 6 * this.cellSize, riverY);

        // 兵/卒位置标记
        this._drawPositionMarkers();
    }

    /**
     * 绘制九宫格斜线
     */
    _drawPalaceLines(startRow, startCol, endRow, endCol) {
        const ctx = this.ctx;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;

        // 左上到右下
        ctx.beginPath();
        ctx.moveTo(this.offsetX + startCol * this.cellSize, this.offsetY + startRow * this.cellSize);
        ctx.lineTo(this.offsetX + endCol * this.cellSize, this.offsetY + endRow * this.cellSize);
        ctx.stroke();

        // 右上到左下
        ctx.beginPath();
        ctx.moveTo(this.offsetX + endCol * this.cellSize, this.offsetY + startRow * this.cellSize);
        ctx.lineTo(this.offsetX + startCol * this.cellSize, this.offsetY + endRow * this.cellSize);
        ctx.stroke();
    }

    /**
     * 绘制位置标记（兵/卒、炮位）
     */
    _drawPositionMarkers() {
        const ctx = this.ctx;
        const positions = [
            // 黑方炮位
            { row: 2, col: 1 }, { row: 2, col: 7 },
            // 黑方卒位
            { row: 3, col: 0 }, { row: 3, col: 2 }, { row: 3, col: 4 },
            { row: 3, col: 6 }, { row: 3, col: 8 },
            // 红方炮位
            { row: 7, col: 1 }, { row: 7, col: 7 },
            // 红方兵位
            { row: 6, col: 0 }, { row: 6, col: 2 }, { row: 6, col: 4 },
            { row: 6, col: 6 }, { row: 6, col: 8 }
        ];

        for (const pos of positions) {
            this._drawMarker(pos.row, pos.col);
        }
    }

    /**
     * 绘制单个标记
     */
    _drawMarker(row, col) {
        const ctx = this.ctx;
        const x = this.offsetX + col * this.cellSize;
        const y = this.offsetY + row * this.cellSize;
        const size = 5;
        const gap = 3;

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;

        // 四个角
        const corners = [
            [-1, -1], [1, -1], [-1, 1], [1, 1]
        ];

        for (const [dx, dy] of corners) {
            // 边缘不绘制
            if ((col === 0 && dx === -1) || (col === 8 && dx === 1)) continue;

            const startX = x + dx * gap;
            const startY = y + dy * gap;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(startX + dx * size, startY);
            ctx.moveTo(startX, startY);
            ctx.lineTo(startX, startY + dy * size);
            ctx.stroke();
        }
    }

    /**
     * 绘制高亮
     */
    _drawHighlights() {
        const ctx = this.ctx;

        // 最后一步高亮
        if (this.lastMove) {
            ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            const fromPos = boardToPixel(this.lastMove.fromRow, this.lastMove.fromCol,
                this.cellSize, this.offsetX, this.offsetY);
            const toPos = boardToPixel(this.lastMove.toRow, this.lastMove.toCol,
                this.cellSize, this.offsetX, this.offsetY);

            ctx.fillRect(fromPos.x - 30, fromPos.y - 30, 60, 60);
            ctx.fillRect(toPos.x - 30, toPos.y - 30, 60, 60);
        }

        // 选中棋子高亮
        if (this.selectedPiece) {
            const pos = boardToPixel(this.selectedPiece.row, this.selectedPiece.col,
                this.cellSize, this.offsetX, this.offsetY);
            ctx.fillStyle = 'rgba(0, 255, 0, 0.4)';
            ctx.fillRect(pos.x - 32, pos.y - 32, 64, 64);

            // 合法走法提示
            for (const move of this.validMoves) {
                const movePos = boardToPixel(move.toRow, move.toCol,
                    this.cellSize, this.offsetX, this.offsetY);
                ctx.fillStyle = 'rgba(0, 150, 255, 0.4)';
                ctx.beginPath();
                ctx.arc(movePos.x, movePos.y, 10, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 自定义高亮
        for (const sq of this.highlightedSquares) {
            const pos = boardToPixel(sq.row, sq.col,
                this.cellSize, this.offsetX, this.offsetY);
            ctx.fillStyle = sq.color || 'rgba(255, 215, 0, 0.5)';
            ctx.fillRect(pos.x - 30, pos.y - 30, 60, 60);
        }
    }

    /**
     * 绘制棋子
     */
    _drawPieces() {
        for (let row = 0; row <= 9; row++) {
            for (let col = 0; col <= 8; col++) {
                const piece = this.pieces[row][col];
                if (piece) {
                    this._drawPiece(row, col, piece);
                }
            }
        }
    }

    /**
     * 绘制单个棋子
     */
    _drawPiece(row, col, piece) {
        const ctx = this.ctx;
        const pos = boardToPixel(row, col, this.cellSize, this.offsetX, this.offsetY);

        // 棋子底座（圆形）
        const radius = 28;

        // 阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(pos.x + 2, pos.y + 2, radius, 0, Math.PI * 2);
        ctx.fill();

        // 棋子本体
        const gradient = ctx.createRadialGradient(pos.x - 5, pos.y - 5, 5, pos.x, pos.y, radius);
        gradient.addColorStop(0, '#fff8dc');
        gradient.addColorStop(1, '#daa520');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // 棋子边框
        ctx.strokeStyle = piece.side === 'red' ? '#c41e3a' : '#1a1a1a';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 棋子文字
        ctx.font = 'bold 28px serif';
        ctx.fillStyle = piece.side === 'red' ? '#c41e3a' : '#1a1a1a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(piece.name, pos.x, pos.y);
    }

    /**
     * 点击处理
     */
    handleClick(x, y) {
        const { row, col } = pixelToBoard(x, y, this.cellSize, this.offsetX, this.offsetY);

        if (!isInBoard(row, col)) return null;

        const clickedPiece = this.pieces[row][col];

        // 如果已选中棋子
        if (this.selectedPiece) {
            // 点击自己的其他棋子，切换选中
            if (clickedPiece && clickedPiece.side === this.currentSide) {
                this.selectPiece(row, col);
                return null;
            }

            // 尝试走子
            const move = this.validMoves.find(m => m.toRow === row && m.toCol === col);
            if (move) {
                this.clearSelection();
                return move;
            }

            // 点击无效位置，取消选中
            this.clearSelection();
            return null;
        }

        // 未选中棋子，尝试选中
        if (clickedPiece && clickedPiece.side === this.currentSide) {
            this.selectPiece(row, col);
        }

        return null;
    }

    /**
     * 选中棋子
     */
    selectPiece(row, col) {
        this.selectedPiece = { row, col };
        const piece = this.pieces[row][col];
        this.validMoves = MoveGenerator.generatePieceMoves(this.pieces, row, col);
        this.render();
    }

    /**
     * 清除选中
     */
    clearSelection() {
        this.selectedPiece = null;
        this.validMoves = [];
        this.render();
    }

    /**
     * 执行走法
     */
    makeMove(move) {
        this.pieces = MoveGenerator.makeMove(this.pieces, move);
        this.lastMove = move;
        this.currentSide = this.currentSide === 'red' ? 'black' : 'red';
        this.clearSelection();
    }

    /**
     * 悔棋
     */
    undoMove(move) {
        // 将棋子移回原位
        const piece = this.pieces[move.toRow][move.toCol];
        this.pieces[move.fromRow][move.fromCol] = piece;
        this.pieces[move.toRow][move.toCol] = move.captured;

        this.lastMove = null;
        this.currentSide = this.currentSide === 'red' ? 'black' : 'red';
        this.clearSelection();
    }

    /**
     * 设置高亮
     */
    setHighlights(squares) {
        this.highlightedSquares = squares;
        this.render();
    }

    /**
     * 清除高亮
     */
    clearHighlights() {
        this.highlightedSquares = [];
        this.render();
    }

    /**
     * 获取棋盘状态（用于AI）
     */
    getState() {
        return {
            pieces: this.pieces,
            currentSide: this.currentSide
        };
    }

    /**
     * 设置棋盘状态
     */
    setState(state) {
        this.pieces = state.pieces;
        this.currentSide = state.currentSide;
        this.render();
    }
}
