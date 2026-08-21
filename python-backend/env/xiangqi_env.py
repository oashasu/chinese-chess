# 象棋 Gym 环境

"""
OpenAI Gym 兼容的中国象棋环境
用于强化学习训练
"""

import gymnasium as gym
from gymnasium import spaces
import numpy as np
from typing import Optional, Tuple, Dict, Any
from .rules import XiangqiRules, Move, RED, BLACK, BOARD_ROWS, BOARD_COLS


class XiangqiEnv(gym.Env):
    """
    中国象棋 Gym 环境

    观察空间: (14, 10, 9) 的 float32 张量
    动作空间: 8100 维离散空间 (90 source × 90 dest)
    """

    metadata = {"render_modes": ["ansi"]}

    def __init__(self, render_mode: Optional[str] = None):
        super().__init__()

        self.render_mode = render_mode

        # 观察空间: 14通道 10×9 棋盘
        self.observation_space = spaces.Box(
            low=0.0,
            high=1.0,
            shape=(14, BOARD_ROWS, BOARD_COLS),
            dtype=np.float32
        )

        # 动作空间: 90×90 = 8100
        self.action_space = spaces.Discrete(BOARD_ROWS * BOARD_COLS * BOARD_ROWS * BOARD_COLS)

        # 环境状态
        self.board = None
        self.current_side = RED
        self.done = False
        self.winner = None
        self.move_count = 0
        self.max_moves = 200  # 防止无限循环

    def reset(self, seed: Optional[int] = None, options: Optional[Dict] = None) -> Tuple[np.ndarray, Dict]:
        """重置环境"""
        super().reset(seed=seed)

        self.board = XiangqiRules.create_initial_board()
        self.current_side = RED
        self.done = False
        self.winner = None
        self.move_count = 0

        obs = XiangqiRules.board_to_tensor(self.board, self.current_side)
        info = {"current_side": self.current_side, "legal_moves_mask": self._get_legal_mask()}

        return obs, info

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, Dict]:
        """
        执行一步

        返回: (observation, reward, terminated, truncated, info)
        """
        if self.done:
            raise RuntimeError("Episode is done. Call reset() first.")

        # 解码动作
        move = XiangqiRules.index_to_move(action, self.board, self.current_side)

        # 检查动作是否合法
        if move is None:
            # 非法动作：判负
            self.done = True
            self.winner = 1 - self.current_side
            obs = XiangqiRules.board_to_tensor(self.board, 1 - self.current_side)
            return obs, -1.0, True, False, {"winner": self.winner, "reason": "illegal_move"}

        legal_moves = XiangqiRules.get_legal_moves(self.board, self.current_side)
        if move not in legal_moves:
            # 不合法的走法（伪合法但送将）：判负
            self.done = True
            self.winner = 1 - self.current_side
            obs = XiangqiRules.board_to_tensor(self.board, 1 - self.current_side)
            return obs, -1.0, True, False, {"winner": self.winner, "reason": "illegal_move"}

        # 执行走法
        self.board = XiangqiRules.make_move(self.board, move)
        self.move_count += 1

        # 检查游戏结束
        opponent_side = 1 - self.current_side
        is_over, winner = XiangqiRules.is_game_over(self.board, opponent_side)

        if is_over:
            self.done = True
            self.winner = winner
            if winner == self.current_side:
                reward = 1.0  # 我方胜
            elif winner == opponent_side:
                reward = -1.0  # 对方胜
            else:
                reward = 0.0  # 和棋
            obs = XiangqiRules.board_to_tensor(self.board, opponent_side)
            return obs, reward, True, False, {"winner": winner, "reason": "game_over"}

        # 检查步数限制
        if self.move_count >= self.max_moves:
            self.done = True
            self.winner = None
            obs = XiangqiRules.board_to_tensor(self.board, opponent_side)
            return obs, 0.0, False, True, {"reason": "max_moves"}

        # 正常继续
        self.current_side = opponent_side
        obs = XiangqiRules.board_to_tensor(self.board, self.current_side)
        reward = 0.0  # 中间步无奖励

        info = {
            "current_side": self.current_side,
            "legal_moves_mask": self._get_legal_mask(),
            "move_count": self.move_count
        }

        return obs, reward, False, False, info

    def _get_legal_mask(self) -> np.ndarray:
        """获取当前合法走法的 mask"""
        return XiangqiRules.get_valid_moves_mask(self.board, self.current_side)

    def render(self):
        """渲染棋盘（文本模式）"""
        if self.render_mode != "ansi":
            return

        piece_chars = {
            (0, RED): '帅', (0, BLACK): '将',
            (1, RED): '仕', (1, BLACK): '士',
            (2, RED): '相', (2, BLACK): '象',
            (3, RED): '马', (3, BLACK): '馬',
            (4, RED): '车', (4, BLACK): '車',
            (5, RED): '炮', (5, BLACK): '砲',
            (6, RED): '兵', (6, BLACK): '卒',
        }

        print("\n" + "=" * 30)
        print(f"回合: {self.move_count} | 当前: {'红方' if self.current_side == RED else '黑方'}")
        print("=" * 30)

        for r in range(BOARD_ROWS):
            row_str = ""
            for c in range(BOARD_COLS):
                piece = self.board[r][c]
                if piece:
                    char = piece_chars.get(piece, '·')
                    row_str += f" {char}"
                else:
                    row_str += " ·"
            print(row_str)

        print("=" * 30)

    def close(self):
        """清理资源"""
        pass


# 注册环境
gym.register(
    id="Xiangqi-v0",
    entry_point="env.xiangqi_env:XiangqiEnv",
)
