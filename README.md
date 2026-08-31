# 3D Playground

一个用于快速验证/迭代「网页 3D 项目」的脚手架，后续的 3D 任务会直接在这个仓库里实现。

## 技术栈

| 层 | 方案 |
|---|---|
| 构建 | Vite 8 |
| 语言 | TypeScript |
| UI 框架 | React 19 |
| 3D 渲染 | Three.js + React Three Fiber (R3F) |
| 工具组件 | @react-three/drei（OrbitControls / Environment / Grid / 粒子等） |
| 后期处理 | @react-three/postprocessing（Bloom / Vignette 等） |
| 实时调参 | leva |
| 代码检查 | ESLint 9 扁平配置 |

## 快速开始

```bash
pnpm install
pnpm dev
```

打开 http://localhost:5173 即可看到场景。

## 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 启动开发服务器（热更新） |
| `pnpm build` | 类型检查 + 生产构建 |
| `pnpm preview` | 本地预览生产构建 |
| `pnpm lint` | ESLint 检查 |

## 目录结构

```
.
├── index.html              # 入口 HTML
├── public/
│   └── favicon.svg
├── src/
│   ├── App.tsx             # 应用壳：Canvas + HUD + Leva
│   ├── main.tsx            # React 入口
│   ├── styles.css          # 全局样式（HUD / FPS / Leva）
│   ├── scene/
│   │   └── Scene.tsx       # 3D 场景（当前为默认演示，正式需求在此替换）
│   └── ui/
│       └── Hud.tsx         # 页面 HUD（标题 + 操作提示）
├── vite.config.ts
└── tsconfig*.json
```

## 默认演示场景

当前场景包含：

- 程序化环境光（`Environment` + `Lightformer`，无需联网下载 HDR）
- 阴影、接触阴影、雾效、粒子（`Sparkles`）
- 透明材质（`meshPhysicalMaterial` 透射）、金属/标准材质
- OrbitControls 旋转/缩放/平移
- Bloom + Vignette 后期处理
- FPS 面板（drei `<Stats />`）
- Leva 实时参数面板（主色 / 金属感 / 旋转速度 / 自动旋转）
