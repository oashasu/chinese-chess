// 棋子定义和走法规则

/**
 * 棋子类
 */
class Piece {
    constructor(type, side, name) {
        this.type = type;      // 棋子类型
        this.side = side;      // 阵营 (red/black)
        this.name = name;      // 显示名称
    }

    /**
     * 克隆棋子
     */
    clone() {
        return new Piece(this.type, this.side, this.name);
    }
}

/**
 * 创建初始棋子
 */
function createInitialPieces() {
    const pieces = Array(10).fill(null).map(() => Array(9).fill(null));

    // 黑方 (上方, row 0-4)
    pieces[0][0] = new Piece(PIECE_TYPES.ROOK, 'black', '车');
    pieces[0][1] = new Piece(PIECE_TYPES.HORSE, 'black', '马');
    pieces[0][2] = new Piece(PIECE_TYPES.ELEPHANT, 'black', '象');
    pieces[0][3] = new Piece(PIECE_TYPES.ADVISOR, 'black', '士');
    pieces[0][4] = new Piece(PIECE_TYPES.KING, 'black', '将');
    pieces[0][5] = new Piece(PIECE_TYPES.ADVISOR, 'black', '士');
    pieces[0][6] = new Piece(PIECE_TYPES.ELEPHANT, 'black', '象');
    pieces[0][7] = new Piece(PIECE_TYPES.HORSE, 'black', '马');
    pieces[0][8] = new Piece(PIECE_TYPES.ROOK, 'black', '车');
    pieces[2][1] = new Piece(PIECE_TYPES.CANNON, 'black', '炮');
    pieces[2][7] = new Piece(PIECE_TYPES.CANNON, 'black', '炮');
    pieces[3][0] = new Piece(PIECE_TYPES.PAWN, 'black', '卒');
    pieces[3][2] = new Piece(PIECE_TYPES.PAWN, 'black', '卒');
    pieces[3][4] = new Piece(PIECE_TYPES.PAWN, 'black', '卒');
    pieces[3][6] = new Piece(PIECE_TYPES.PAWN, 'black', '卒');
    pieces[3][8] = new Piece(PIECE_TYPES.PAWN, 'black', '卒');

    // 红方 (下方, row 5-9)
    pieces[9][0] = new Piece(PIECE_TYPES.ROOK, 'red', '车');
    pieces[9][1] = new Piece(PIECE_TYPES.HORSE, 'red', '马');
    pieces[9][2] = new Piece(PIECE_TYPES.ELEPHANT, 'red', '相');
    pieces[9][3] = new Piece(PIECE_TYPES.ADVISOR, 'red', '仕');
    pieces[9][4] = new Piece(PIECE_TYPES.KING, 'red', '帅');
    pieces[9][5] = new Piece(PIECE_TYPES.ADVISOR, 'red', '仕');
    pieces[9][6] = new Piece(PIECE_TYPES.ELEPHANT, 'red', '相');
    pieces[9][7] = new Piece(PIECE_TYPES.HORSE, 'red', '马');
    pieces[9][8] = new Piece(PIECE_TYPES.ROOK, 'red', '车');
    pieces[7][1] = new Piece(PIECE_TYPES.CANNON, 'red', '炮');
    pieces[7][7] = new Piece(PIECE_TYPES.CANNON, 'red', '炮');
    pieces[6][0] = new Piece(PIECE_TYPES.PAWN, 'red', '兵');
    pieces[6][2] = new Piece(PIECE_TYPES.PAWN, 'red', '兵');
    pieces[6][4] = new Piece(PIECE_TYPES.PAWN, 'red', '兵');
    pieces[6][6] = new Piece(PIECE_TYPES.PAWN, 'red', '兵');
    pieces[6][8] = new Piece(PIECE_TYPES.PAWN, 'red', '兵');

    return pieces;
}

/**
 * 走法生成器
 */
class MoveGenerator {
    /**
     * 生成所有合法走法
     */
    static generateAllMoves(board, side) {
        const moves = [];

        for (let row = 0; row <= 9; row++) {
            for (let col = 0; col <= 8; col++) {
                const piece = board[row][col];
                if (piece && piece.side === side) {
                    const pieceMoves = this.generatePieceMoves(board, row, col);
                    moves.push(...pieceMoves);
                }
            }
        }

        return moves;
    }

    /**
     * 生成单个棋子的所有合法走法
     */
    static generatePieceMoves(board, row, col) {
        const piece = board[row][col];
        if (!piece) return [];

        let moves = [];

        switch (piece.type) {
            case PIECE_TYPES.KING:
                moves = this._generateKingMoves(board, row, col, piece.side);
                break;
            case PIECE_TYPES.ADVISOR:
                moves = this._generateAdvisorMoves(board, row, col, piece.side);
                break;
            case PIECE_TYPES.ELEPHANT:
                moves = this._generateElephantMoves(board, row, col, piece.side);
                break;
            case PIECE_TYPES.HORSE:
                moves = this._generateHorseMoves(board, row, col, piece.side);
                break;
            case PIECE_TYPES.ROOK:
                moves = this._generateRookMoves(board, row, col, piece.side);
                break;
            case PIECE_TYPES.CANNON:
                moves = this._generateCannonMoves(board, row, col, piece.side);
                break;
            case PIECE_TYPES.PAWN:
                moves = this._generatePawnMoves(board, row, col, piece.side);
                break;
        }

        return moves;
    }

    /**
     * 将/帅走法
     */
    static _generateKingMoves(board, row, col, side) {
        const moves = [];
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;

            // 九宫格限制
            if (!this._isInPalace(newRow, newCol, side)) continue;

            const target = board[newRow][newCol];
            if (!target || target.side !== side) {
                moves.push(this._createMove(row, col, newRow, newCol, target, side));
            }
        }

        // 将帅对面（飞将）
        const oppositeKing = this._findOppositeKing(board, row, col, side);
        if (oppositeKing && this._isSameColumn(col, oppositeKing.col) &&
            this._isClearPath(board, col, row, oppositeKing.row)) {
            moves.push(this._createMove(row, col, oppositeKing.row, oppositeKing.col,
                board[oppositeKing.row][oppositeKing.col], side));
        }

        return moves;
    }

    /**
     * 士/仕走法
     */
    static _generateAdvisorMoves(board, row, col, side) {
        const moves = [];
        const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;

            if (!this._isInPalace(newRow, newCol, side)) continue;

            const target = board[newRow][newCol];
            if (!target || target.side !== side) {
                moves.push(this._createMove(row, col, newRow, newCol, target, side));
            }
        }

        return moves;
    }

    /**
     * 象/相走法
     */
    static _generateElephantMoves(board, row, col, side) {
        const moves = [];
        const directions = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
        const blocks = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

        for (let i = 0; i < directions.length; i++) {
            const [dr, dc] = directions[i];
            const [br, bc] = blocks[i];
            const newRow = row + dr;
            const newCol = col + dc;

            // 不能过河
            if (!this._isInOwnSide(newRow, side)) continue;

            // 检查象眼
            if (board[row + br][col + bc]) continue;

            if (!isInBoard(newRow, newCol)) continue;

            const target = board[newRow][newCol];
            if (!target || target.side !== side) {
                moves.push(this._createMove(row, col, newRow, newCol, target, side));
            }
        }

        return moves;
    }

    /**
     * 马走法
     */
    static _generateHorseMoves(board, row, col, side) {
        const moves = [];
        const jumps = [
            [-2, -1, -1, 0], [-2, 1, -1, 0],
            [2, -1, 1, 0], [2, 1, 1, 0],
            [-1, -2, 0, -1], [-1, 2, 0, 1],
            [1, -2, 0, -1], [1, 2, 0, 1]
        ];

        for (const [dr, dc, br, bc] of jumps) {
            const newRow = row + dr;
            const newCol = col + dc;

            if (!isInBoard(newRow, newCol)) continue;

            // 检查马脚
            if (board[row + br][col + bc]) continue;

            const target = board[newRow][newCol];
            if (!target || target.side !== side) {
                moves.push(this._createMove(row, col, newRow, newCol, target, side));
            }
        }

        return moves;
    }

    /**
     * 车走法
     */
    static _generateRookMoves(board, row, col, side) {
        const moves = [];
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

        for (const [dr, dc] of directions) {
            let newRow = row + dr;
            let newCol = col + dc;

            while (isInBoard(newRow, newCol)) {
                const target = board[newRow][newCol];

                if (!target) {
                    moves.push(this._createMove(row, col, newRow, newCol, null, side));
                } else {
                    if (target.side !== side) {
                        moves.push(this._createMove(row, col, newRow, newCol, target, side));
                    }
                    break;
                }

                newRow += dr;
                newCol += dc;
            }
        }

        return moves;
    }

    /**
     * 炮走法
     */
    static _generateCannonMoves(board, row, col, side) {
        const moves = [];
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

        for (const [dr, dc] of directions) {
            let newRow = row + dr;
            let newCol = col + dc;
            let jumped = false;

            while (isInBoard(newRow, newCol)) {
                const target = board[newRow][newCol];

                if (!jumped) {
                    if (!target) {
                        moves.push(this._createMove(row, col, newRow, newCol, null, side));
                    } else {
                        jumped = true;
                    }
                } else {
                    if (target) {
                        if (target.side !== side) {
                            moves.push(this._createMove(row, col, newRow, newCol, target, side));
                        }
                        break;
                    }
                }

                newRow += dr;
                newCol += dc;
            }
        }

        return moves;
    }

    /**
     * 兵/卒走法
     */
    static _generatePawnMoves(board, row, col, side) {
        const moves = [];
        let forward = side === 'red' ? -1 : 1;
        const hasCrossedRiver = side === 'red' ? row <= 4 : row >= 5;

        // 前进
        const frontRow = row + forward;
        if (isInBoard(frontRow, col)) {
            const target = board[frontRow][col];
            if (!target || target.side !== side) {
                moves.push(this._createMove(row, col, frontRow, col, target, side));
            }
        }

        // 过河后可以横走
        if (hasCrossedRiver) {
            for (const dc of [-1, 1]) {
                const newCol = col + dc;
                if (isInBoard(row, newCol)) {
                    const target = board[row][newCol];
                    if (!target || target.side !== side) {
                        moves.push(this._createMove(row, col, row, newCol, target, side));
                    }
                }
            }
        }

        return moves;
    }

    /**
     * 检查是否在九宫格内
     */
    static _isInPalace(row, col, side) {
        if (col < 3 || col > 5) return false;
        if (side === 'red') {
            return row >= 7 && row <= 9;
        } else {
            return row >= 0 && row <= 2;
        }
    }

    /**
     * 检查是否在本方半场
     */
    static _isInOwnSide(row, side) {
        if (side === 'red') {
            return row >= 5;
        } else {
            return row <= 4;
        }
    }

    /**
     * 查找对方的将/帅
     */
    static _findOppositeKing(board, row, col, side) {
        const targetSide = side === 'red' ? 'black' : 'red';
        const startRow = targetSide === 'red' ? 7 : 0;
        const endRow = targetSide === 'red' ? 9 : 2;

        for (let r = startRow; r <= endRow; r++) {
            for (let c = 3; c <= 5; c++) {
                const piece = board[r][c];
                if (piece && piece.type === PIECE_TYPES.KING && piece.side === targetSide) {
                    return { row: r, col: c };
                }
            }
        }
        return null;
    }

    /**
     * 检查是否同列
     */
    static _isSameColumn(col1, col2) {
        return col1 === col2;
    }

    /**
     * 检查路径是否畅通
     */
    static _isClearPath(board, col, row1, row2) {
        const minRow = Math.min(row1, row2);
        const maxRow = Math.max(row1, row2);

        for (let r = minRow + 1; r < maxRow; r++) {
            if (board[r][col]) return false;
        }
        return true;
    }

    /**
     * 创建走法对象
     */
    static _createMove(fromRow, fromCol, toRow, toCol, captured, side) {
        return {
            fromRow,
            fromCol,
            toRow,
            toCol,
            captured,
            side
        };
    }

    /**
     * 执行走法
     */
    static makeMove(board, move) {
        const newBoard = board.map(row => row.map(cell => cell ? cell.clone() : null));

        // 移动棋子
        const piece = newBoard[move.fromRow][move.fromCol];
        newBoard[move.toRow][move.toCol] = piece;
        newBoard[move.fromRow][move.fromCol] = null;

        return newBoard;
    }
}
