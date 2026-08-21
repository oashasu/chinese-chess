# 象棋 AI 自我进化升级

> 基于 AlphaZero 架构的中国象棋强化学习训练管线

## 项目结构

```
python-backend/
├── env/                    # 环境
│   ├── rules.py           # 象棋规则引擎
│   └── xiangqi_env.py     # Gym 环境封装
├── model/                  # 模型
│   ├── resnet.py          # ResNet (Policy + Value)
│   └── alphazero_mcts.py  # AlphaZero MCTS 搜索器
├── scripts/                # 脚本
│   ├── generate_data.py   # 数据生成（随机自对弈 / Pikafish）
│   ├── train.py           # 监督学习训练
│   ├── self_play.py       # AlphaZero 自对弈
│   └── alphazero_train.py # AlphaZero 完整训练循环
├── models/                 # 模型文件（Git LFS）
│   ├── data/              # 训练数据
│   ├── checkpoints/       # 监督学习检查点
│   └── alphazero/         # AlphaZero 迭代数据
├── requirements.txt
└── README.md
```

## 快速开始

### Phase 1: 监督学习（快速初始模型）

```bash
cd python-backend

# 1. 安装依赖
pip install -r requirements.txt

# 2. 生成随机自对弈数据
python scripts/generate_data.py --num-games 10000 --output-dir models/data

# 3. 训练模型
python scripts/train.py --phase supervised \
    --data-path models/data/random_data.npz \
    --output-dir models/checkpoints \
    --model-type small \
    --epochs 50 \
    --export-onnx
```

### Phase 2: AlphaZero 自训练（强化学习）

```bash
# 运行 AlphaZero 训练循环
python scripts/alphazero_train.py \
    --num-iterations 10 \
    --num-games 100 \
    --num-simulations 400 \
    --epochs 10 \
    --output-dir models/alphazero \
    --model-type small
```

### 查看训练日志

```bash
tensorboard --logdir models/alphazero
```

### 导出 ONNX 模型

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
  自对弈生成数据 → 训练 → 评估 → 更新网络 → 循环
```

### AlphaZero 循环

```
┌─────────────────────────────────────────────────────────┐
│                    自我进化循环                            │
│                                                         │
│  ┌──────────    自对弈数据    ┌──────────────┐          │
│  │  ResNet  │ ──────────────→ │  训练神经网络  │          │
│  │ Policy+  │ ←────────────── │  (Policy Loss │          │
│  │ Value    │    更新权重      │   Value Loss) │          │
│  └─────────┘                 └──────────────┘          │
│       │                                                  │
│       │ 引导搜索                                          │
│       ▼                                                  │
│  ┌──────────┐    生成走法     ┌──────────────┐           │
│  │   MCTS   │ ─────────────→ │  记录 (s, π, z)│          │
│  │(神经网络  │ ←────────────── │  状态，策略，胜负│           │
│  │  评估叶子) │    叶子评估     └──────────────┘           │
│  └──────────┘                                            │
└─────────────────────────────────────────────────────────┘
```

## 性能参考

| 模型 | 参数量 | 推理速度 (CPU) | 推理速度 (GPU) |
|------|--------|---------------|---------------|
| Small (4 blocks) | ~1.8M | ~5ms | ~1ms |
| Large (19 blocks) | ~10M | ~50ms | ~5ms |

## 下一步

- [ ] 集成 Pikafish 生成高质量训练数据
- [ ] 前端 ONNX Runtime Web 集成
- [ ] 模型量化 (INT8) 加速浏览器推理
- [ ] 分布式自对弈（多 GPU/多机）

## 参考文献

- [AlphaGo Zero](https://www.nature.com/articles/nature24270)
- [AlphaZero](https://arxiv.org/abs/1712.01815)
- [MuZero](https://arxiv.org/abs/1911.08265)
- [AlphaZero-General](https://github.com/suragnair/AlphaZero_General)
