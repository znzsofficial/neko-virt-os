# MMD Studio — 进度与约定

最后更新：2026-07-13（晚间：Gizmo / 灯光预设 / 工程债）

## 定位

NekoVirtOS 内的浏览器 MMD 工作台：多模型预览、动作/表情/镜头、物理、HDR、后处理、地面真阴影、项目存取、离线/实时导出。

- **成片路径：WebGL**
- **WebGPU：实验预览**（无完整 toon / 后处理 / map 阴影）
- 后处理：**WebGL-only**

## 当前能力

| 模块 | 状态 | 说明 |
|------|------|------|
| 多模型场景 | 已有 | 增删、显隐、选中；文件夹多 PMX **勾选导入**（默认每夹 1 个 + companion） |
| 模型变换 | 已有 | 侧栏数字 + **视口 Transform Gizmo**（移动/旋转/缩放）；无选中时自动选第一个可见模型 |
| Morph | 已有 | 搜索、分组、书签 |
| 动作 | 已有 | body / face / **camera** 三槽；镜头优先独立 VMD，再身体 VMD 内相机 |
| 时间轴 | 已有 | scrub、入出点、帧步进、主次刻度、In/Out 拖拽、可编辑时间；**CSS 变量 rail** 与指针共用 inset |
| 物理 | 已有 | Bullet WASM；**每模型独立 world**；开关 rebuild；重置 rebind |
| HDR / 天空 | 已有 | `.hdr` / `.exr` / LDR 全景；背景 / 环境、env 强度 |
| 后处理 | 已有 | WebGL only；结构参数 rebuild、连续参数热更；SelectiveBloom / DOF 锁模型 / Lens / TiltShift / GodRays / Sparkle |
| 阴影 | 已有 | `off` \| `map`；`PCFShadowMap`；地面唯一接收（略低于 y=0）；角色 cast-only |
| 灯光 | 已有 | 平行光 + **环境光注入 MMD toon**；**一键预设**（default/studio/outdoor/sunset/anime/dramatic/soft） |
| 调试辅助 | 已有 | 太阳光 Helper、骨骼 SkeletonHelper（录制/导出时自动隐藏） |
| 项目系统 | 已有 | 列表、搜索、双击打开、阶段进度；保存/打开；autosave（编辑器内 8s 防抖；录制/导出/busy 暂停）；关窗确认 |
| 导出 | 已有 | 默认 **离线 WebCodecs** + MediaRecorder；MP4/WebM；竖屏/自定义分辨率；**自定义视频 Mbps / 音频 kbps**（`NumberField`）；PNG/序列 ZIP |
| 布局 | 已有 | 侧栏宽度 / 折叠、时间轴高度可调；localStorage `neko-virt-os.mmd-layout.v1`；键盘调分隔条 |
| 全屏 | 已有 | OS **沉浸全屏**（隐藏桌面/任务栏/标题栏）；工具栏 ⛶ / Esc / F11 退出 |
| 关于页 | 已有 | 开源依赖许可表 |

## 工程结构（主路径）

```
src/appModules/mmdStudio/
  MmdStudioApp.tsx              # 编辑器壳：导入、全屏、布局绑定
  MmdProjectHome.tsx            # 工程列表 / 打开进度
  MmdSidePanel.tsx              # 侧栏各页
  MmdTimelineBar.tsx            # 高级时间轴（rail + 刻度）
  MmdCanvas.tsx                 # 场景、Gizmo、灯光/骨骼 Helper
  mmdStudioStore.ts             # 灯光预设 LIGHT_LOOK_PRESETS、gizmo 状态
  useMmdLayout.ts               # 侧栏/transport 尺寸、折叠、持久化、reclamp
  mmdLayoutPrefs.ts             # layout localStorage + clamp / 高度迁移
  useMmdProjectController.ts
  useMmdRecordingController.ts
  folderImport.ts               # 多 PMX 选择 / companion
  mmdWebCodecsExport.ts         # 离线 WebCodecs 导出
  mmdSceneHydrate.ts
  mmdProjectDb.ts / mmdProjectIO.ts / mmdZipStore.ts / mmdProjectPrefs.ts
  mmdRuntime.ts                 # 运行时 + 物理步进；getModelRoot
  mmdRuntimeEntry.ts            # 条目 / 变换 / cast-only
  mmdPhysics.ts                 # Bullet 加载与默认调参
  mmdRuntimeMaterials.ts / mmdMaterialEnhance.ts
  MmdPostFx.tsx / MmdSky.tsx / mmdSkyFormats.ts
  mmdPanelUi.tsx                # NumberField / Slider / Select 等

# 相关 shell / OS（非 mmdStudio 目录，但影响 MMD）
src/shell/SystemWindow.tsx      # 标题栏全屏按钮、immersive 铺满
src/shell/windowLifecycle.ts    # 关窗确认（Notes + MMD）
src/shell/filesBridge.ts        # Files 桥接（模块级 handlers，非每帧 setState）
src/osUiStore.ts                # immersiveWindowId
src/styles/mmd-studio.css       # MMD 样式；时间轴 --mmd-timeline-rail-inset-*
src/fs/                         # 虚拟 FS barrel（index.ts）
src/**/*.test.ts                # vitest：fileUtils / dialog / layout / filesBridge
```

构建：`npm run build`（`tsc -b && vite build`；**不要**加 `--mode production`）。

测试：`npx vitest run`。

部署（CF Pages）：`npx wrangler pages deploy ./dist --project-name=neko-virt-os --branch=main`。

## 重要约定

### 渲染与后端

- 默认/成片：**WebGL**
- 切换 WebGL ↔ WebGPU：快照 → 卸 Canvas → 新后端 hydrate
- WebGPU：后处理 off；无 map 阴影；MMD 材质 strip 为 `MeshStandard`

### 阴影

- 模式：`off` | `map`；类型 **`PCFShadowMap`**（勿用已弃用的 PCFSoft）
- 角色 cast-only；outline 不 cast；MMD self-shadow uniform 强制 0
- 地面唯一接收面，**y≈-0.015** + polygonOffset，避免与网格 z-fighting 导致视角闪烁
- 平行光 target 在 scene 原点

### 物理（2026-07-12 收尾）

对照 `@yohawing/three-mmd-loader` 官方 viewer + Bullet 语义：

1. **每模型独立 `physicsBackend`**  
   一个 Bullet world 同一时刻只保留最后上传的 rigid-body 集合；共享 world 会互相顶掉。

2. **步进前 `root.updateMatrixWorld(true)`**  
   库内 `mesh.updateWorldMatrix(false, true)` **不刷新父节点**；root 位移/旋转必须已写入 matrixWorld。

3. **缩放与碰撞**  
   刚体尺寸按 **模型原始单位** 上传，不随 `root.scale` 放大。  
   **物理步进时强制 scale=1**，步进后恢复用户 scale 再渲染。  
   位移/旋转照常进物理；仅 scale 做「步进 1 / 显示用户值」分离。

4. **`physics: false` 会 `backend.reset()` → `reset_world`**  
   重置路径 **不要** 用 `physics:false` 再 `true` 整世界清空。  
   重置：`seek(t+1/30)` → step → `seek(t)` → step（seeking 重绑软体）。  
   播放：仅 **回退 / 大跳（>0.25s）** 才 `runtime.seek`；正常前进保持连续 delta。

5. **t≈0 不步进物理**（与官方 viewer 一致）  
   第一帧真正播放时 seeking 重绑。

6. **调参**（`mmdPhysics.ts`）对齐官方 viewer 默认：  
   `maxSubSteps:5`、`solverIterations:20`、`resetCatchUpSteps:0`、  
   `dynamicWithBoneRotationFeedbackScale:1`、**不设 collisionMargin**（默认 -1）。  
   强制正 margin 可能导致 body↔cloth 无接触、软体只受重力下落。

7. WASM：`public/mmd/mmd_bullet.js` + `.wasm` 同目录；开关物理会 **rebuild 模型**。

### 后处理 / 导出缓冲（易踩坑）

- 结构参数 rebuild；连续参数 `useFrame` 热更
- **`EffectComposer.setSize` 只收逻辑尺寸**（`gl.getSize`），内部再 × pixelRatio  
  **禁止**传入 `domElement.width/height`（会二次放大超 maxTextureSize → Context Lost）
- 导出：`pixelRatio=1` + 目标分辨率；保存/恢复也用逻辑尺寸
- 大分辨率：`>720p` 关 MSAA；大图用 `UnsignedByte` FBO，避免 MSAA×HalfFloat OOM
- 导出顺序：先 `exportingOffline/recording` → 再 `setSize`，让后处理先降档

### 导出

- 默认离线 WebCodecs；`exportingOffline` 与实时 `recording` 分离
- 分辨率含竖屏/自定义；强制偶数宽高
- 相机 aspect / composer 跟 **export buffer**，避免成片横向挤压
- `seekTime` 同步 `timeRef`，避免离线 seek 错帧
- 码率：预设 + **custom Mbps / kbps**（UI 用 `NumberField`，与宽高输入一致）
- 时间步进 cap `1/20`（防卡顿导致物理大跳）

### 环境光

- 场景有 `ambientLight`，但 **WebGL MMD MeshToon 忽略它**
- 经 `mmdMaterialEnhance` 的 `mmdEnhanceAmbient` 注入；`setLighting({ ambientIntensity })`

### 灯光一键预设（2026-07-13）

- Store：`lightLook` + `LIGHT_LOOK_PRESETS` / `applyLightLook`  
- 预设：`default` | `studio` | `outdoor` | `sunset` | `anime` | `dramatic` | `soft`（手改任一灯光/阴影参数 → `custom`）  
- 灯光数值仍 `persistLights`（`neko-virt-os.mmd-lights.v1`）；启动时用 `matchLightLook` 反推当前预设名  
- **亮度调参（棚拍 / 二次元 / 柔光）**：环境光与太阳整体压暗，避免 toon 满屏发白  

| 预设 | ambient 约 | sun 约 | 说明 |
|------|------------|--------|------|
| default | 0.55 | 1.15 | `DEFAULT_LIGHTS` |
| studio | 0.42 | 0.72 | 棚拍，偏顶光 |
| outdoor | 0.42 | 1.55 | 户外强光 |
| sunset | 0.38 | 1.35 | 低仰角侧光 |
| anime | 0.40 | 0.85 | 中等对比 |
| dramatic | 0.18 | 1.85 | 低环境 + 强侧光 |
| soft | 0.48 | 0.40 | 柔光，忌过曝 |

### 视口 Gizmo / 调试辅助

- **TransformControls**（drei）：移动/旋转/缩放；拖动时暂停 Orbit  
- **显示条件**：有模型、非录制/离线导出；**不要求**相机必须是 free（镜头轨模式下也可摆模型）  
- **无选中**：自动选第一个可见模型并 `selectModel`  
- 太阳光 `DirectionalLightHelper`、选中模型 `SkeletonHelper` 可选；导出时隐藏  

### 布局 / 全屏（2026-07-13）

- **侧栏**：宽度 240–480px（拖拽 / 键盘）；折叠后视口 FAB 展开；折叠时侧栏仍挂载以保留 tab 状态  
- **时间轴高度（transport）**：默认 **148px**，最小 **120**（旧 <120 的 localStorage 会迁移到默认）  
- 持久化：`neko-virt-os.mmd-layout.v1`（debounce 写盘）  
- **沉浸全屏**：`osUiStore.immersiveWindowId`；隐藏桌面/任务栏/标题栏；窗口铺满视口  
  退出：工具栏、Esc、F11；最小化/关闭窗口也会 exit  
- 时间轴 **rail**：CSS 变量 `--mmd-timeline-rail-inset-x`（及 top/bottom）；JS `getComputedStyle` 读取，禁止再硬编码 12 与 CSS 分叉  

### 项目 / 关窗

- 有模型或导出中关 MMD 窗 → `confirmCloseMmdStudio`（`shell/windowLifecycle`）；**不** flush autosave  
- Autosave：编辑器内依赖变化后 **8s 防抖**；录制/离线导出/busy/loading 暂停  
- 打开工程：阶段进度条；等待 Scene API；错误走通知 / 应用内对话框  
- 危险确认统一 **应用内对话框**（`dialogStore` + `AppDialogHost`），不用 `window.confirm`

### 相机

- 默认：`pos (0,16,62)`，`target (0,9,0)`，`fov 40`
- 自由机位：WASD / F·C / Q·E / R；镜头轨优先 camera 槽 VMD

## 功能路线图进度

### Phase A — 可编辑基础

| 项 | 状态 |
|----|------|
| A1 模型变换 | 完成（侧栏 + 视口 Gizmo） |
| A2 Morph 全量 + 搜索/分组/书签 | 完成 |
| A3 时间轴 / 入出点 | 完成（含高级刻度 / 帧步进 / CSS rail） |
| 可调布局 / 沉浸全屏 | 完成 |
| 灯光一键预设 | **完成** |
| 全局性能档 | **部分**（阴影 quality；后处理/DPR 未统一） |

### Phase B — 动作与姿态

| 项 | 状态 |
|----|------|
| body / face / camera 三槽 | 完成 |
| B1 多 VMD 权重叠层 | **未做** |
| 半身 / 局部骨骼 mask | 未做 |
| VPD 姿态存读 | 未做 |
| 物理细调 UI | 未做 |

### Phase C — 场景与画面

| 项 | 状态 |
|----|------|
| HDR/EXR/LDR 天空 | 完成 |
| 后处理 Look 分组 | 完成 |
| 舞台 / 场景 PMX 或 GLTF | 未做 |
| 配件挂骨 | 未做 |
| 灯光关键帧轨 | 未做 |

### Phase D — 成片质量

| 项 | 状态 |
|----|------|
| 离线 WebCodecs 导出 | 完成 |
| MP4 / WebM | 完成 |
| PNG / 序列 ZIP | 完成 |
| 自定义分辨率 / 竖屏 | 完成 |
| 自定义视频/音频码率 UI | 完成 |
| 音画硬锁定 | **软同步**（仍可加强） |

## 推荐下一刀

```
物理回归手测（缩放 + 重置 + 多模型）
 → 全局性能档（阴影 + 后处理 + DPR）
 → B1 多 VMD 权重叠层
 → C 舞台模型（GLTFLoader 或 PMX）
 → Gizmo 快捷键（注意与 WASD 冲突）
```

## 手测清单（回归）

1. 整文件夹导入 PMX → 多模型勾选对话框 → 贴图正常  
2. 保存 → 重开项目 → 贴图/动作/灯光恢复；打开进度可见  
3. WebGL ↔ WebGPU 切换 → 不丢场景  
4. 阴影开/关 → 仅地面接收、无角色互影脏块  
5. **物理**：开物理 → 播放 → 裙/发有身体碰撞；**重置物理** 后不整片垂直掉  
6. **缩放 ≠ 1** 时开物理 → 碰撞仍正常（步进 scale=1、显示保持缩放）  
7. 镜头 VMD 槽 / 身体 VMD 内相机  
8. 时间轴：长时长刻度不叠；scrub 与进度条对齐；In/Out 拖拽  
9. 侧栏拖宽/折叠、transport 拉高；刷新后 layout 恢复（高度 ≥120）  
10. 沉浸全屏 → 无任务栏/标题栏；Esc / F11 / 关窗退出  
11. 离线导出 MP4/WebM、自定义分辨率、自定义 Mbps/kbps、可选音频  
12. 关 MMD 窗确认；autosave 不在录制中刷盘  
13. **Gizmo**：勾选后视口可见；可拖；无选中时自动选第一模型；镜头轨模式也可显示  
14. **灯光预设**：棚拍/二次元/柔光不过曝；手改 → 自定义；重置 → 默认  

## 近期关键文件

### 物理 / 导出 / 灯光（既有）

- `mmdPhysics.ts` / `mmdRuntime.ts` / `mmdRuntimeEntry.ts` — 物理 world、scale、seek、`getModelRoot`  
- `mmdWebCodecsExport.ts` / `useMmdRecordingController.ts` — 离线导出、取消、码率  
- `MmdCanvas.tsx` — seekTime、导出 buffer、阴影、aspect、**Gizmo / helpers**  
- `MmdPostFx.tsx` — composer 逻辑尺寸、MSAA/HalfFloat 降档  
- `mmdMaterialEnhance.ts` — 环境光注入  
- `mmdStudioStore.ts` — **LIGHT_LOOK_PRESETS**、`lightLook`、gizmo 开关  

### 布局 / 时间轴 / 全屏 / UX（2026-07-13）

- `useMmdLayout.ts` / `mmdLayoutPrefs.ts` — 可调布局  
- `MmdTimelineBar.tsx` / `styles/mmd-studio.css` — CSS rail 变量、刻度、transport 高度  
- `MmdStudioApp.tsx` — 全屏按钮、布局绑定、多 PMX 导入  
- `folderImport.ts` / `MmdProjectHome.tsx` / `useMmdProjectController.ts` — 导入与打开工程 UX  
- `MmdSidePanel.tsx` / `mmdPanelUi.tsx` — 灯光预设 UI、导出码率、Gizmo 控件  
- `shell/SystemWindow.tsx` / `osUiStore.ts` / `shell/windowLifecycle.ts` — 沉浸全屏与关窗  
- `shell/filesBridge.ts` — Files 跨窗口桥接  
- `dialogStore.ts` / `components/AppDialogHost.tsx` — 应用内对话框  
- `src/fs/*` — 虚拟 FS 模块 + barrel  
- `*.test.ts` — vitest 回归  
