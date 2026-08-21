# AlphaZero 训练循环 - Phase 2

"""
完整的 AlphaZero 训练循环：
1. 自对弈生成数据
2. 训练神经网络
3. 评估新版本 vs 旧版本
4. 如果新版本更好，替换旧版本
5. 重复 1-4
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import torch
import numpy as np
from pathlib import Path
from typing import Optional

from env.rules import XiangqiRules, RED, BLACK
from model.resnet import create_model, XiangqiNet, XiangqiNetSmall
from model.alphazero_mcts import AlphaZeroMCTS
from scripts.self_play import self_play_games
from scripts.train import train_supervised, export_onnx


class AlphaZeroTrainer:
    """
    AlphaZero 训练器

    维护两个模型：
    - current_model: 当前用于自对弈的模型
    - best_model: 历史最佳模型（用于评估比较）
    """

    def __init__(
        self,
        model_type: str = "small",
        num_simulations: int = 400,
        num_games_per_iteration: int = 100,
        training_epochs: int = 10,
        evaluation_games: int = 20,
        win_rate_threshold: float = 0.55,
        device: str = 'cuda' if torch.cuda.is_available() else 'cpu'
    ):
        self.model_type = model_type
        self.num_simulations = num_simulations
        self.num_games_per_iteration = num_games_per_iteration
        self.training_epochs = training_epochs
        self.evaluation_games = evaluation_games
        self.win_rate_threshold = win_rate_threshold
        self.device = device

        # 创建模型
        self.current_model = create_model(model_type).to(device)
        self.best_model = create_model(model_type).to(device)

        # 复制初始权重
        self.best_model.load_state_dict(self.current_model.state_dict())

        # 训练历史
        self.iteration = 0
        self.history = []

    def run_iteration(self, output_dir: str, verbose: bool = True):
        """
        运行一次训练迭代

        1. 自对弈生成数据
        2. 训练模型
        3. 评估新版本
        4. 更新最佳模型（如果更好）
        """
        self.iteration += 1
        output_path = Path(output_dir)
        iter_dir = output_path / f"iteration_{self.iteration:04d}"
        iter_dir.mkdir(parents=True, exist_ok=True)

        if verbose:
            print(f"\n{'='*60}")
            print(f"Iteration {self.iteration}")
            print(f"{'='*60}")

        # 1. 自对弈生成数据
        if verbose:
            print(f"\n[1/4] 自对弈生成 {self.num_games_per_iteration} 局数据...")

        data_path = iter_dir / "selfplay_data.npz"
        self_play_games(
            model=self.current_model,
            num_games=self.num_games_per_iteration,
            output_dir=str(iter_dir),
            num_simulations=self.num_simulations,
            device=self.device,
            verbose=verbose
        )

        # 2. 训练模型
        if verbose:
            print(f"\n[2/4] 训练模型 {self.training_epochs} epochs...")

        checkpoint_dir = iter_dir / "checkpoints"
        train_supervised(
            model=self.current_model,
            data_path=str(data_path),
            output_dir=str(checkpoint_dir),
            epochs=self.training_epochs,
            batch_size=256,
            learning_rate=1e-3,
            device=self.device
        )

        # 加载训练后的模型
        best_model_path = checkpoint_dir / "best_model.pth"
        if best_model_path.exists():
            self.current_model.load_state_dict(torch.load(best_model_path))

        # 3. 评估新版本 vs 最佳版本
        if verbose:
            print(f"\n[3/4] 评估新版本 vs 最佳版本 ({self.evaluation_games} 局)...")

        win_rate = self.evaluate_models(self.current_model, self.best_model,
                                         self.evaluation_games, verbose)

        # 4. 更新最佳模型
        if verbose:
            print(f"\n[4/4] 胜率: {win_rate:.2%} (阈值: {self.win_rate_threshold:.2%})")

        if win_rate >= self.win_rate_threshold:
            # 新版本更好，替换最佳模型
            self.best_model.load_state_dict(self.current_model.state_dict())
            torch.save(self.best_model.state_dict(), iter_dir / "new_best_model.pth")
            if verbose:
                print(f"  ✓ 新版本胜出！更新最佳模型")
        else:
            # 旧版本更好，恢复最佳模型用于下一轮自对弈
            self.current_model.load_state_dict(self.best_model.state_dict())
            if verbose:
                print(f"  ✗ 新版本未胜出，保持最佳模型")

        # 记录历史
        self.history.append({
            'iteration': self.iteration,
            'win_rate': win_rate,
            'data_size': len(np.load(data_path)['states']),
            'model_updated': win_rate >= self.win_rate_threshold
        })

        # 保存训练历史
        import json
        with open(output_path / "training_history.json", 'w') as f:
            json.dump(self.history, f, indent=2)

        if verbose:
            print(f"\nIteration {self.iteration} 完成!")
            print(f"  总步数: {len(np.load(data_path)['states'])}")
            print(f"  胜率: {win_rate:.2%}")
            print(f"  模型更新: {'是' if win_rate >= self.win_rate_threshold else '否'}")

    def evaluate_models(self, model1, model2, num_games: int, verbose: bool = True) -> float:
        """
        评估两个模型的对弈胜率

        Args:
            model1: 第一个模型（新模型）
            model2: 第二个模型（旧模型）
            num_games: 对弈局数
            verbose: 是否显示进度

        Returns:
            model1 的胜率
        """
        from scripts.self_play import SelfPlayGame

        model1 = model1.to(self.device).eval()
        model2 = model2.to(self.device).eval()

        wins = 0
        draws = 0
        losses = 0

        for i in range(num_games):
            # 交替先手
            player1_model = model1 if i % 2 == 0 else model2
            player2_model = model2 if i % 2 == 0 else model1

            board = XiangqiRules.create_initial_board()
            current_side = RED
            move_count = 0
            winner = None

            mcts1 = AlphaZeroMCTS(player1_model, num_simulations=self.num_simulations)
            mcts2 = AlphaZeroMCTS(player2_model, num_simulations=self.num_simulations)

            while move_count < 200:
                valid_mask = XiangqiRules.get_valid_moves_mask(board, current_side)

                if not valid_mask.any():
                    winner = 1 - current_side
                    break

                # 选择 MCTS
                mcts = mcts1 if current_side == RED else mcts2

                # MCTS 搜索
                action_probs, _ = mcts.search(board, current_side)
                action_idx = mcts.select_action(action_probs, valid_mask)
                move = XiangqiRules.index_to_move(action_idx, board, current_side)

                if move is None:
                    winner = 1 - current_side
                    break

                board = XiangqiRules.make_move(board, move)
                move_count += 1

                is_over, game_winner = XiangqiRules.is_game_over(board, 1 - current_side)
                if is_over:
                    winner = game_winner
                    break

                current_side = 1 - current_side

            # 统计结果
            if i % 2 == 0:  # model1 先手（红方）
                if winner == RED:
                    wins += 1
                elif winner == BLACK:
                    losses += 1
                else:
                    draws += 1
            else:  # model2 先手（红方）
                if winner == BLACK:
                    wins += 1
                elif winner == RED:
                    losses += 1
                else:
                    draws += 1

            if verbose and (i + 1) % 10 == 0:
                print(f"  评估 {i+1}/{num_games}: 胜={wins} 平={draws} 负={losses}")

        win_rate = wins / num_games
        return win_rate

    def export_final_model(self, output_path: str):
        """导出最终模型为 ONNX"""
        self.best_model.eval()
        export_onnx(self.best_model, output_path, device=self.device)


def run_alphazero_training(
    output_dir: str = "../models/alphazero",
    num_iterations: int = 10,
    num_games_per_iteration: int = 100,
    num_simulations: int = 400,
    training_epochs: int = 10,
    model_type: str = "small",
    device: str = 'cuda' if torch.cuda.is_available() else 'cpu'
):
    """
    运行完整的 AlphaZero 训练

    Args:
        output_dir: 输出目录
        num_iterations: 训练迭代次数
        num_games_per_iteration: 每迭代自对弈局数
        num_simulations: MCTS 模拟次数
        training_epochs: 每迭代训练 epochs
        model_type: 模型类型 (small/large)
        device: 计算设备
    """
    trainer = AlphaZeroTrainer(
        model_type=model_type,
        num_simulations=num_simulations,
        num_games_per_iteration=num_games_per_iteration,
        training_epochs=training_epochs,
        device=device
    )

    for i in range(num_iterations):
        trainer.run_iteration(output_dir, verbose=True)

    # 导出最终模型
    final_model_path = Path(output_dir) / "final_model.onnx"
    trainer.export_final_model(str(final_model_path))
    print(f"\n训练完成! 最终模型导出至: {final_model_path}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="AlphaZero 训练循环")
    parser.add_argument("--num-iterations", type=int, default=10, help="训练迭代次数")
    parser.add_argument("--num-games", type=int, default=100, help="每迭代自对弈局数")
    parser.add_argument("--num-simulations", type=int, default=400, help="MCTS 模拟次数")
    parser.add_argument("--epochs", type=int, default=10, help="每迭代训练 epochs")
    parser.add_argument("--output-dir", type=str, default="../models/alphazero", help="输出目录")
    parser.add_argument("--model-type", type=str, default="small", choices=["small", "large"])

    args = parser.parse_args()

    run_alphazero_training(
        output_dir=args.output_dir,
        num_iterations=args.num_iterations,
        num_games_per_iteration=args.num_games,
        num_simulations=args.num_simulations,
        training_epochs=args.epochs,
        model_type=args.model_type
    )
