# 训练脚本 - 监督学习 (Phase 1) + AlphaZero 自训练 (Phase 2)

"""
两阶段训练:
Phase 1: 监督学习 - 用 Pikafish/随机数据训练初始模型
Phase 2: 自对弈强化学习 - AlphaZero 循环
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import numpy as np
from pathlib import Path
from tqdm import tqdm
from torch.utils.tensorboard import SummaryWriter

from model.resnet import create_model


class XiangqiDataset(TensorDataset):
    """象棋训练数据集"""
    pass


def load_data(data_path: str) -> TensorDataset:
    """加载训练数据"""
    data = np.load(data_path)
    states = torch.from_numpy(data['states'])
    policies = torch.from_numpy(data['policies'])
    values = torch.from_numpy(data['values']).unsqueeze(1)

    return TensorDataset(states, policies, values)


def train_supervised(
    model: nn.Module,
    data_path: str,
    output_dir: str,
    epochs: int = 50,
    batch_size: int = 256,
    learning_rate: float = 1e-3,
    device: str = 'cuda' if torch.cuda.is_available() else 'cpu'
):
    """
    Phase 1: 监督学习训练

    Loss = Policy_Loss + Value_Loss
    """
    print(f"使用设备: {device}")
    print(f"加载数据: {data_path}")

    # 加载数据
    dataset = load_data(data_path)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True, num_workers=4)

    model = model.to(device)
    optimizer = optim.Adam(model.parameters(), lr=learning_rate, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    policy_loss_fn = nn.CrossEntropyLoss()  # 注意：输入是概率分布，需转换
    value_loss_fn = nn.MSELoss()

    # TensorBoard
    writer = SummaryWriter(output_dir)

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    best_loss = float('inf')

    for epoch in range(epochs):
        model.train()
        total_policy_loss = 0
        total_value_loss = 0
        total_loss = 0
        num_batches = 0

        pbar = tqdm(dataloader, desc=f"Epoch {epoch+1}/{epochs}")

        for states, policies, values in pbar:
            states = states.to(device)
            policies = policies.to(device)
            values = values.to(device)

            optimizer.zero_grad()

            # 前向传播
            pred_policy, pred_value = model(states)

            # Policy Loss (KL 散度或交叉熵)
            # 将目标概率分布转为 log 目标
            policy_target = torch.argmax(policies, dim=1)  # 简化：取最大概率动作
            policy_loss = nn.functional.cross_entropy(pred_policy, policy_target)

            # Value Loss
            value_loss = value_loss_fn(pred_value, values)

            # 总 Loss
            loss = policy_loss + value_loss

            # 反向传播
            loss.backward()
            optimizer.step()

            total_policy_loss += policy_loss.item()
            total_value_loss += value_loss.item()
            total_loss += loss.item()
            num_batches += 1

            pbar.set_postfix({
                'loss': f'{loss.item():.4f}',
                'policy': f'{policy_loss.item():.4f}',
                'value': f'{value_loss.item():.4f}'
            })

        # 学习率调度
        scheduler.step()

        # 记录 TensorBoard
        avg_loss = total_loss / num_batches
        avg_policy_loss = total_policy_loss / num_batches
        avg_value_loss = total_value_loss / num_batches

        writer.add_scalar('Loss/total', avg_loss, epoch)
        writer.add_scalar('Loss/policy', avg_policy_loss, epoch)
        writer.add_scalar('Loss/value', avg_value_loss, epoch)
        writer.add_scalar('LearningRate', scheduler.get_last_lr()[0], epoch)

        print(f"Epoch {epoch+1}: loss={avg_loss:.4f} policy={avg_policy_loss:.4f} value={avg_value_loss:.4f}")

        # 保存最佳模型
        if avg_loss < best_loss:
            best_loss = avg_loss
            torch.save(model.state_dict(), output_path / "best_model.pth")
            print(f"  → 保存最佳模型 (loss={best_loss:.4f})")

        # 定期保存
        if (epoch + 1) % 10 == 0:
            torch.save(model.state_dict(), output_path / f"model_epoch_{epoch+1}.pth")

    writer.close()
    print(f"\n训练完成! 最佳 loss: {best_loss:.4f}")


def export_onnx(model: nn.Module, output_path: str, device: str = 'cpu'):
    """导出 ONNX 模型"""
    model = model.to(device)
    model.eval()

    dummy_input = torch.randn(1, 14, 10, 9).to(device)

    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        export_params=True,
        opset_version=11,
        do_constant_folding=True,
        input_names=['input'],
        output_names=['policy', 'value'],
        dynamic_axes={
            'input': {0: 'batch_size'},
            'policy': {0: 'batch_size'},
            'value': {0: 'batch_size'}
        }
    )
    print(f"ONNX 模型已导出: {output_path}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="训练象棋神经网络")
    parser.add_argument("--phase", type=str, default="supervised", choices=["supervised", "alphazero"])
    parser.add_argument("--data-path", type=str, default="../models/data/random_data.npz")
    parser.add_argument("--output-dir", type=str, default="../models/checkpoints")
    parser.add_argument("--model-type", type=str, default="small", choices=["small", "large"])
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--export-onnx", action="store_true", help="训练后导出 ONNX")

    args = parser.parse_args()

    # 创建模型
    model = create_model(args.model_type)
    print(f"模型参数量: {sum(p.numel() for p in model.parameters()):,}")

    if args.phase == "supervised":
        train_supervised(
            model=model,
            data_path=args.data_path,
            output_dir=args.output_dir,
            epochs=args.epochs,
            batch_size=args.batch_size,
            learning_rate=args.lr
        )

        if args.export_onnx:
            # 加载最佳模型
            best_model_path = Path(args.output_dir) / "best_model.pth"
            if best_model_path.exists():
                model.load_state_dict(torch.load(best_model_path))
                print(f"加载最佳模型: {best_model_path}")

            export_onnx(model, str(Path(args.output_dir) / "model.onnx"))
    else:
        print("AlphaZero 自训练尚未实现，敬请期待 Phase 2")
