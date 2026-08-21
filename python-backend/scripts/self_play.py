# 自对弈脚本 - AlphaZero 训练数据生成

"""
使用 AlphaZero MCTS 进行自对弈，生成训练数据

数据格式: (state_tensor, policy_target, value_target)
- state_tensor: (14, 10, 9) 棋盘状态
- policy_target: (8100,) MCTS 搜索后的动作概率分布
- value_target: scalar 最终胜负 (-1/0/1)
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import torch
import numpy as np
import time
from pathlib import Path
from typing import List, Tuple, Optional

from env.rules import XiangqiRules, RED, BLACK
from model.resnet import create_model, XiangqiNet, XiangqiNetSmall
from model.alphazero_mcts import AlphaZeroMCTS


class SelfPlayGame:
    """一局自对弈游戏"""

    def __init__(self, model, num_simulations: int = 800, c_puct: float = 1.5,
                 temperature_start: float = 1.0, temperature_end: float = 0.1,
                 temperature_steps: int = 30):
        self.mcts = AlphaZeroMCTS(model, c_puct=c_puct, num_simulations=num_simulations)
        self.num_simulations = num_simulations

        # 温度调度（开局探索多，后期探索少）
        self.temperature_start = temperature_start
        self.temperature_end = temperature_end
        self.temperature_steps = temperature_steps

    def get_temperature(self, move_count: int) -> float:
        """获取当前步数的温度"""
        if move_count < self.temperature_steps:
            return self.temperature_start + (self.temperature_end - self.temperature_start) * (move_count / self.temperature_steps)
        return self.temperature_end

    def play(self, max_moves: int = 200) -> Tuple[List, List, List, int]:
        """
        进行一局自对弈

        Returns:
            states: List of (14, 10, 9) tensors
            policies: List of (8100,) MCTS 概率分布
            values: List of 最终胜负
            winner: 胜方 (RED/BLACK/None)
        """
        board = XiangqiRules.create_initial_board()
        current_side = RED

        states = []
        policies = []
        move_count = 0

        while move_count < max_moves:
            # 记录当前状态
            state = XiangqiRules.board_to_tensor(board, current_side)
            states.append(state)

            # 获取合法走法
            valid_mask = XiangqiRules.get_valid_moves_mask(board, current_side)

            if not valid_mask.any():
                # 无合法走法，当前方负
                winner = 1 - current_side
                break

            # MCTS 搜索
            temperature = self.get_temperature(move_count)
            self.mcts.temperature = temperature
            action_probs, _ = self.mcts.search(board, current_side)

            # 记录策略目标
            policies.append(action_probs)

            # 选择动作
            action_idx = self.mcts.select_action(action_probs, valid_mask)
            move = XiangqiRules.index_to_move(action_idx, board, current_side)

            if move is None:
                # 非法动作，判负
                winner = 1 - current_side
                break

            # 执行走法
            board = XiangqiRules.make_move(board, move)
            move_count += 1

            # 检查游戏结束
            is_over, winner = XiangqiRules.is_game_over(board, 1 - current_side)
            if is_over:
                break

            current_side = 1 - current_side

        # 生成价值目标
        values = []
        for i in range(len(states)):
            # 偶数步是红方，奇数步是黑方
            if i % 2 == 0:  # 红方视角
                if winner == RED:
                    values.append(1.0)
                elif winner == BLACK:
                    values.append(-1.0)
                else:
                    values.append(0.0)
            else:  # 黑方视角
                if winner == BLACK:
                    values.append(1.0)
                elif winner == RED:
                    values.append(-1.0)
                else:
                    values.append(0.0)

        return states, policies, values, winner


def self_play_games(
    model,
    num_games: int,
    output_dir: str,
    num_simulations: int = 400,
    device: str = 'cuda' if torch.cuda.is_available() else 'cpu',
    verbose: bool = True
):
    """
    生成多局自对弈数据

    Args:
        model: 神经网络模型
        num_games: 游戏局数
        output_dir: 输出目录
        num_simulations: 每步 MCTS 模拟次数
        device: 计算设备
        verbose: 是否显示进度
    """
    model = model.to(device)
    model.eval()

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    player = SelfPlayGame(model, num_simulations=num_simulations)

    all_states = []
    all_policies = []
    all_values = []
    win_counts = {RED: 0, BLACK: 0, None: 0}

    start_time = time.time()

    for i in range(num_games):
        states, policies, values, winner = player.play()

        all_states.extend(states)
        all_policies.extend(policies)
        all_values.extend(values)
        win_counts[winner] += 1

        if verbose and (i + 1) % 10 == 0:
            elapsed = time.time() - start_time
            speed = (i + 1) / elapsed
            print(f"游戏 {i+1}/{num_games} | 速度: {speed:.2f} games/s | "
                  f"红胜:{win_counts[RED]} 黑胜:{win_counts[BLACK]} 和棋:{win_counts[None]}")

    # 保存数据
    states = np.array(all_states, dtype=np.float32)
    policies = np.array(all_policies, dtype=np.float32)
    values = np.array(all_values, dtype=np.float32)

    np.savez_compressed(
        output_path / f"selfplay_data.npz",
        states=states,
        policies=policies,
        values=values
    )

    elapsed = time.time() - start_time
    print(f"\n自对弈完成!")
    print(f"总步数: {len(all_states)}")
    print(f"状态形状: {states.shape}")
    print(f"策略形状: {policies.shape}")
    print(f"价值形状: {values.shape}")
    print(f"胜率分布: 红胜={win_counts[RED]}, 和棋={win_counts[None]}, 黑胜={win_counts[BLACK]}")
    print(f"耗时: {elapsed:.1f}s")
    print(f"保存至: {output_path / 'selfplay_data.npz'}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="AlphaZero 自对弈数据生成")
    parser.add_argument("--num-games", type=int, default=100, help="游戏局数")
    parser.add_argument("--output-dir", type=str, default="../models/data", help="输出目录")
    parser.add_argument("--num-simulations", type=int, default=400, help="每步 MCTS 模拟次数")
    parser.add_argument("--model-path", type=str, default="../models/checkpoints/best_model.pth", help="模型路径")
    parser.add_argument("--model-type", type=str, default="small", choices=["small", "large"])

    args = parser.parse_args()

    # 加载模型
    model = create_model(args.model_type)
    if os.path.exists(args.model_path):
        model.load_state_dict(torch.load(args.model_path, map_location='cpu'))
        print(f"加载模型: {args.model_path}")
    else:
        print(f"警告：模型文件不存在 {args.model_path}，使用随机初始化")

    # 生成数据
    self_play_games(
        model=model,
        num_games=args.num_games,
        output_dir=args.output_dir,
        num_simulations=args.num_simulations
    )
