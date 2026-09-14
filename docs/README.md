# NekoVirtOS — 文档索引

最后更新：2026-09-14

**当前重心：** [MMD Studio](./mmd-studio.md)

| 文档 | 内容 |
|------|------|
| [mmd-studio.md](./mmd-studio.md) | MMD 工作室：能力、约定、WebGL/WebGPU TSL、Gizmo、物理、后处理 |
| [three-mmd-loader-maintenance.md](./three-mmd-loader-maintenance.md) | three-mmd-loader 本地补丁、根因、上游 Issue/PR 与升级收尾步骤 |
| [deployment.md](./deployment.md) | Pages 部署路径与 wrangler ≥4.130 代理委托坑 |
| [settings-roadmap.md](./settings-roadmap.md) | 系统设置分区与进度 |

## 快速约定

| 域 | 成片 / 默认 | 实验 / 状态 |
|----|-------------|-------------|
| 2D 桌面壳 | DOM + CSS tokens | — |
| **shared** | storage / URL / 书签 / tasks/calendar 等业务逻辑 | 无 UI、无 React |
| **src/system** | prefs / theme / network / downloads / backup / localData 门面 | 壳层系统工具，非产品 UI |
| **src/i18n** | `zh.ts` / `en.ts` 文案字典 | `languageStore` 仅 store + `t()` |
| **src/styles/** | 按域拆分 CSS（base/shell/apps/…） | 入口 `styles.css` 仅 `@import` |
| MMD Studio | **WebGL** | WebGPU + 官方 `/webgpu` TSL |
| 后处理 | WebGL-only（Studio） | — |

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
