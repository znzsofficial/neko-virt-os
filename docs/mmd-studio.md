# MMD Studio — 进度与约定

最后更新：2026-07-14（IBL / SSR / 侧栏精简 / 系统式文案）

## 定位

NekoVirtOS 内的浏览器 MMD 工作台：多模型预览、动作/表情/镜头、物理、HDR、后处理、地面真阴影、项目存取、离线/实时导出。

- **成片路径：WebGL**
- **WebGPU：实验预览**（无完整 toon / 后处理 / map 阴影）
- 后处理：**WebGL-only**

## 当前能力

| 模块 | 状态 | 说明 |
|------|------|------|
| 多模型场景 | 已有 | 增删、显隐、选中；文件夹多 PMX **勾选导入**（默认每夹 1 个 + companion） |
| 模型变换 | 已有 | 侧栏数字 + **视口 Transform Gizmo**；无选中时自动选第一个可见模型 |
| Morph | 已有 | 搜索、分组、书签 |
| 动作 | 已有 | body / face / **camera** 三槽 |
| 时间轴 | 已有 | scrub、入出点、帧步进、主次刻度、In/Out；**CSS 变量 rail** |
| 物理 | 已有 | Bullet WASM；**每模型独立 world**；步进 scale=1 / 显示用户 scale |
| HDR / 天空 | 已有 | `.hdr` / `.exr` / LDR；**天空背景** 与 **材质环境（IBL）** 分开关；**HDR 强度** |
| 材质反射 | 已有 | PMREM IBL + 可选 GGX；预设 chip：卡通 / 混合 / 金属 / 漆面；高级折叠 |
| SSR | 已有 | 屏幕反射；默认 0；cinema/dreamy/film 轻量开启；导出降档 |
| 后处理 | 已有 | WebGL；预设优先；主区 Bloom / 屏幕反射 / 暗角；其余折叠 |
| 阴影 | 已有 | `off` \| `map`；`PCFShadowMap`；地面唯一接收；角色 cast-only |
| 灯光 | 已有 | 预设 chip + **环境填充** / 主光手动折叠；`LIGHT_LOOK_PRESETS` |
| 辅助显示 | 已有 | 网格、变换控件、光源指示、骨骼（录制/导出隐藏） |
| 项目 / 导出 / 布局 / 全屏 | 已有 | 见下文章节 |

## 工程结构（主路径）

```
src/appModules/mmdStudio/
  MmdStudioApp.tsx
  MmdProjectHome.tsx
  MmdSidePanel.tsx              # 侧栏；预设优先、NestedPanel
  MmdTimelineBar.tsx
  MmdCanvas.tsx                 # 场景、Gizmo、setLighting + PMREM
  mmdStudioStore.ts             # lights / postFxTune.ssr / gizmo
  mmdEnvMap.ts                  # PMREM 缓存
  mmdMaterialEnhance.ts         # toon enhance rev v8-ibl-fix
  mmdRuntimeMaterials.ts
  mmdSsrEffect.ts               # SSR Effect + quality helpers
  MmdPostFx.tsx                 # composer；SSR 独立 EffectPass
  MmdSky.tsx                    # equirect + PMREM publish
  mmdPanelUi.tsx                # PanelSection / NestedPanel / 材质编辑器
  mmdRuntime.ts / mmdPhysics.ts / …
  mmd*Export* / useMmd*Controller / folderImport / mmdProject*

src/styles/mmd-studio.css       # chips、nested-panel、rail 变量
src/fs/                         # 虚拟 FS
src/**/*.test.ts                # fileUtils / dialog / layout / filesBridge / envMap / ssr
```

构建：`npm run build`（`tsc -b && vite build`）。

测试：`npx vitest run`。

部署：`npx wrangler pages deploy ./dist --project-name=neko-virt-os --branch=main`。

## 重要约定

### 渲染与后端

- 默认/成片：**WebGL**
- WebGL ↔ WebGPU：快照 → 卸 Canvas → 新后端 hydrate
- WebGPU：后处理 off；无 map 阴影；MMD 材质 strip 为 `MeshStandard`（吃 `scene.environment`，不挂 CubeUV `envMap`）

### 天空 vs 环境填充（易混）

| Store / UI 标签 | 作用 |
|-----------------|------|
| `skyAsBackground` · **天空背景** | 全景是否作背景 |
| `skyAsEnvironment` · **材质环境** | 是否生成 PMREM / `scene.environment` 供 IBL |
| `envIntensity` · **HDR 强度** | `scene.environmentIntensity`；材质 `envInfluence × envIntensity` |
| `lights.ambientIntensity` · **环境填充** | `ambientLight` + toon `mmdEnhanceAmbient`（均匀提亮） |

`envIntensity` 变化**只**改 intensity，**不**重建 PMREM（`MmdSky` 加载 effect 不含 `envIntensity` deps）。

### 材质 IBL / GGX（`mmdMaterialEnhance` rev `v8-ibl-fix`）

- PMREM：`mmdEnvMap.getPmremEnvMap` → `MmdSky` publish → `getActivePmremEnvMap` / `subscribePmremEnvMap` → `runtime.setLighting({ envMap })`
- 每材质：
  - `lightingModel`: `toon` | `pbr`（方向光 GGX）
  - `specularMode`: `mmd` | `mmd+env` | `env`
  - 有效环境：`envInfluence × envIntensity`；roughness / metallic 控 lod 与 Fresnel
- UI：预设 chip 优先；`specularMode === mmd` 时隐藏反射滑条；高级折叠贴图与模式
- view→world：`inverse(viewMatrix)`；IBL 输出不硬 clamp 到 1；太阳关 → GGX `lightIntensity=0`

### SSR（`mmdSsrEffect.ts`）

- `EffectAttribute.CONVOLUTION | DEPTH`；**独立** `EffectPass`（不可与其它 convolution 同 pass）
- `postFxTune.ssr`：默认 **0**；cinema / dreamy / film 预设带轻量值
- 质量：projection 重建、深度不连续早退、Fresnel 早退、jitter、命中 3-tap 模糊
- 性能：6–14 步；`ssrQualityFromPixels` 按分辨率降档；导出 `exportMode` 再降步数与强度
- 与材质 IBL 叠加：SSR 管屏内细节，IBL 管环境

### 阴影

- `off` | `map`；**`PCFShadowMap`**
- 角色 cast-only；地面唯一接收，**y≈-0.015** + polygonOffset
- 平行光 target 在 scene 原点

### 物理

1. 每模型独立 Bullet world  
2. 步进前 `root.updateMatrixWorld(true)`  
3. 步进时 root **scale=1**，步进后恢复用户 scale  
4. 重置：**不要** `physics:false` 清世界；用 seek 重绑  
5. t≈0 不步进；**不设** `collisionMargin`  
6. WASM：`public/mmd/mmd_bullet.js` + `.wasm`

### 后处理 / 导出缓冲

- 结构参数 rebuild；连续参数 `useFrame` 热更  
- **`EffectComposer.setSize` 只收逻辑尺寸**  
- 导出：`pixelRatio=1`；大分辨率关 MSAA；先标记 exporting 再 `setSize`

### 灯光预设

- `lightLook` + `LIGHT_LOOK_PRESETS` / `applyLightLook`  
- 手改灯光/阴影 → `custom`；`persistLights` + 启动 `matchLightLook`

### 侧栏 UX / 文案（2026-07-14）

**结构**

| Tab | 主路径 |
|-----|--------|
| 资源 | 模型列表、导入、播放/物理 |
| 模型 | 变换、Morph、材质（预设 chip） |
| 画面 | 天空 → 光照 chip → 阴影折叠 → 画面风格 + Bloom/反射/暗角 → 氛围/调色/AA 折叠 |
| 导出 / 项目 | 码率、工程列表 |

- 嵌套折叠用 **`NestedPanel`**（轻量），禁止 `PanelSection` 套 `PanelSection`
- 材质编辑器：`mmd-preset-chips` + 可选反射滑条 + `mmd-nested-advanced`
- 样式：`mmd-chip` / `mmd-nested-panel` / `mmd-nested-advanced`（`mmd-studio.css`）

**文案约定（系统式）**

- 控件：**短名词**（如 HDR 强度、环境填充、屏幕反射、辅助显示）
- **避免**说教/否定句（「不是…」「需…才能…」「屏外不会…」）
- 长说明 key 置 `""`；UI 用 `t(key) ? <p>…` 条件渲染，不留空 note

### 布局 / 全屏

- 侧栏 240–480px；transport 默认 **148**、最小 **120**  
- `neko-virt-os.mmd-layout.v1`  
- 沉浸全屏：`osUiStore.immersiveWindowId`  
- 时间轴 rail：CSS `--mmd-timeline-rail-inset-*`，JS 读 computed style

### 项目 / 对话框

- 关窗确认：`shell/windowLifecycle`  
- Autosave：8s 防抖；录制/导出/busy 暂停  
- 对话框：`dialogStore` + `AppDialogHost`

### 相机

- 默认 `pos (0,16,62)`，`target (0,9,0)`，`fov 40`  
- 自由机位 WASD / F·C / Q·E / R；镜头轨优先 camera VMD

## 功能路线图进度

### Phase A — 可编辑基础

| 项 | 状态 |
|----|------|
| A1 模型变换 | 完成（侧栏 + Gizmo） |
| A2 Morph | 完成 |
| A3 时间轴 | 完成 |
| 布局 / 全屏 | 完成 |
| 灯光预设 | 完成 |
| 侧栏预设优先 / 系统文案 | 完成 |
| 全局性能档 | **部分**（阴影 quality；SSR 分辨率降档；后处理/DPR 未统一） |

### Phase B — 动作与姿态

| 项 | 状态 |
|----|------|
| body / face / camera 三槽 | 完成 |
| B1 多 VMD 权重叠层 | **未做** |
| 半身 / 局部骨骼 mask | 未做 |
| VPD | 未做 |
| 物理细调 UI | 未做 |

### Phase C — 场景与画面

| 项 | 状态 |
|----|------|
| HDR/EXR/LDR 天空 | 完成 |
| PMREM IBL + 材质预设 | 完成 |
| SSR | 完成 |
| 后处理 Look | 完成 |
| SSGI（可选） | **未做**（默认关、半分辨率方案待定） |
| 舞台 GLTF / PMX | 未做 |
| 配件挂骨 | 未做 |
| 灯光关键帧轨 | 未做 |

### Phase D — 成片

| 项 | 状态 |
|----|------|
| 离线 WebCodecs / MP4 / WebM / 序列 | 完成 |
| 自定义分辨率 / 码率 | 完成 |
| 音画硬锁定 | **软同步** |

## 推荐下一刀

```
手测 IBL + SSR + 材质预设
 → 全局性能档（后处理 + DPR + 阴影统一）
 → B1 多 VMD 权重
 → 舞台模型
 → （可选）SSGI 默认关
```

## 手测清单（回归）

1. 文件夹导入 PMX → 多模型勾选 → 贴图正常  
2. 保存 / 重开项目 → 资源与设置恢复  
3. WebGL ↔ WebGPU 切换 → 不丢场景  
4. 阴影：仅地面接收  
5. 物理：碰撞、重置、缩放≠1  
6. 时间轴 scrub / In·Out / layout 持久化  
7. 沉浸全屏进退  
8. 离线导出分辨率与码率  
9. **Gizmo** 可见可拖；辅助显示折叠  
10. **灯光预设** chip；环境填充 vs **HDR 强度** 互不替代  
11. **材质**：卡通 / 混合 / 金属 / 漆面；混合需天空「材质环境」+ HDR  
12. **SSR**：滑条 >0 有屏内反射；高分辨率不严重掉帧；导出可接受  

## 近期关键文件

### 反射 / 后处理

- `mmdEnvMap.ts` / `MmdSky.tsx` — PMREM  
- `mmdMaterialEnhance.ts` / `mmdRuntimeMaterials.ts` / `mmdRuntime.ts` — IBL + GGX + setLighting  
- `mmdSsrEffect.ts` / `MmdPostFx.tsx` — SSR pass、导出降档  
- `mmdSsrEffect.test.ts` / `mmdEnvMap.test.ts`

### 侧栏 / 文案

- `MmdSidePanel.tsx` — NestedPanel、预设 chip、短标签  
- `mmdPanelUi.tsx` — MaterialOverrideEditor、NestedPanel  
- `styles/mmd-studio.css` — chips / nested  
- `languageStore.ts` — 中英文系统式短文案；空 hint 不渲染  

### 既有核心

- `mmdPhysics.ts` / `mmdRuntime.ts` / `MmdCanvas.tsx` / `mmdStudioStore.ts`  
- `useMmdLayout.ts` / `MmdTimelineBar.tsx` / `shell/*` / `src/fs/*`
