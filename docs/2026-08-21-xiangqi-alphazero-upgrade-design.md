# 中国象棋 AI 自我进化升级方案

> 日期: 2026-08-21
> 状态: 待评审
> 作者: AI Assistant

## 1. 背景与目标

### 1.1 现状
- 纯前端 JavaScript 实现，5 种 AI 策略（Random/Greedy/Minimax/MCTS/Hybrid）
- 使用手工评估函数 + Alpha-Beta 剪枝 + 蒙特卡洛树搜索
- 棋力有限，无法达到业余高手水平
- 无学习能力，棋力完全取决于手工调参

### 1.2 目标
引入 AlphaZero 风格的**自我对弈强化学习**路线，实现：
1. **零人类知识起步**: 不依赖棋谱、开局库、残局表
2. **自我进化**: 通过自对弈生成训练数据，神经网络自我提升
3. **渐进增强**: 从当前手工策略平滑过渡到神经网络策略
4. **可部署**: 最终模型能在浏览器（前端）或 Python 后端运行

### 1.3 成功标准
- 训练后的 AI 棋力超越当前所有手工策略
- 能在浏览器内实时推理（< 3秒/步）或后端 API 推理（< 1秒/步）
- 提供训练脚本、推理接口、模型版本管理

---

## 2. 核心论文与算法

### 2.1 必读论文

| 论文 | 年份 | 核心贡献 | 本项目借鉴点 |
|------|------|----------|-------------|
| [AlphaGo Zero](https://www.nature.com/articles/nature24270) | 2017 | 纯自对弈，零人类知识 | 整体架构：ResNet + MCTS + 自对弈循环 |
| [AlphaZero](https://arxiv.org/abs/1712.01815) | 2017 | 泛化到 Chess/Shogi/Go | 统一 Policy-Value 网络架构 |
| [MuZero](https://arxiv.org/abs/1911.08265) | 2019 | 学习状态转移模型 | 不依赖硬编码规则的长期方向 |
| [EfficientZero](https://arxiv.org/abs/2111.00210) | 2021 | 样本高效的 MuZero | 降低训练数据需求的技巧 |

### 2.2 算法架构

```
┌─────────────────────────────────────────────────────────┐
│                    自我进化循环                            │
│                                                         │
│  ┌──────────┐    自对弈数据    ┌──────────────┐          │
│  │  ResNet  │ ──────────────→ │  训练神经网络  │          │
│  │ Policy+  │ ←────────────── │  (Policy Loss │          │
│  │ Value    │    更新权重      │   Value Loss) │          │
│  └─────────┘                 └──────────────┘          │
│       │                                                  │
│       │ 引导搜索                                          │
│       ▼                                                  │
│  ┌──────────┐    生成走法     ┌──────────────┐           │
│  │   MCTS   │ ──────────────→ │  记录 (s, π, z)│          │
│  │(神经网络  │ ←────────────── │  状态,策略,胜负│           │
│  │  评估叶子) │    叶子评估     └──────────────┘           │
│  └──────────┘                                            │
└─────────────────────────────────────────────────────────┘
```

**神经网络结构（ResNet）**:
- **输入**: 14 通道 9×10 特征图（7 种棋子 × 2 方 + 2 通道历史）
- **主干**: 19 层残差块（256 卷积核）
- **Policy 头**: 输出 2000+ 维动作概率向量（action masking）
- **Value 头**: 输出 [-1, 1] 标量（-1=黑胜, 0=和, 1=红胜）

---

## 3. 开源项目调研

### 3.1 训练框架

| 项目 | 仓库 | Stars | 适用性 |
|------|------|-------|--------|
| **AlphaZero-General** | [suragnair/AlphaZero_General](https://github.com/suragnair/AlphaZero_General) | 5k+ | ⭐⭐⭐⭐⭐ 最成熟的通用框架，需实现 Xiangqi Game 类 |
| **MuZero-General** | [wereturtle/muzero-general](https://github.com/wereturtle/muzero-general) | 1k+ | ⭐⭐⭐ 不依赖规则引擎，长期方向 |
| **Fairy-Stockfish** | [ianfab/Fairy-Stockfish](https://github.com/ianfab/Fairy-Stockfish) | 2k+ | ⭐⭐⭐ 支持 Xiangqi 变体 + NNUE 训练 |

### 3.2 RL 环境库

| 库 | 说明 | 安装 |
|----|------|------|
| **gym-xiangqi** | OpenAI Gym 象棋环境 | `pip install gym-xiangqi` |
| **PettingZoo** | 多 agent RL 环境框架 | `pip install pettingzoo` |

### 3.3 强引擎（Teacher / 基准）

| 引擎 | 说明 | 用途 |
|------|------|------|
| **Pikafish** (皮卡鱼) | Stockfish 象棋分支，开源最强 | Teacher 蒸馏 / 评估基准 |
| **Eleeye** (象棋眼) | 传统搜索 + 手工评估 | 对比基准 |

---

## 4. 实施路线（三阶段）

### Phase 1: 基础设施 + Pikafish 蒸馏（1-2 周）

**目标**: 快速建立训练管线，用 Pikafish 做 Teacher 产出初始模型。

**任务清单**:

1. **Python 后端搭建**
   - [ ] 创建 `python-backend/` 目录
   - [ ] 实现 Xiangqi 环境类（封装现有 JS 规则 → Python 重写）
   - [ ] 接入 Pikafish（通过 UCI 协议或 WASM）
   - [ ] 自对弈脚本：Pikafish vs Pikafish 生成局面-评估数据

2. **数据生成**
   - [ ] 运行 10,000 局 Pikafish 自对弈
   - [ ] 每步记录：`(board_state, pikafish_eval_score, game_result)`
   - [ ] 数据存储为 NumPy `.npz` 格式

3. **初始神经网络训练**
   - [ ] 搭建 ResNet（PyTorch）：Policy 头 + Value 头
   - [ ] 用 Pikafish 数据做监督学习（行为克隆）
   - [ ] 导出 ONNX 模型

4. **前端集成**
   - [ ] 引入 ONNX Runtime Web
   - [ ] 替换现有 GreedyAI 评估函数为神经网络推理
   - [ ] 验证推理速度 < 100ms/步

**交付物**:
- Python 训练脚本
- 初始 ONNX 模型文件（~10MB）
- 前端可加载模型并实时推理

---

### Phase 2: AlphaZero 自对弈训练（2-4 周）

**目标**: 切换到纯自对弈强化学习，不再依赖 Pikafish。

**任务清单**:

1. **自对弈引擎**
   - [ ] 实现 AlphaZero MCTS（用神经网络引导搜索）
   - [ ] 自对弈循环：网络 → MCTS → 生成数据 → 训练 → 更新网络
   - [ ] 每轮迭代：生成 500 局 × 4 CPU 并行

2. **训练优化**
   - [ ] Action Masking：Policy 头屏蔽非法走法
   - [ ] 学习率调度：cosine annealing
   - [ ] 数据增强：棋盘翻转（红黑对称）
   - [ ] Experience Replay Buffer：存储最近 N 轮数据

3. **训练监控**
   - [ ] TensorBoard 可视化：Loss 曲线、Elo 变化
   - [ ] 每 10 轮 vs 上一版本网络评估胜率
   - [ ] 每 50 轮 vs Pikafish 评估棋力

4. **模型版本管理**
   - [ ] Git LFS 存储模型文件
   - [ ] 版本命名：`v{iteration}_{elo}.onnx`

**交付物**:
- AlphaZero 训练循环脚本
- 训练日志和 TensorBoard 数据
- 经过 N 轮迭代的最优模型

---

### Phase 3: 部署 + 持续进化（1-2 周）

**目标**: 生产级部署，支持浏览器内推理和后端 API 两种模式。

**任务清单**:

1. **推理优化**
   - [ ] 模型量化：FP32 → INT8（推理速度 4x 提升）
   - [ ] MCTS 并行化：多线程/多进程
   - [ ] 浏览器端：ONNX Runtime Web + WebGL 加速

2. **双模式部署**
   - **模式 A（纯前端）**: ONNX 模型 + JS MCTS，无需后端
   - **模式 B（后端 API）**: Python FastAPI 服务，前端调 API 获取走法

3. **持续进化机制**
   - [ ] 用户与 AI 对弈数据回传（可选）
   - [ ] 定期用新数据微调模型
   - [ ] 模型排行榜：记录每版本棋力

**交付物**:
- 生产级推理代码（前端 + 后端）
- 部署文档
- 模型版本管理方案

---

## 5. 技术挑战与应对

### 5.1 动作空间巨大

| 问题 | 应对 |
|------|------|
| 象棋单步最多 ~2000 种合法走法 | Policy 头输出 9×10×9×10 = 8100 维，用 action mask 屏蔽非法走法 |
| 炮的翻山吃子机制 | 状态编码增加"炮架"通道，或让网络自己学 |

### 5.2 象棋特有规则

| 规则 | 处理方式 |
|------|----------|
| 飞将（对面笑） | 在合法走法生成中过滤 |
| 长将判负 | 在环境 reward 中编码：连续将军同一局面 3 次 → 判负 |
| 60 步无吃子和棋 | 环境内置计数器，触发时 reward = 0 |
| 三次重复局面和棋 | Zobrist 哈希 + 历史记录，触发时 reward = 0 |

### 5.3 计算资源

| 阶段 | 预计资源 | 时间 |
|------|----------|------|
| Phase 1（监督学习） | 1× GPU（RTX 3060 级别） | 2-4 小时 |
| Phase 2（自对弈训练） | 4× GPU 并行 | 1-2 周（100 轮迭代） |
| Phase 3（推理部署） | CPU 即可（量化后） | — |

### 5.4 状态编码设计

```
输入张量: (14, 9, 10) — 14 通道 9×10 特征图

通道 0-6:   红方 7 种棋子（帅/仕/相/马/车/炮/兵）的二值位置图
通道 7-13:  黑方 7 种棋子（将/士/象/马/车/炮/卒）的二值位置图

可选增强:
通道 14:    红方刚走过的 move（source → dest 标记）
通道 15:    黑方刚走过的 move
通道 16:    重复局面计数（归一化）
```

---

## 6. 项目结构规划

```
chinese-chess/
├── js/                          # 现有前端代码
│   ├── ai/
│   │   ├── alphazero.js         # [新增] ONNX 推理 + MCTS
│   │   └── ...
│   └── ...
├── python-backend/              # [新增] Python 训练后端
│   ├── env/
│   │   ├── xiangqi_env.py       # Gym 环境封装
│   │   └── rules.py             # 象棋规则（Python 重写）
│   ├── model/
│   │   ├── resnet.py            # ResNet 网络定义
│   │   ├── trainer.py           # 训练循环
│   │   └── mcts.py              # AlphaZero MCTS
│   ├── scripts/
│   │   ├── generate_data.py     # Pikafish 数据生成
│   │   ├── train.py             # 主训练脚本
│   │   └── evaluate.py          # 模型评估（vs 旧版本 / vs Pikafish）
│   ├── models/                  # 模型文件（Git LFS）
│   ├── requirements.txt
│   └── README.md
├── docs/
│   ── 2026-08-21-xiangqi-alphazero-upgrade-design.md  # 本文档
└── README.md
```

---

## 7. 里程碑

| 里程碑 | 目标 | 预计时间 | 验收标准 |
|--------|------|----------|----------|
| M1: 训练管线就绪 | Pikafish 数据 + 监督学习模型 | Week 1 | 模型推理速度 < 100ms，Elo > 当前 GreedyAI |
| M2: 自对弈循环跑通 | AlphaZero MCTS + 自训练 | Week 2-3 | 10 轮迭代后模型胜率 > 50% vs M1 模型 |
| M3: 棋力达标 | 100 轮迭代 | Week 4-5 | 模型 vs Pikafish 有竞争力（非必达，视算力） |
| M4: 部署上线 | 前端/后端推理 | Week 6 | 用户可在浏览器选择"AlphaZero AI"对弈 |

---

## 8. 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| GPU 资源不足，训练太慢 | 高 | 高 | 先用 CPU 小规模验证管线正确性；Phase 1 用监督学习快速出初始模型 |
| 象棋规则编码复杂导致 bug | 中 | 高 | 用 Pikafish 的走法生成做交叉验证 |
| 浏览器推理太慢 | 中 | 中 | 模型量化 + 降低 MCTS 模拟次数 + 降级到后端 API 模式 |
| 自对弈不收敛 | 低 | 高 | 监控 Elo 曲线；不收敛时回退到监督学习 + 少量 RL 微调 |

---

## 9. 决策记录

### 决策 1: 为什么选 AlphaZero 而非 MuZero？
- **AlphaZero**: 需要硬编码规则，但规则已在现有 JS 代码中实现，Python 重写工作量可控
- **MuZero**: 不需要规则，但训练更慢、更不稳定，且象棋规则相对明确
- **结论**: Phase 1-2 用 AlphaZero；如果 Phase 2 遇到规则编码瓶颈，再考虑 MuZero

### 决策 2: 为什么先用 Pikafish 蒸馏？
- 纯 AlphaZero 从零开始需要数百万局自对弈才能超越业余水平
- Pikafish 蒸馏可以在几千局数据上就产出可用的初始模型
- 初始模型作为 AlphaZero 自训练的起点，大幅加速收敛

### 决策 3: ONNX 而非 TensorFlow/PyTorch 前端推理？
- ONNX Runtime Web 支持 WebGL 加速，浏览器内推理性能好
- 模型格式通用，PyTorch 训练 → ONNX 导出 → 前端推理，工具链成熟
- 避免在浏览器加载整个 PyTorch/TF 运行时

---

## 10. 附录

### 10.1 关键依赖

```
# Python 训练端
torch>=2.0
onnx
onnxruntime-gpu
gymnasium
numpy
tensorboard

# 前端推理端
onnxruntime-web (npm)
```

### 10.2 参考实现

- AlphaZero 伪代码: [DeepMind AlphaZero 论文 Appendix](https://arxiv.org/abs/1712.01815)
- AlphaZero-General 框架: [suragnair/AlphaZero_General](https://github.com/suragnair/AlphaZero_General)
- ONNX Runtime Web: [onnxruntime.ai/docs/tutorials/web/](https://onnxruntime.ai/docs/tutorials/web/)
- Pikafish: [github.com/official-pikafish/Pikafish](https://github.com/official-pikafish/Pikafish)
