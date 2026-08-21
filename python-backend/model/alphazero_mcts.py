# AlphaZero MCTS - 蒙特卡洛树搜索（神经网络引导）

"""
AlphaZero 风格的 MCTS：
- 用神经网络评估叶子节点（Policy + Value）
- 用 PUCT 公式选择节点
- 通过自对弈生成训练数据
"""

import math
import numpy as np
from typing import List, Optional, Tuple, Dict
from env.rules import XiangqiRules, Move, RED, BLACK, BOARD_ROWS, BOARD_COLS


class MCTSNode:
    """MCTS 节点"""

    def __init__(self, parent: Optional['MCTSNode'], prior_prob: float, move: Optional[Move] = None):
        self.parent = parent
        self.move = move  # 到达此节点的走法
        self.prior_prob = prior_prob  # 先验概率（来自神经网络）

        self.visit_count = 0
        self.value_sum = 0.0
        self.children: Dict[int, 'MCTSNode'] = {}  # action_idx -> node

        self.expanded = False

    @property
    def is_leaf(self) -> bool:
        return not self.expanded

    @property
    def is_root(self) -> bool:
        return self.parent is None

    def q_value(self) -> float:
        """平均价值"""
        if self.visit_count == 0:
            return 0.0
        return self.value_sum / self.visit_count

    def ucb_score(self, c_puct: float = 1.5) -> float:
        """
        PUCT 公式：Q + U
        Q: 平均价值
        U: 探索项 = c_puct * prior * sqrt(parent_visits) / (1 + visits)
        """
        q = self.q_value()
        if self.parent is None:
            u = 0.0
        else:
            u = c_puct * self.prior_prob * math.sqrt(self.parent.visit_count) / (1 + self.visit_count)
        return q + u

    def best_child(self, c_puct: float = 1.5) -> 'MCTSNode':
        """选择 UCB 分数最高的子节点"""
        best_score = -float('inf')
        best_node = None

        for node in self.children.values():
            score = node.ucb_score(c_puct)
            if score > best_score:
                best_score = score
                best_node = node

        return best_node

    def expand(self, policy_probs: np.ndarray, valid_moves_mask: np.ndarray):
        """
        展开节点：为所有合法走法创建子节点

        Args:
            policy_probs: (8100,) 神经网络输出的策略概率
            valid_moves_mask: (8100,) 合法走法掩码
        """
        self.expanded = True

        # 只展开合法走法
        valid_indices = np.where(valid_moves_mask)[0]

        # 重新归一化概率（只考虑合法走法）
        total_prob = policy_probs[valid_indices].sum()
        if total_prob > 0:
            normalized_probs = policy_probs[valid_indices] / total_prob
        else:
            # 如果所有概率都是 0，均匀分布
            normalized_probs = np.ones(len(valid_indices)) / len(valid_indices)

        for i, idx in enumerate(valid_indices):
            prior = normalized_probs[i]
            # 从索引解码走法的行列坐标
            total_positions = BOARD_ROWS * BOARD_COLS
            from_idx = idx // total_positions
            to_idx = idx % total_positions

            from_row = from_idx // BOARD_COLS
            from_col = from_idx % BOARD_COLS
            to_row = to_idx // BOARD_COLS
            to_col = to_idx % BOARD_COLS

            # 创建走法对象（piece_type 和 captured 稍后填充）
            move = Move(from_row, from_col, to_row, to_col, piece_type=0, captured=None)
            self.children[idx] = MCTSNode(self, prior, move)

    def backup(self, value: float):
        """
        反向传播：更新路径上所有节点

        Args:
            value: 叶子节点的价值评估 [-1, 1]
        """
        node = self
        while node is not None:
            node.visit_count += 1
            # 对于父节点来说，子节点的价值是相反的（零和博弈）
            node.value_sum += value
            value = -value  # 翻转视角
            node = node.parent


class AlphaZeroMCTS:
    """
    AlphaZero MCTS 搜索器

    用法:
        mcts = AlphaZeroMCTS(model, c_puct=1.5, num_simulations=800)
        action_probs, root = mcts.search(board, side)
        action = np.random.choice(8100, p=action_probs)
    """

    def __init__(self, model, c_puct: float = 1.5, num_simulations: int = 800, temperature: float = 1.0):
        """
        Args:
            model: 神经网络模型 (XiangqiNet)
            c_puct: PUCT 探索常数
            num_simulations: 每次搜索的模拟次数
            temperature: 动作选择温度（1.0=按访问次数比例，0=选访问最多的）
        """
        self.model = model
        self.c_puct = c_puct
        self.num_simulations = num_simulations
        self.temperature = temperature

    def search(self, board: List, side: int) -> Tuple[np.ndarray, MCTSNode]:
        """
        执行 MCTS 搜索

        Args:
            board: 当前棋盘状态
            side: 当前走子方 (RED/BLACK)

        Returns:
            action_probs: (8100,) 动作概率分布（基于访问次数）
            root: MCTS 根节点
        """
        import torch

        root = MCTSNode(None, 1.0)

        # 获取合法走法掩码
        valid_mask = XiangqiRules.get_valid_moves_mask(board, side)

        # 先展开根节点
        state_tensor = XiangqiRules.board_to_tensor(board, side)
        state_batch = torch.FloatTensor(state_tensor).unsqueeze(0)

        with torch.no_grad():
            policy_logits, value = self.model(state_batch)

        policy_probs = policy_logits[0].numpy()
        root.expand(policy_probs, valid_mask)

        for _ in range(self.num_simulations):
            node = root

            # 1. 选择：沿着树向下直到叶子节点
            while not node.is_leaf:
                node = node.best_child(self.c_puct)
                if node is None:
                    break

            if node is None or node.is_root:
                continue

            # 2. 展开：用神经网络评估叶子节点
            # 重建棋盘状态（从根节点走下来）
            current_board = board
            current_side = side
            path = []
            temp_node = node
            while temp_node.parent is not None:
                path.append(temp_node.move)
                temp_node = temp_node.parent
            path.reverse()

            for move in path:
                current_board = XiangqiRules.make_move(current_board, move)
                current_side = 1 - current_side

            # 神经网络评估
            state_tensor = XiangqiRules.board_to_tensor(current_board, current_side)
            state_batch = torch.FloatTensor(state_tensor).unsqueeze(0)

            with torch.no_grad():
                policy_logits, value = self.model(state_batch)

            policy_probs = policy_logits[0].numpy()
            value = value[0].item()

            # 获取当前局面的合法走法掩码
            node_valid_mask = XiangqiRules.get_valid_moves_mask(current_board, current_side)

            # 展开节点
            node.expand(policy_probs, node_valid_mask)

            # 3. 反向传播
            node.backup(value)

        # 4. 返回动作概率分布（基于访问次数）
        action_probs = np.zeros(BOARD_ROWS * BOARD_COLS * BOARD_ROWS * BOARD_COLS, dtype=np.float32)

        for action_idx, child in root.children.items():
            action_probs[action_idx] = child.visit_count

        # 归一化
        total = action_probs.sum()
        if total > 0:
            action_probs /= total

        # 应用温度
        if self.temperature != 1.0 and self.temperature > 0:
            action_probs = action_probs ** (1.0 / self.temperature)
            action_probs /= action_probs.sum()

        return action_probs, root

    def select_action(self, action_probs: np.ndarray, valid_mask: np.ndarray) -> int:
        """
        根据 MCTS 输出的概率分布选择动作

        Args:
            action_probs: (8100,) 动作概率
            valid_mask: (8100,) 合法走法掩码

        Returns:
            action_idx: 选择的动作索引
        """
        # 只考虑合法走法
        valid_probs = action_probs * valid_mask
        total = valid_probs.sum()

        if total > 0:
            valid_probs /= total
            # 按概率采样
            return int(np.random.choice(len(valid_probs), p=valid_probs))
        else:
            # 如果所有概率都是 0，均匀随机选择
            valid_indices = np.where(valid_mask)[0]
            return int(np.random.choice(valid_indices))
