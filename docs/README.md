# NekoVirtOS — 文档索引

最后更新：2026-07-24

| 文档 | 内容 |
|------|------|
| [mmd-studio.md](./mmd-studio.md) | MMD 工作室：能力、约定、WebGL/WebGPU TSL、Gizmo、物理、后处理 |
| [settings-roadmap.md](./settings-roadmap.md) | 系统设置分区与 P0/P1 进度（含实验 VR 入口） |
| [vr-desktop-roadmap.md](./vr-desktop-roadmap.md) | VR 桌面（WebXR）功能路线、依赖、工程落点（含已完成 UI 结论） |

## 快速约定

| 域 | 成片 / 默认 | 实验 |
|----|-------------|------|
| 2D 桌面壳 | DOM + CSS tokens | — |
| MMD Studio | **WebGL** | WebGPU + 官方 `/webgpu` TSL |
| VR 桌面 | **WebGL + WebXR**（`@react-three/xr`） | 不与 MMD WebGPU 同会话 |
| 后处理 | WebGL-only | VR 内关闭 |

## 构建 / 测试 / 部署

```bash
pnpm install
pnpm build             # tsc -b && vite build
pnpm test
pnpm deploy            # build + wrangler pages deploy
```

## 外部参考（R3F 性能）

- [Performance pitfalls](https://docs.pmnd.rs/react-three-fiber/advanced/pitfalls)（中文镜像：[fiber.framer.wiki/advanced-pitfalls](https://fiber.framer.wiki/advanced-pitfalls)）
- [Scaling performance](https://docs.pmnd.rs/react-three-fiber/advanced/scaling-performance)（中文：[advanced-scaling](https://fiber.framer.wiki/advanced-scaling)）
