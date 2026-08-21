# 象棋规则引擎 - Python 实现

"""
中国象棋规则：
- 9x10 棋盘（9列×10行）
- 红方在下方（行7-9为九宫），黑方在上方（行0-2为九宫）
- 棋子：帅/将、仕/士、相/象、马、车、炮、兵/卒
"""

from enum import IntEnum
from dataclasses import dataclass
from typing import List, Optional, Tuple
import copy

# 棋子类型枚举
class PieceType(IntEnum):
    KING = 0      # 帅/将
    ADVISOR = 1   # 仕/士
    ELEPHANT = 2  # 相/象
    HORSE = 3     # 马
    ROOK = 4      # 车
    CANNON = 5    # 炮
    PAWN = 6      # 兵/卒

# 阵营
RED = 0
BLACK = 1

# 棋盘尺寸
BOARD_ROWS = 10
BOARD_COLS = 9

# 走法表示
@dataclass
class Move:
    from_row: int
    from_col: int
    to_row: int
    to_col: int
    piece_type: int
    captured: Optional[int] = None  # 被吃棋子类型，None表示未吃子

    def __repr__(self):
        return f"Move({self.from_row},{self.from_col}->{self.to_row},{self.to_col})"


class XiangqiRules:
    """中国象棋规则引擎"""

    @staticmethod
    def create_initial_board() -> List[List[Optional[Tuple[int, int]]]]:
        """创建初始棋盘，返回 10×9 的二维数组，每个元素为 (piece_type, side) 或 None"""
        board = [[None] * BOARD_COLS for _ in range(BOARD_ROWS)]

        # 黑方 (上方, 行0-4)
        # 第一行：车马象士将士象马车
        board[0][0] = (PieceType.ROOK, BLACK)
        board[0][1] = (PieceType.HORSE, BLACK)
        board[0][2] = (PieceType.ELEPHANT, BLACK)
        board[0][3] = (PieceType.ADVISOR, BLACK)
        board[0][4] = (PieceType.KING, BLACK)
        board[0][5] = (PieceType.ADVISOR, BLACK)
        board[0][6] = (PieceType.ELEPHANT, BLACK)
        board[0][7] = (PieceType.HORSE, BLACK)
        board[0][8] = (PieceType.ROOK, BLACK)
        # 炮位
        board[2][1] = (PieceType.CANNON, BLACK)
        board[2][7] = (PieceType.CANNON, BLACK)
        # 卒位
        board[3][0] = (PieceType.PAWN, BLACK)
        board[3][2] = (PieceType.PAWN, BLACK)
        board[3][4] = (PieceType.PAWN, BLACK)
        board[3][6] = (PieceType.PAWN, BLACK)
        board[3][8] = (PieceType.PAWN, BLACK)

        # 红方 (下方, 行5-9)
        board[9][0] = (PieceType.ROOK, RED)
        board[9][1] = (PieceType.HORSE, RED)
        board[9][2] = (PieceType.ELEPHANT, RED)
        board[9][3] = (PieceType.ADVISOR, RED)
        board[9][4] = (PieceType.KING, RED)
        board[9][5] = (PieceType.ADVISOR, RED)
        board[9][6] = (PieceType.ELEPHANT, RED)
        board[9][7] = (PieceType.HORSE, RED)
        board[9][8] = (PieceType.ROOK, RED)
        # 炮位
        board[7][1] = (PieceType.CANNON, RED)
        board[7][7] = (PieceType.CANNON, RED)
        # 兵位
        board[6][0] = (PieceType.PAWN, RED)
        board[6][2] = (PieceType.PAWN, RED)
        board[6][4] = (PieceType.PAWN, RED)
        board[6][6] = (PieceType.PAWN, RED)
        board[6][8] = (PieceType.PAWN, RED)

        return board

    @staticmethod
    def is_in_board(row: int, col: int) -> bool:
        return 0 <= row < BOARD_ROWS and 0 <= col < BOARD_COLS

    @staticmethod
    def is_in_palace(row: int, col: int, side: int) -> bool:
        """检查是否在九宫格内"""
        if col < 3 or col > 5:
            return False
        if side == RED:
            return 7 <= row <= 9
        else:
            return 0 <= row <= 2

    @staticmethod
    def is_in_own_side(row: int, side: int) -> bool:
        """检查是否在本方半场"""
        if side == RED:
            return row >= 5
        else:
            return row <= 4

    @staticmethod
    def find_king(board: List[List[Optional[Tuple[int, int]]]], side: int) -> Optional[Tuple[int, int]]:
        """查找将/帅位置"""
        for r in range(BOARD_ROWS):
            for c in range(BOARD_COLS):
                piece = board[r][c]
                if piece and piece[0] == PieceType.KING and piece[1] == side:
                    return (r, c)
        return None

    @staticmethod
    def get_all_pseudo_moves(board: List[List[Optional[Tuple[int, int]]]], side: int) -> List[Move]:
        """生成所有伪合法走法（不考虑送将）"""
        moves = []
        for r in range(BOARD_ROWS):
            for c in range(BOARD_COLS):
                piece = board[r][c]
                if piece and piece[1] == side:
                    piece_moves = XiangqiRules._get_piece_moves(board, r, c, piece[0], side)
                    moves.extend(piece_moves)
        return moves

    @staticmethod
    def _get_piece_moves(board, row, col, piece_type, side) -> List[Move]:
        """获取单个棋子的走法"""
        if piece_type == PieceType.KING:
            return XiangqiRules._king_moves(board, row, col, side)
        elif piece_type == PieceType.ADVISOR:
            return XiangqiRules._advisor_moves(board, row, col, side)
        elif piece_type == PieceType.ELEPHANT:
            return XiangqiRules._elephant_moves(board, row, col, side)
        elif piece_type == PieceType.HORSE:
            return XiangqiRules._horse_moves(board, row, col, side)
        elif piece_type == PieceType.ROOK:
            return XiangqiRules._rook_moves(board, row, col, side)
        elif piece_type == PieceType.CANNON:
            return XiangqiRules._cannon_moves(board, row, col, side)
        elif piece_type == PieceType.PAWN:
            return XiangqiRules._pawn_moves(board, row, col, side)
        return []

    @staticmethod
    def _king_moves(board, row, col, side) -> List[Move]:
        moves = []
        directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        for dr, dc in directions:
            nr, nc = row + dr, col + dc
            if not XiangqiRules.is_in_palace(nr, nc, side):
                continue
            target = board[nr][nc]
            if not target or target[1] != side:
                moves.append(Move(row, col, nr, nc, PieceType.KING,
                                  captured=target[0] if target else None))

        # 飞将（对面笑）：将帅在同列且中间无子
        opponent_side = 1 - side
        king_pos = XiangqiRules.find_king(board, opponent_side)
        if king_pos and king_pos[1] == col:
            # 检查中间是否有子
            min_row, max_row = min(row, king_pos[0]), max(row, king_pos[0])
            clear = True
            for r in range(min_row + 1, max_row):
                if board[r][col]:
                    clear = False
                    break
            if clear:
                moves.append(Move(row, col, king_pos[0], king_pos[1], PieceType.KING,
                                  captured=PieceType.KING))

        return moves

    @staticmethod
    def _advisor_moves(board, row, col, side) -> List[Move]:
        moves = []
        directions = [(-1, -1), (-1, 1), (1, -1), (1, 1)]
        for dr, dc in directions:
            nr, nc = row + dr, col + dc
            if not XiangqiRules.is_in_palace(nr, nc, side):
                continue
            target = board[nr][nc]
            if not target or target[1] != side:
                moves.append(Move(row, col, nr, nc, PieceType.ADVISOR,
                                  captured=target[0] if target else None))
        return moves

    @staticmethod
    def _elephant_moves(board, row, col, side) -> List[Move]:
        moves = []
        directions = [(-2, -2), (-2, 2), (2, -2), (2, 2)]
        blocks = [(-1, -1), (-1, 1), (1, -1), (1, 1)]

        for i in range(4):
            dr, dc = directions[i]
            br, bc = blocks[i]
            nr, nc = row + dr, col + dc

            if not XiangqiRules.is_in_own_side(nr, side):
                continue
            if not XiangqiRules.is_in_board(nr, nc):
                continue

            # 检查象眼
            block_row, block_col = row + br, col + bc
            if not XiangqiRules.is_in_board(block_row, block_col):
                continue
            if board[block_row][block_col]:
                continue

            target = board[nr][nc]
            if not target or target[1] != side:
                moves.append(Move(row, col, nr, nc, PieceType.ELEPHANT,
                                  captured=target[0] if target else None))
        return moves

    @staticmethod
    def _horse_moves(board, row, col, side) -> List[Move]:
        moves = []
        jumps = [
            (-2, -1, -1, 0), (-2, 1, -1, 0),
            (2, -1, 1, 0), (2, 1, 1, 0),
            (-1, -2, 0, -1), (-1, 2, 0, 1),
            (1, -2, 0, -1), (1, 2, 0, 1)
        ]

        for dr, dc, br, bc in jumps:
            nr, nc = row + dr, col + dc
            if not XiangqiRules.is_in_board(nr, nc):
                continue

            # 检查马脚
            block_row, block_col = row + br, col + bc
            if not XiangqiRules.is_in_board(block_row, block_col):
                continue
            if board[block_row][block_col]:
                continue

            target = board[nr][nc]
            if not target or target[1] != side:
                moves.append(Move(row, col, nr, nc, PieceType.HORSE,
                                  captured=target[0] if target else None))
        return moves

    @staticmethod
    def _rook_moves(board, row, col, side) -> List[Move]:
        moves = []
        directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]

        for dr, dc in directions:
            nr, nc = row + dr, col + dc
            while XiangqiRules.is_in_board(nr, nc):
                target = board[nr][nc]
                if not target:
                    moves.append(Move(row, col, nr, nc, PieceType.ROOK))
                else:
                    if target[1] != side:
                        moves.append(Move(row, col, nr, nc, PieceType.ROOK,
                                          captured=target[0]))
                    break
                nr += dr
                nc += dc
        return moves

    @staticmethod
    def _cannon_moves(board, row, col, side) -> List[Move]:
        moves = []
        directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]

        for dr, dc in directions:
            nr, nc = row + dr, col + dc
            jumped = False

            while XiangqiRules.is_in_board(nr, nc):
                target = board[nr][nc]

                if not jumped:
                    if not target:
                        moves.append(Move(row, col, nr, nc, PieceType.CANNON))
                    else:
                        jumped = True
                else:
                    if target:
                        if target[1] != side:
                            moves.append(Move(row, col, nr, nc, PieceType.CANNON,
                                              captured=target[0]))
                        break

                nr += dr
                nc += dc
        return moves

    @staticmethod
    def _pawn_moves(board, row, col, side) -> List[Move]:
        moves = []
        forward = -1 if side == RED else 1
        has_crossed = (side == RED and row <= 4) or (side == BLACK and row >= 5)

        # 前进
        front_row = row + forward
        if XiangqiRules.is_in_board(front_row, col):
            target = board[front_row][col]
            if not target or target[1] != side:
                moves.append(Move(row, col, front_row, col, PieceType.PAWN,
                                  captured=target[0] if target else None))

        # 过河后可横走
        if has_crossed:
            for dc in [-1, 1]:
                nc = col + dc
                if XiangqiRules.is_in_board(row, nc):
                    target = board[row][nc]
                    if not target or target[1] != side:
                        moves.append(Move(row, col, row, nc, PieceType.PAWN,
                                          captured=target[0] if target else None))
        return moves

    @staticmethod
    def is_in_check(board: List[List[Optional[Tuple[int, int]]]], side: int) -> bool:
        """检查某方是否被将军"""
        king_pos = XiangqiRules.find_king(board, side)
        if not king_pos:
            return False

        opponent_side = 1 - side
        opponent_moves = XiangqiRules.get_all_pseudo_moves(board, opponent_side)

        return any(m.to_row == king_pos[0] and m.to_col == king_pos[1]
                   for m in opponent_moves)

    @staticmethod
    def make_move(board: List[List[Optional[Tuple[int, int]]]], move: Move) -> List[List[Optional[Tuple[int, int]]]]:
        """执行走法，返回新棋盘"""
        new_board = [row[:] for row in board]
        piece = new_board[move.from_row][move.from_col]
        new_board[move.to_row][move.to_col] = piece
        new_board[move.from_row][move.from_col] = None
        return new_board

    @staticmethod
    def get_legal_moves(board: List[List[Optional[Tuple[int, int]]]], side: int) -> List[Move]:
        """获取真正合法的走法（过滤掉送将的走法）"""
        pseudo_moves = XiangqiRules.get_all_pseudo_moves(board, side)
        legal_moves = []

        for move in pseudo_moves:
            new_board = XiangqiRules.make_move(board, move)
            # 检查走完后自己是否被将军
            if not XiangqiRules.is_in_check(new_board, side):
                legal_moves.append(move)

        return legal_moves

    @staticmethod
    def is_game_over(board: List[List[Optional[Tuple[int, int]]]], side: int) -> Tuple[bool, Optional[int]]:
        """
        检查游戏是否结束
        返回 (is_over, winner): winner 为 RED/BLACK 表示胜方，None 表示和棋
        """
        legal_moves = XiangqiRules.get_legal_moves(board, side)

        # 无合法走法：被将死或困毙
        if len(legal_moves) == 0:
            return True, 1 - side  # 对方胜

        # TODO: 添加三次重复局面、60步无吃子、长将判负等规则
        return False, None

    @staticmethod
    def board_to_tensor(board: List[List[Optional[Tuple[int, int]]]], side_to_move: int) -> 'np.ndarray':
        """
        将棋盘状态转换为神经网络输入张量
        输出形状: (14, 10, 9) - 14通道，10行，9列
        """
        import numpy as np

        tensor = np.zeros((14, BOARD_ROWS, BOARD_COLS), dtype=np.float32)

        for r in range(BOARD_ROWS):
            for c in range(BOARD_COLS):
                piece = board[r][c]
                if piece:
                    piece_type, piece_side = piece
                    if piece_side == RED:
                        tensor[piece_type, r, c] = 1.0
                    else:
                        tensor[piece_type + 7, r, c] = 1.0

        return tensor

    @staticmethod
    def move_to_index(move: Move) -> int:
        """
        将走法编码为动作索引
        使用 source(90) × dest(90) = 8100 维动作空间
        """
        from_idx = move.from_row * BOARD_COLS + move.from_col
        to_idx = move.to_row * BOARD_COLS + move.to_col
        return from_idx * (BOARD_ROWS * BOARD_COLS) + to_idx

    @staticmethod
    def index_to_move(index: int, board: List[List[Optional[Tuple[int, int]]]], side: int) -> Optional[Move]:
        """
        从动作索引解码为走法
        """
        total_positions = BOARD_ROWS * BOARD_COLS
        from_idx = index // total_positions
        to_idx = index % total_positions

        from_row = from_idx // BOARD_COLS
        from_col = from_idx % BOARD_COLS
        to_row = to_idx // BOARD_COLS
        to_col = to_idx % BOARD_COLS

        if not XiangqiRules.is_in_board(from_row, from_col):
            return None
        if not XiangqiRules.is_in_board(to_row, to_col):
            return None

        piece = board[from_row][from_col]
        if not piece or piece[1] != side:
            return None

        return Move(from_row, from_col, to_row, to_col, piece[0],
                    captured=board[to_row][to_col][0] if board[to_row][to_col] else None)

    @staticmethod
    def get_valid_moves_mask(board: List[List[Optional[Tuple[int, int]]]], side: int) -> 'np.ndarray':
        """
        获取合法走法的 mask（用于 action masking）
        返回形状: (8100,) 的布尔数组
        """
        import numpy as np

        mask = np.zeros(BOARD_ROWS * BOARD_COLS * BOARD_ROWS * BOARD_COLS, dtype=bool)
        legal_moves = XiangqiRules.get_legal_moves(board, side)

        for move in legal_moves:
            idx = XiangqiRules.move_to_index(move)
            mask[idx] = True

        return mask
