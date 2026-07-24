# NekoVirtOS — 文档索引

最后更新：2026-07-24

**当前重心：** [MMD VR 展示器](./mmd-vr-showcase-roadmap.md) · **VR 桌面：** [基线收尾 / 搁置](./vr-desktop-roadmap.md)

| 文档 | 内容 |
|------|------|
| [mmd-studio.md](./mmd-studio.md) | MMD 工作室：能力、约定、WebGL/WebGPU TSL、Gizmo、物理、后处理 |
| [mmd-vr-showcase-roadmap.md](./mmd-vr-showcase-roadmap.md) | **优先** · MMD 独立 WebGL XR 展示器 |
| [settings-roadmap.md](./settings-roadmap.md) | 系统设置分区与进度 |
| [vr-desktop-roadmap.md](./vr-desktop-roadmap.md) | VR 工作台基线（**暂缓新功能**） |

## 快速约定

| 域 | 成片 / 默认 | 实验 / 状态 |
|----|-------------|-------------|
| 2D 桌面壳 | DOM + CSS tokens | — |
| **shared** | storage / URL / 书签等业务逻辑 | 2D 与 VR 共用，无 UI |
| **src/xr** | 进入 / pending attach / 探测 / quality 轴 / session 工厂 | 桌面与 MMD **分会话实例** |
| **shared** 扩展 | panel 贴图 · localPrefs · **tasks/calendar** · browser/sticky | 无 React；壳层读 `localData` 薄封装 |
| MMD Studio | **WebGL** | WebGPU + 官方 `/webgpu` TSL |
| **MMD VR 展示器** | **WebGL + WebXR**（独立会话） | **当前 VR 重心**；轻量视觉白名单 |
| VR 桌面 | WebGL + WebXR（基线已交付） | **搁置**；仅维护；不与展示器同会话 |
| 后处理 | WebGL-only（Studio） | VR 内无全量栈 |

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
