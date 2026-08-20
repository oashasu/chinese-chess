// 工具函数库

/**
 * 深拷贝对象
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => deepClone(item));
    const cloned = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
}

/**
 * 生成随机整数 [min, max]
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 打乱数组
 */
function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * 坐标转换：棋盘坐标 -> 像素坐标
 */
function boardToPixel(row, col, cellSize, offsetX, offsetY) {
    return {
        x: offsetX + col * cellSize,
        y: offsetY + row * cellSize
    };
}

/**
 * 坐标转换：像素坐标 -> 棋盘坐标
 */
function pixelToBoard(x, y, cellSize, offsetX, offsetY) {
    const col = Math.round((x - offsetX) / cellSize);
    const row = Math.round((y - offsetY) / cellSize);
    return { row, col };
}

/**
 * 检查坐标是否在棋盘范围内
 */
function isInBoard(row, col) {
    return row >= 0 && row <= 9 && col >= 0 && col <= 8;
}

/**
 * 中国象棋坐标转中文记谱
 */
function moveToChineseNotation(move, pieces) {
    const piece = pieces[move.fromRow][move.fromCol];
    if (!piece) return '';

    const pieceName = piece.name;
    const side = piece.side;

    // 列编号（红方从右到左1-9，黑方从右到左1-9）
    let fromCol, toCol;
    if (side === 'red') {
        fromCol = 9 - move.fromCol;
        toCol = 9 - move.toCol;
    } else {
        fromCol = move.fromCol + 1;
        toCol = move.toCol + 1;
    }

    const action = move.toRow < move.fromRow ? '进' : (move.toRow > move.fromRow ? '退' : '平');

    let dest;
    if (action === '平') {
        dest = toCol.toString();
    } else {
        const steps = Math.abs(move.toRow - move.fromRow);
        dest = steps.toString();
    }

    return `${pieceName}${fromCol}${action}${dest}`;
}

/**
 * 计算两点间距离
 */
function distance(r1, c1, r2, c2) {
    return Math.sqrt(Math.pow(r2 - r1, 2) + Math.pow(c2 - c1, 2));
}

/**
 * 格式化时间（毫秒 -> 秒）
 */
function formatTime(ms) {
    return (ms / 1000).toFixed(2) + 's';
}

/**
 * 性能计时器
 */
class Timer {
    constructor() {
        this.startTime = 0;
    }

    start() {
        this.startTime = performance.now();
    }

    stop() {
        return performance.now() - this.startTime;
    }
}

// 棋子类型常量
const PIECE_TYPES = {
    KING: 'king',      // 将/帅
    ADVISOR: 'advisor', // 士/仕
    ELEPHANT: 'elephant', // 象/相
    HORSE: 'horse',    // 马
    ROOK: 'rook',      // 车
    CANNON: 'cannon',  // 炮
    PAWN: 'pawn'       // 卒/兵
};

// 阵营常量
const SIDES = {
    RED: 'red',
    BLACK: 'black'
};

// 棋子初始价值
const PIECE_VALUES = {
    king: 10000,
    advisor: 20,
    elephant: 20,
    horse: 40,
    rook: 90,
    cannon: 45,
    pawn: 10
};
