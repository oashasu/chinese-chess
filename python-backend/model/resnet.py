# ResNet for Xiangqi - Policy + Value Network

"""
AlphaZero 风格的残差网络
输入: (14, 10, 9) 棋盘状态
输出:
  - Policy: (8100,) 动作概率分布
  - Value: (1,) 局面评估 [-1, 1]
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Tuple


class ResidualBlock(nn.Module):
    """残差块"""

    def __init__(self, channels: int = 256):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = x
        out = F.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out += residual
        return F.relu(out)


class XiangqiNet(nn.Module):
    """
    象棋神经网络

    架构:
    - 输入卷积层: (14, 10, 9) → (256, 10, 9)
    - N 个残差块
    - Policy 头: 全局平均池化 → FC → Softmax
    - Value 头: 全局平均池化 → FC → Tanh
    """

    def __init__(self, num_blocks: int = 19, num_channels: int = 256, action_size: int = 8100):
        super().__init__()

        # 初始卷积层
        self.conv_in = nn.Conv2d(14, num_channels, 3, padding=1, bias=False)
        self.bn_in = nn.BatchNorm2d(num_channels)

        # 残差块
        self.residual_blocks = nn.Sequential(
            *[ResidualBlock(num_channels) for _ in range(num_blocks)]
        )

        # Policy 头
        self.policy_conv = nn.Conv2d(num_channels, 2, 1, bias=False)
        self.policy_bn = nn.BatchNorm2d(2)
        self.policy_fc = nn.Linear(2 * 10 * 9, action_size)

        # Value 头
        self.value_conv = nn.Conv2d(num_channels, 1, 1, bias=False)
        self.value_bn = nn.BatchNorm2d(1)
        self.value_fc1 = nn.Linear(1 * 10 * 9, 256)
        self.value_fc2 = nn.Linear(256, 1)

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        前向传播

        Args:
            x: (batch, 14, 10, 9) 输入张量

        Returns:
            policy: (batch, 8100) 动作概率分布
            value: (batch, 1) 局面评估
        """
        # 主干网络
        x = F.relu(self.bn_in(self.conv_in(x)))
        x = self.residual_blocks(x)

        # Policy 头
        policy = F.relu(self.policy_bn(self.policy_conv(x)))
        policy = policy.view(policy.size(0), -1)
        policy = self.policy_fc(policy)
        policy = F.softmax(policy, dim=1)

        # Value 头
        value = F.relu(self.value_bn(self.value_conv(x)))
        value = value.view(value.size(0), -1)
        value = F.relu(self.value_fc1(value))
        value = torch.tanh(self.value_fc2(value))

        return policy, value


class XiangqiNetSmall(nn.Module):
    """
    小型网络（用于快速验证和浏览器部署）

    参数量约 1/10，推理速度快 5-10x
    """

    def __init__(self, num_blocks: int = 4, num_channels: int = 64, action_size: int = 8100):
        super().__init__()

        self.conv_in = nn.Conv2d(14, num_channels, 3, padding=1, bias=False)
        self.bn_in = nn.BatchNorm2d(num_channels)

        self.residual_blocks = nn.Sequential(
            *[ResidualBlock(num_channels) for _ in range(num_blocks)]
        )

        # Policy 头
        self.policy_conv = nn.Conv2d(num_channels, 2, 1, bias=False)
        self.policy_bn = nn.BatchNorm2d(2)
        self.policy_fc = nn.Linear(2 * 10 * 9, action_size)

        # Value 头
        self.value_conv = nn.Conv2d(num_channels, 1, 1, bias=False)
        self.value_bn = nn.BatchNorm2d(1)
        self.value_fc1 = nn.Linear(1 * 10 * 9, 64)
        self.value_fc2 = nn.Linear(64, 1)

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        x = F.relu(self.bn_in(self.conv_in(x)))
        x = self.residual_blocks(x)

        policy = F.relu(self.policy_bn(self.policy_conv(x)))
        policy = policy.view(policy.size(0), -1)
        policy = self.policy_fc(policy)
        policy = F.softmax(policy, dim=1)

        value = F.relu(self.value_bn(self.value_conv(x)))
        value = value.view(value.size(0), -1)
        value = F.relu(self.value_fc1(value))
        value = torch.tanh(self.value_fc2(value))

        return policy, value


def create_model(model_type: str = "large") -> nn.Module:
    """创建模型"""
    if model_type == "small":
        return XiangqiNetSmall()
    else:
        return XiangqiNet()


if __name__ == "__main__":
    # 测试模型
    model = create_model("small")
    print(f"Model parameters: {sum(p.numel() for p in model.parameters()):,}")

    x = torch.randn(2, 14, 10, 9)
    policy, value = model(x)
    print(f"Policy shape: {policy.shape}")
    print(f"Value shape: {value.shape}")
    print(f"Policy sum: {policy[0].sum():.4f}")
    print(f"Value range: [{value.min():.4f}, {value.max():.4f}]")
