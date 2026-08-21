# 象棋 AI 自我进化升级

> 基于 AlphaZero 架构的中国象棋强化学习训练管线

## 项目结构

```
python-backend/
├── env/                    # 环境
│   ├── rules.py           # 象棋规则引擎
│   └── xiangqi_env.py     # Gym 环境封装
├── model/                  # 模型
│   └── resnet.py          # ResNet (Policy + Value)
├── scripts/                # 脚本
│   ├── generate_data.py   # 数据生成（随机自对弈 / Pikafish）
│   └── train.py           # 训练脚本（监督学习 + AlphaZero）
├── models/                 # 模型文件（Git LFS）
│   ├── data/              # 训练数据
│   └── checkpoints/       # 模型检查点
├── requirements.txt
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
cd python-backend
pip install -r requirements.txt
```

### 2. 生成训练数据（Phase 1）

```bash
# 随机自对弈生成 10000 局
python scripts/generate_data.py --num-games 10000 --output-dir models/data
```

### 3. 训练模型（Phase 1）

```bash
# 监督学习训练
python scripts/train.py --phase supervised \
    --data-path models/data/random_data.npz \
    --output-dir models/checkpoints \
    --model-type small \
    --epochs 50 \
    --export-onnx
```

### 4. 查看训练日志

```bash
tensorboard --logdir models/checkpoints
```

### 5. 导出 ONNX 模型

```bash
python scripts/train.py --phase supervised \
    --data-path models/data/random_data.npz \
    --output-dir models/checkpoints \
    --model-type small \
    --export-onnx
```

导出的模型文件：`models/checkpoints/model.onnx`

## 架构说明

### 神经网络

- **输入**: (14, 10, 9) - 14 通道棋盘状态
- **主干**: 4-19 层残差块（small/large）
- **Policy 头**: 输出 8100 维动作概率分布
- **Value 头**: 输出 [-1, 1] 局面评估

### 训练流程

```
Phase 1: 监督学习
  随机自对弈/Pikafish 数据 → 训练 ResNet → 导出 ONNX

Phase 2: AlphaZero 自训练
  自对弈生成数据 → 训练 → 更新网络 → 循环
```

## 性能参考

| 模型 | 参数量 | 推理速度 (CPU) | 推理速度 (GPU) |
|------|--------|---------------|---------------|
| Small (4 blocks) | ~100K | ~5ms | ~1ms |
| Large (19 blocks) | ~10M | ~50ms | ~5ms |

## 下一步

- [ ] 集成 Pikafish 生成高质量训练数据
- [ ] 实现 AlphaZero MCTS 自对弈循环
- [ ] 前端 ONNX Runtime Web 集成
- [ ] 模型量化 (INT8) 加速浏览器推理

## 参考文献

- [AlphaGo Zero](https://www.nature.com/articles/nature24270)
- [AlphaZero](https://arxiv.org/abs/1712.01815)
- [MuZero](https://arxiv.org/abs/1911.08265)
- [AlphaZero-General](https://github.com/suragnair/AlphaZero_General)
