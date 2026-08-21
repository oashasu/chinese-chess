# 数据生成脚本 - Pikafish 自对弈

"""
使用 Pikafish（或随机自对弈）生成训练数据

数据格式: (state_tensor, policy_target, value_target)
- state_tensor: (14, 10, 9) 棋盘状态
- policy_target: (8100,) Pikafish 推荐的走法概率分布
- value_target: scalar 最终胜负 (-1/0/1)
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import json
import time
from pathlib import Path
from typing import List, Tuple, Optional

from env.rules import XiangqiRules, Move, RED, BLACK


class RandomPlayer:
    """随机走子玩家（用于生成初始数据）"""

    def select_move(self, board, side):
        legal_moves = XiangqiRules.get_legal_moves(board, side)
        if not legal_moves:
            return None
        return np.random.choice(legal_moves)


class GameRecord:
    """一局游戏记录"""

    def __init__(self):
        self.states = []      # List of (14, 10, 9) tensors
        self.policies = []    # List of (8100,) distributions
        self.result = 0       # -1, 0, 1


def play_game(player1, player2, max_moves: int = 200) -> GameRecord:
    """
    进行一局自对弈

    Args:
        player1: 红方玩家
        player2: 黑方玩家
        max_moves: 最大步数

    Returns:
        GameRecord 游戏记录
    """
    board = XiangqiRules.create_initial_board()
    current_side = RED
    record = GameRecord()
    move_count = 0

    while move_count < max_moves:
        # 生成合法走法
        legal_moves = XiangqiRules.get_legal_moves(board, current_side)

        if not legal_moves:
            # 无合法走法，当前方负
            record.result = -1 if current_side == RED else 1
            break

        # 记录当前状态
        state = XiangqiRules.board_to_tensor(board, current_side)
        record.states.append(state)

        # 选择走法
        player = player1 if current_side == RED else player2
        move = player.select_move(board, current_side)

        if move is None:
            record.result = -1 if current_side == RED else 1
            break

        # 生成策略目标（均匀分布，后续替换为 Pikafish 输出）
        policy = np.zeros(8100, dtype=np.float32)
        move_idx = XiangqiRules.move_to_index(move)
        policy[move_idx] = 1.0
        record.policies.append(policy)

        # 执行走法
        board = XiangqiRules.make_move(board, move)
        move_count += 1

        # 检查游戏结束
        is_over, winner = XiangqiRules.is_game_over(board, 1 - current_side)
        if is_over:
            if winner == RED:
                record.result = 1
            elif winner == BLACK:
                record.result = -1
            else:
                record.result = 0
            break

        current_side = 1 - current_side

    return record


def generate_random_games(num_games: int, output_dir: str, verbose: bool = True):
    """
    生成随机自对弈数据

    Args:
        num_games: 游戏局数
        output_dir: 输出目录
        verbose: 是否显示进度
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    player = RandomPlayer()
    all_states = []
    all_policies = []
    all_values = []

    start_time = time.time()

    for i in range(num_games):
        record = play_game(player, player)

        # 将结果转换为每步的价值目标
        for state, policy in zip(record.states, record.policies):
            all_states.append(state)
            all_policies.append(policy)
            all_values.append(record.result)

        if verbose and (i + 1) % 100 == 0:
            elapsed = time.time() - start_time
            speed = (i + 1) / elapsed
            print(f"游戏 {i+1}/{num_games} | 速度: {speed:.1f} games/s | 耗时: {elapsed:.1f}s")

    # 保存数据
    states = np.array(all_states, dtype=np.float32)
    policies = np.array(all_policies, dtype=np.float32)
    values = np.array(all_values, dtype=np.float32)

    np.savez_compressed(
        output_path / "random_data.npz",
        states=states,
        policies=policies,
        values=values
    )

    print(f"\n数据生成完成!")
    print(f"总步数: {len(all_states)}")
    print(f"状态形状: {states.shape}")
    print(f"策略形状: {policies.shape}")
    print(f"价值形状: {values.shape}")
    print(f"胜率分布: 红胜={np.sum(values > 0)}, 和棋={np.sum(values == 0)}, 黑胜={np.sum(values < 0)}")
    print(f"保存至: {output_path / 'random_data.npz'}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="生成自对弈训练数据")
    parser.add_argument("--num-games", type=int, default=1000, help="游戏局数")
    parser.add_argument("--output-dir", type=str, default="../models/data", help="输出目录")
    parser.add_argument("--player1", type=str, default="random", help="红方策略 (random/pikafish)")
    parser.add_argument("--player2", type=str, default="random", help="黑方策略 (random/pikafish)")

    args = parser.parse_args()

    generate_random_games(args.num_games, args.output_dir)
