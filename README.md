# 连裤袜穿戴模拟 · Pantyhose Sim

一个基于 Web 的 3D 穿戴演示：屏幕上是一双程序化建模的女生腿（外加裙子），
连裤袜初始只穿在脚上、在脚踝处缩拢成一堆；按住连裤袜的袜口上下拖动，
就能模拟「穿上 / 脱下」的过程，多余布料会以褶皱形式堆叠在袜口下方。

## 技术栈

| 层 | 方案 |
|---|---|
| 构建 | Vite 8 |
| 语言 | TypeScript |
| UI 框架 | React 19 |
| 3D 渲染 | Three.js + React Three Fiber (R3F) |
| 工具组件 | @react-three/drei（OrbitControls / Environment / 网格 / Stats） |
| 后期处理 | @react-three/postprocessing（Vignette） |
| 实时调参 | leva |
| 代码检查 | ESLint 9 扁平配置 |

## 快速开始

```bash
pnpm install
pnpm dev
```

打开 http://localhost:5173 即可开始拖拽。

## 交互

- **按住连裤袜上下拖动**：拉上 / 脱下
- **左键空白处拖动**：旋转视角
- **滚轮**：缩放
- 底部按钮：**一键穿上 / 拉下来**
- 左上角 leva 面板：调节袜子颜色、透明度、褶皱幅度、线框调试

## 实现要点

- **程序化腿部建模**：从脚尖到髋部的 CatmullRom 曲线 + 可变半径截面生成腿部网格，
  没有引入任何外部模型文件。
- **长度守恒布料**：连裤袜布料长度固定，根据袜口位置把「已穿部分」吸附到腿部表面，
  剩余松弛量以多层手风琴环的形式堆叠在袜口下方，形成自然缩拢与褶皱。
- **袜口拖拽**：用一个共享的 0..1 进度控制两只袜子的高度，支持平滑过渡，
  可以通过 URL 参数 `?hem=0.6` 直接指定初始进度（方便截图对比）。
- **调试**：`?wire=1` 开启布料线框。

## 目录结构

```
.
├── index.html
├── public/favicon.svg
├── src/
│   ├── App.tsx                  # Canvas + HUD + Leva
│   ├── main.tsx
│   ├── styles.css
│   ├── state/hoseStore.ts       # 全局袜口进度（HUD 按钮 / 拖拽 / URL 共用）
│   ├── scene/
│   │   ├── Scene.tsx            # 场景组装：灯光 / 地面 / 相机 / 后期
│   │   ├── Legs.tsx             # 腿部皮肤 + 裙子网格
│   │   ├── Pantyhose.tsx        # 单条腿的连裤袜（每帧更新布料几何）
│   │   ├── HemController.tsx    # 拖拽 -> 袜口目标进度 + 平滑过渡
│   │   └── legMesh.ts           # 腿部曲线、采样、圆环、布料「长度守恒」求解
│   └── ui/Hud.tsx               # 标题 / 操作提示 / 一键穿脱按钮
├── vite.config.ts
└── tsconfig*.json
```

## 调试参数

| URL 参数 | 作用 |
|---|---|
| `?hem=0..1` | 设置初始袜口进度（0=脚踝，1=髋部） |
| `?wire=1` | 显示布料线框 |
