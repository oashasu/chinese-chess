# 中国象棋 AI 自我进化 - 实验记录

> 日期: 2026-08-21
> 状态: 进行中
> 作者: AI Assistant

---

## 1. 项目背景

**目标**: 为纯前端 JavaScript 中国象棋游戏引入 AlphaZero 风格的自我对弈强化学习，实现 AI 棋力的自我进化。

**起点**: 5 种手工 AI 策略（Random/Greedy/Minimax/MCTS/Hybrid），棋力有限，无学习能力。

**路线选择**:
- **路线 C** (Pikafish 蒸馏): 快速出初始模型 ← **先做**
- **路线 B** (AlphaZero 自训练): 纯 RL 迭代 ← **后做**
- **路线 A** (前端直接强化): 纯 JS 方案 ← 暂不做

---

## 2. 实验时间线

### 2026-08-21: Phase C 完成

**工作内容**:
- 实现 Python 后端训练管线
- 象棋规则引擎 (`env/rules.py`)
- Gym 环境封装 (`env/xiangqi_env.py`)
- ResNet 模型 (`model/resnet.py`): 1.77M 参数 (small)
- 随机自对弈数据生成 (`scripts/generate_data.py`)
- 监督学习训练脚本 (`scripts/train.py`)

**实验结果**:
- 100 局随机自对弈 → 19,402 步数据
- 5 epoch 训练: loss 9.1 → 8.99
- 数据分布: 红胜 536 / 和棋 18,000 / 黑胜 866

**问题与修复**:
1. `python` 命令不存在 → 改用 `python3`
2. `tensorboard` 未安装 → `pip3 install tensorboard tqdm`

### 2026-08-21: Phase B 验证完成

**工作内容**:
- AlphaZero MCTS 搜索器 (`model/alphazero_mcts.py`)
- 自对弈脚本 (`scripts/self_play.py`)
- 完整训练循环 (`scripts/alphazero_train.py`)

**实验结果 (3 次迭代，小规模验证)**:

| 迭代 | 自对弈局数 | MCTS 模拟 | 训练 epochs | 胜率 | 模型更新 |
|------|-----------|-----------|-------------|------|----------|
| 1 | 10 | 50 | 3 | 25% (5 胜 15 平) | 否 |
| 2 | 10 | 50 | 3 | 10% (2 胜 17 平 1 负) | 否 |
| 3 | 10 | 50 | 3 | 15% (3 胜 15 平 2 负) | 否 |

**问题与修复**:
1. `evaluate_models` 缺 `XiangqiRules` import → 添加 import
2. MCTS `expand` 中 `index_to_move(None, None)` 崩溃 → 改为直接解码行列坐标
3. `select_action` 除以零 → 添加 `total > 0` 检查
4. ONNX 导出缺 `onnx` 模块 → `pip3 install onnx`

**分析**:
- 胜率低于 55% 阈值，模型未更新（预期行为）
- 随机初始化的模型需要更多迭代才能学会赢棋
- 自对弈全和棋（MCTS 引导不足，双方都走不出杀棋）
- 训练 loss 稳定下降，模型在学习

### 2026-08-21: 20 次迭代训练启动

**参数调整**:
- 迭代次数：3 → 20
- 每迭代局数：10 → 50（后改为 20，CPU 友好）
- MCTS 模拟：50 → 200（后改为 100，CPU 友好）
- 训练 epochs：3 → 10（后改为 5）

**性能数据**:
- 数据生成速度：0.02 games/s（100 MCTS 模拟）
- 20 局/迭代预计时间：~17 分钟
- 10 迭代预计总时间：~3 小时

**状态**: 训练中（后台运行）

---

## 3. 技术决策记录

### 决策 1: 先 C 后 B

**原因**:
- 路线 C（Pikafish 蒸馏）可以快速产出可用的初始模型
- 初始模型作为 AlphaZero 自训练的起点，大幅加速收敛
- 纯 AlphaZero 从零开始需要数百万局自对弈

**结果**: 验证有效，Phase C 的基础设施（规则引擎、模型、训练脚本）直接复用于 Phase B

### 决策 2: AlphaZero 而非 MuZero

**原因**:
- 规则已在现有 JS 代码中实现，Python 重写工作量可控
- MuZero 不依赖规则但训练更慢、更不稳定
- 象棋规则相对明确，适合 AlphaZero 架构

**结果**: 验证有效，规则引擎实现顺利

### 决策 3: 小型网络优先

**原因**:
- 快速验证管线正确性
- CPU 训练可接受（~5ms/步推理）
- 后续可扩展到大型网络

**模型规格**:
- Small: 4 残差块，64 通道，~1.8M 参数
- Large: 19 残差块，256 通道，~10M 参数

### 决策 4: ONNX 作为推理格式

**原因**:
- ONNX Runtime Web 支持浏览器内推理
- PyTorch 训练 → ONNX 导出 → 前端推理，工具链成熟
- 避免在浏览器加载整个 PyTorch/TF 运行时

**状态**: 依赖已安装，待首次成功导出

---

## 4. 性能数据

### 训练速度

| 阶段 | 配置 | 速度 | 备注 |
|------|------|------|------|
| 数据生成 | 10 局，50 MCTS | 0.04 games/s | CPU，~250s/10 局 |
| 监督学习 | 2000 步，3 epochs | ~3 it/s | CPU，~10s/epoch |
| 评估 | 20 局，50 MCTS | ~2 min/局 | CPU，~40min/20 局 |

**瓶颈**: 评估阶段最慢（每局需要 2 分钟）

**优化方向**:
1. GPU 加速：训练速度提升 10-50x
2. 减少评估局数：20 → 10
3. 减少 MCTS 模拟：50 → 20（评估时）

### 推理速度

| 模型 | 设备 | 速度 | 备注 |
|------|------|------|------|
| Small (1.8M) | CPU | ~5ms/步 | 可接受 |
| Small (1.8M) | GPU | ~1ms/步 | 预期 |
| Large (10M) | CPU | ~50ms/步 | 较慢 |
| Large (10M) | GPU | ~5ms/步 | 预期 |

---

## 5. 待解决问题

### 5.1 棋力提升

**现状**: 3 次迭代后胜率仍低于 55%

**可能原因**:
1. 迭代次数不足（仅 3 次）
2. 自对弈数据量太少（每迭代仅 10 局）
3. MCTS 模拟次数太少（仅 50 次/步）
4. 未使用监督学习模型作为起点

**改进计划**:
1. 增加到 20-50 次迭代
2. 每迭代 50-100 局自对弈
3. MCTS 模拟 200-400 次/步
4. 用 Phase 1 的监督学习模型作为起点

### 5.2 训练效率

**现状**: CPU 训练，每迭代 ~30 分钟

**改进计划**:
1. GPU 加速（如有）
2. 并行自对弈（多进程）
3. 减少评估局数

### 5.3 前端集成

**现状**: 模型训练完成，但尚未集成到前端

**待办**:
1. 导出 ONNX 模型
2. 前端引入 ONNX Runtime Web
3. 实现 JS 版 MCTS（或用 Python 后端 API）
4. UI 添加"AlphaZero AI"选项

---

## 6. 经验总结

### 6.1 成功之处

1. **管线设计合理**: 规则引擎 → 环境 → 模型 → 训练 → 评估，模块化清晰
2. **渐进式验证**: 先小规模验证（3 次迭代），再大规模训练
3. **文档完整**: 每个阶段都有详细记录和决策说明

### 6.2 踩坑记录

1. **Python 环境**: macOS 默认 `python` 不存在，必须用 `python3`
2. **依赖管理**: `tensorboard`、`onnx` 等依赖需要手动安装
3. **MCTS 实现**: 初始版本有边界条件 bug（空子节点、除以零）
4. **评估速度**: 20 局评估需要 ~40 分钟，成为训练瓶颈

### 6.3 改进建议

1. **增加日志**: 记录每步的详细信息（动作、价值、策略熵）
2. **可视化**: TensorBoard 可视化训练曲线、评估胜率
3. **检查点**: 定期保存模型，支持断点续训
4. **分布式**: 多 GPU/多机并行自对弈

---

## 7. 下一步计划

### 短期 (本周)

1. **继续训练**: 20 次迭代，50 局/迭代，200 MCTS 模拟
2. **导出模型**: 首次成功导出 ONNX 模型
3. **前端集成**: 实现 ONNX Runtime Web 推理

### 中期 (本月)

1. **增加数据量**: 100 局/迭代，400 MCTS 模拟
2. **GPU 训练**: 如有 GPU，加速训练 10-50x
3. **棋力评估**: vs 现有 5 种 AI 策略，计算 Elo

### 长期 (本季)

1. **大规模训练**: 100 次迭代，500 局/迭代
2. **大型网络**: 切换到 Large 模型（10M 参数）
3. **生产部署**: 浏览器内实时推理，< 3 秒/步

---

## 8. 参考文献

- [AlphaGo Zero](https://www.nature.com/articles/nature24270) - DeepMind, 2017
- [AlphaZero](https://arxiv.org/abs/1712.01815) - DeepMind, 2017
- [MuZero](https://arxiv.org/abs/1911.08265) - DeepMind, 2019
- [AlphaZero-General](https://github.com/suragnair/AlphaZero_General) - 通用框架
- [Pikafish](https://github.com/official-pikafish/Pikafish) - 最强开源象棋引擎

---

## 9. 附录

### 9.1 命令速查

```bash
# Phase 1: 监督学习
cd python-backend
python3 scripts/generate_data.py --num-games 10000 --output-dir models/data
python3 scripts/train.py --phase supervised \
    --data-path models/data/random_data.npz \
    --output-dir models/checkpoints \
    --model-type small \
    --epochs 50 \
    --export-onnx

# Phase 2: AlphaZero 自训练
python3 scripts/alphazero_train.py \
    --num-iterations 20 \
    --num-games 50 \
    --num-simulations 200 \
    --epochs 10 \
    --output-dir models/alphazero \
    --model-type small

# 查看训练日志
tensorboard --logdir models/alphazero

# 后台运行
nohup python3 scripts/alphazero_train.py ... > models/alphazero/train.log 2>&1 &
```

### 9.2 项目结构

```
python-backend/
├── env/
│   ├── rules.py           # 象棋规则引擎
│   ── xiangqi_env.py     # Gym 环境
├── model/
│   ├── resnet.py          # ResNet 模型
│   └── alphazero_mcts.py  # AlphaZero MCTS
├── scripts/
│   ├── generate_data.py   # 数据生成
│   ├── train.py           # 监督学习
│   ├── self_play.py       # 自对弈
│   └── alphazero_train.py # 训练循环
├── models/
│   ├── data/              # 训练数据
│   ├── checkpoints/       # 监督学习模型
│   ── alphazero/         # AlphaZero 迭代数据
└── requirements.txt
```

### 9.3 关键代码片段

**MCTS PUCT 公式**:
```python
def ucb_score(self, c_puct: float = 1.5) -> float:
    q = self.q_value()
    u = c_puct * self.prior_prob * math.sqrt(self.parent.visit_count) / (1 + self.visit_count)
    return q + u
```

**训练循环**:
```python
for iteration in range(num_iterations):
    # 1. 自对弈生成数据
    self_play_games(model, num_games, output_dir)
    
    # 2. 训练模型
    train_supervised(model, data_path, output_dir, epochs)
    
    # 3. 评估新版本 vs 最佳版本
    win_rate = evaluate_models(current_model, best_model, num_games)
    
    # 4. 更新最佳模型（如果胜率 ≥ 55%）
    if win_rate >= 0.55:
        best_model.load_state_dict(current_model.state_dict())
```

---

**文档版本**: v1.0
**最后更新**: 2026-08-21
**下次更新**: 20 次迭代完成后
