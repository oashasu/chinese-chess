# Chinese Chess Game

中国象棋游戏 - 支持人机对弈和机机对弈，含多种高级 AI 策略。

## 特性

- 🎮 **双模式对弈**
  - 人机对弈：玩家 vs AI
  - 机机对弈：AI vs AI（支持同策略/不同策略对抗）

- 🧠 **多种 AI 策略**
  - **Random** - 随机走法（基准）
  - **Greedy** - 贪心算法（局部最优）
  - **Minimax + Alpha-Beta** - 经典博弈树搜索
  - **MCTS** - 蒙特卡洛树搜索（类 AlphaGo）
  - **Hybrid** - 混合策略（MCTS + 评估函数）

- 🎯 **反循环机制**
  - Zobrist Hashing 快速局面检测
  - 三次重复局面判和
  - 长将检测（连续将军判负）
  - 60步无吃子判和
  - 进展检测（强制变着）

- 🎨 **美观界面**
  - 响应式设计
  - 动画走子效果
  - 走法历史记录
  - 实时评估显示

## 技术栈

- 纯前端实现（HTML5 + CSS3 + JavaScript）
- Canvas 绘制棋盘
- Web Workers 异步 AI 计算
- 零依赖，开箱即用

## 使用方法

```bash
# 直接用浏览器打开
open index.html

# 或使用本地服务器
python3 -m http.server 8080
# 访问 http://localhost:8080
```

## AI 策略说明

### Minimax + Alpha-Beta 剪枝
- 深度搜索博弈树
- Alpha-Beta 剪枝优化
- 评估函数：棋子价值 + 位置权重 + 机动性

### MCTS (蒙特卡洛树搜索)
- 随机模拟大量对局
- UCB1 公式平衡探索与利用
- 迭代加深，时间可控
- 类 AlphaGo 核心思想

### 反循环机制
- **Zobrist Hashing**: O(1) 局面哈希，快速检测重复
- **长将规则**: 连续将军同一局面判负
- **三次重复**: 相同局面出现3次判和
- **60步规则**: 无吃子超过60步判和
- **进展检测**: 连续10步无进展强制变着

## 项目结构

```
chinese-chess/
├── index.html          # 主页面
├── css/
│   └── style.css      # 样式
├── js/
│   ├── game.js        # 游戏主逻辑
│   ├── board.js       # 棋盘渲染
│   ├── pieces.js      # 棋子规则
│   ├── ai/
│   │   ├── random.js
│   │   ├── greedy.js
│   │   ├── minimax.js
│   │   ├── mcts.js
│   │   └── hybrid.js
│   ├── zobrist.js     # Zobrist Hashing
│   └── utils.js       # 工具函数
└── README.md
```

## License

MIT
