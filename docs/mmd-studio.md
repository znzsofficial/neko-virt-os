# MMD Studio — 进度与约定

最后更新：2026-07-24（`@yohawing/three-mmd-loader@0.7.0`）

文档索引：[docs/README.md](./README.md)

## 定位

NekoVirtOS 内的浏览器 MMD 工作台：多模型预览、动作/表情/镜头、物理、HDR、后处理、地面真阴影、项目存取、离线/实时导出。

- **成片路径：WebGL**
- **WebGPU：实验预览** — 官方 `@yohawing/three-mmd-loader/webgpu` **TSL pipeline**（toon + sparse morph；`pipeline.render`）；无 postprocessing / 无 WebGL map 阴影；TSL self-shadow 默认关（cast-only）
- **后处理：WebGL-only**
- **VR 桌面**：**不**共用本模块 WebGPU 会话；见 [vr-desktop-roadmap.md](./vr-desktop-roadmap.md)
- **依赖**：`@yohawing/three-mmd-loader@0.7.0`（mmd-anim WASM 0.3.1）；Bullet：`public/mmd/mmd_bullet.{js,wasm}`

### 0.7.0 注意

- Toon + 自阴影对齐 MMD 9.32：`shadowMap.enabled` 时 toon 随场景自阴影变化；本工作室仍 **角色 cast-only**（`enforceModelCastOnlyShadows`，TSL 用 `receiveOnly`）
- 加载时纹理就绪后再创建 runtime（库侧）
- 官方 TSL：`createMmdTslPipeline` / `createModelLoadOptions` / `attach` / `render`

## 当前能力

| 模块 | 状态 | 说明 |
|------|------|------|
| 多模型场景 | 已有 | 增删、显隐、选中；文件夹多 PMX 勾选导入 |
| 模型变换 | 已有 | 侧栏 + **Gizmo**（three-stdlib；**overlay Scene**；拖拽结束写 store；`gizmoLock`） |
| Morph | 已有 | 搜索、分组、书签 |
| 动作 | 已有 | body / face / **camera** |
| 时间轴 | 已有 | scrub、入出点、帧步进 |
| 物理 | 已有 | Bullet；每模型独立 world；步进 scale=1 |
| HDR / 天空 | 已有 | hdr/exr/LDR；背景与 IBL 分开关 |
| 天空自动导入 | 已有 | **有模型包时仅 .hdr/.exr 自动当天空**；防贴图误当全景（`mmdSkyFormats`） |
| 材质反射 | 已有 | PMREM IBL + 可选 GGX |
| SSR | 已有 | WebGL；默认 0 |
| 后处理 | 已有 | WebGL；resize 失败不跳过整帧；composer 失败 fallback |
| 阴影 | 已有 | off \| map；PCF；地面唯一接收 |
| 灯光 | 已有 | 预设 + 环境填充 |
| 辅助 | 已有 | **GridHelper**（非 drei Grid@r185）；Gizmo 默认 **关** |
| 项目 / 导出 | 已有 | — |

## 工程结构（主路径）

```
src/appModules/mmdStudio/
  MmdStudioApp.tsx
  MmdCanvas.tsx              # GridHelper、Gizmo overlay、WebGPU TSL bridge
  mmdTslPipeline.ts          # createMmdTslPipeline 动态 import
  mmdRuntime.ts              # gizmoLock、bindTslPipeline、tslPending
  mmdRuntimeEntry.ts
  mmdRuntimeMaterials.ts     # strip / enhance；跳过 TSL 材质
  mmdSkyFormats.ts           # 天空自动识别（收紧 LDR）
  MmdPostFx.tsx / MmdSky.tsx / mmdMaterialEnhance.ts / mmdSsrEffect.ts
  …
docs/mmd-studio.md
```

构建：`pnpm build` · 测试：`pnpm test` · 部署：`pnpm deploy`

## 重要约定

### 渲染与后端

- 成片：**WebGL**
- WebGL ↔ WebGPU：快照 → 卸 Canvas → hydrate
- **WebGPU TSL**：
  1. `WebGPURenderer.init()` 后 `createMmdTslPipeline` → `gl.userData.mmdTslPipeline`
  2. `StudioScene` **唯一** `bindTslPipeline`
  3. `loadModel(..., createModelLoadOptions())` + `attach`（sun light；self-shadow off）
  4. pipeline 未绑定：**不 strip**（`tslPending` + 隐藏）；bind/setLighting 后再 attach
  5. attach 失败才 `stripWebGlOnlyMaterialShaders` → MeshStandard（**不可逆**）
  6. `MmdWebGpuTslBridge` `useFrame(1)` → `pipeline.render`
  7. 后处理 / classic map 阴影 off

### Gizmo（视口变换）

| 规则 | 原因 |
|------|------|
| **不要** attach 到 MMD `model.root` | 每帧骨骼 `updateMatrixWorld` 与 TC 叠加易卡死 |
| **overlay Scene** + three-stdlib TC | 不进 EffectComposer / 主 scene traverse |
| 拖拽中 **禁止** 每帧 `patchModel` | React 主线程卡死、无控制台报错 |
| `gizmoLock` | 拖拽时 update 不踩 TRS；物理仍可 scale=1 |
| 有 PostFx 时 Gizmo `priority 2` 只叠层 | PostFx `priority 1` 画主场景 |
| 默认 `showGizmo: false` | 减少误触 |

### 天空导入

- 批量导入：**有 PMX 时** 自动天空只认 **.hdr / .exr**
- LDR 全景：侧栏手动加载，或文件名强天空语义（无模型时）
- 见 `mmdSkyFormats.isAutoSkyCandidate`

### 天空 vs 环境填充

| Store / UI | 作用 |
|------------|------|
| `skyAsBackground` | 全景是否作背景 |
| `skyAsEnvironment` | PMREM / environment 供 IBL |
| `envIntensity` | HDR 强度（不重建 PMREM） |
| `lights.ambientIntensity` | 环境填充光 |

### 材质 IBL / SSR / 阴影 / 物理

- IBL：`mmdMaterialEnhance` rev `v8-ibl-fix`；WebGPU TSL 不走 enhance  
- SSR：独立 EffectPass；导出降档  
- 阴影：PCF；地面 y≈-0.015；角色 cast-only  
- 物理：每模型 world；步进 scale=1；t≈0 不步进；WASM 在 `public/mmd/`  

### R3F 性能（本模块必遵）

见 [R3F pitfalls](https://docs.pmnd.rs/react-three-fiber/advanced/pitfalls) / [scaling](https://docs.pmnd.rs/react-three-fiber/advanced/scaling-performance)：

- **禁止** `useFrame` / Gizmo 拖拽路径里高频 `setState` / `patchModel`  
- 动画用 **delta**  
- 复用几何/材质；少挂载卸载  
- 后处理 resize 失败 **不要** skip 整帧（黑屏）  
- WebGPU 接管渲染时注意 **priority > 0** 会关掉 R3F 默认 `gl.render`  

## 相关文档

- [VR 桌面](./vr-desktop-roadmap.md)  
- [设置](./settings-roadmap.md)  
