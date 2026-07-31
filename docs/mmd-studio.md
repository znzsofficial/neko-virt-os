# MMD Studio — 进度与约定

最后更新：2026-07-31（`@yohawing/three-mmd-loader@0.7.0`）

文档索引：[docs/README.md](./README.md)

## 定位

NekoVirtOS 内的浏览器 MMD 工作台：多模型预览、动作/表情/镜头、物理、HDR、后处理、地面真阴影、项目存取、离线/实时导出。

- **成片路径：WebGL**
- **WebGPU：实验预览** — 官方 `@yohawing/three-mmd-loader/webgpu` **TSL pipeline**（toon + sparse morph；`pipeline.render`）；无 postprocessing / 无 WebGL map 阴影；TSL self-shadow 默认关（cast-only）
- **后处理：WebGL-only**
- **VR 桌面**：**不**共用本模块 WebGPU 会话；见 [vr-desktop-roadmap.md](./vr-desktop-roadmap.md)
- **MMD VR 展示器**：独立 `mmd-vr.html` 页面、WebGL renderer 与 XR 会话；**不**从 Studio 进入或传递场景。展示器仍复用 `mmdRuntime`，但不加载 Studio Canvas / UI；见 [mmd-vr-showcase-roadmap.md](./mmd-vr-showcase-roadmap.md)
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
| 项目 / 导出 | 已有但有缺陷 | 见下方“已知缺陷与技术债”；大型工程、异常中断和跨后端恢复尚不可靠 |

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

## 已知缺陷与技术债

下面状态来自 2026-07-27 静态代码审查。“已确认”表示代码路径本身可以证明问题存在，不代表已经在所有浏览器复现；“风险”表示仍需浏览器、GPU 或大文件压力测试确认影响范围。

### P0：数据损坏与生命周期竞态

#### 1. 异步模型加载可在 runtime 销毁后继续完成（已修复，待浏览器回归）

- runtime 现有 disposed guard，并在 Bullet 初始化、WebGPU load options 和 `loadModel` 后验证生命周期。
- 过期的 Bullet world 和已完成模型会立即 dispose，不再进入旧 scene 或 `entries`。
- 位置：`mmdRuntime.ts` 的 `createEntry` / `addModel` / `dispose`，`MmdCanvas.tsx` 的 `StudioScene` cleanup。
- 剩余验证：浏览器中覆盖加载中关闭窗口、切换后端和 WebGPU 动态导入失败。

#### 2. 后端切换失败不能恢复原场景（已修复，待 GPU 回归）

- renderer API 现在携带 backend 身份；切换流程等待指定 backend 的新 API，并用同步 ref 排除并发事务。
- WebGPU 初始化或场景恢复失败时会重挂 WebGL 并恢复切换前快照；项目加载也统一通过可等待的 `ensureBackend`，不再向旧 runtime hydrate。
- 位置：`MmdStudioApp.tsx#handleBackendChange`、`useMmdProjectController.ts` 的项目 hydrate、`MmdCanvas.tsx` 的 backend key。
- 剩余验证：真实 WebGPU 设备上的 WebGL → WebGPU、初始化失败 fallback 和恢复中模型加载失败。

#### 3. 项目加载不是原子操作，失败后可能覆盖原工程（已修复，待浏览器回归）

- 加载流程先解析并校验全部被引用的模型、companion、motion、音频和 HDR 资产，再切换 renderer 或清空 scene。
- 进入 hydrate 前保存原 scene/settings/media 快照；后续失败会尽力恢复原 backend、scene、设置、音频和 HDR。
- 项目名和 `lastProjectId` 仅在 hydrate 与 media 应用成功后提交，因此失败加载不会把目标工程变成下一次保存目标。
- 位置：`useMmdProjectController.ts` 的 load flow、`mmdSceneHydrate.ts`、`mmdProjectDb.ts#saveProject`。
- 剩余验证：模型解析失败、motion 加载失败和 rollback 自身失败的浏览器集成测试。

#### 4. 工程包导出会丢失材质增强贴图（已修复）

- 工程包 v2 将 AO / emission / mask override 作为独立资产输出，metadata 保存 asset ID，导入后重建为真实 `File`。
- 导入仍接受 v1；旧包从未包含贴图字节，因此只能把历史 `{}` 占位清理为 `null`，无法恢复原文件。
- 位置：`mmdStudioStore.ts#MmdMaterialOverride`、`mmdProjectIO.ts`、`mmdSceneHydrate.ts`、`mmdRuntimeMaterials.ts`。
- 回归覆盖：v2 贴图导出、导入后 `File` 重建和 v1 占位清理。

#### 5. 导出中关闭窗口会丢结果并遗留 busy 状态（部分修复）

- Canvas cleanup 现在停止全部 capture tracks，并断开/关闭音频 graph；controller unmount 会复位录制、离线导出、进度、播放、网格、速度和录制尺寸。
- 重新打开 Studio 不应再继承 busy 状态，但关闭窗口仍会取消进行中的结果，不支持后台完成或恢复。
- 位置：`useMmdRecordingController.ts` cleanup、`MmdCanvas.tsx` recorder cleanup、`shell/windowLifecycle.ts`。
- 剩余工作：若产品要求关闭窗口后保留结果，需要将导出任务提升到窗口外生命周期并提供完成通知。

### P1：资源泄漏、渲染恢复与导出正确性

#### 6. 模型移除没有释放材质纹理（已确认）

- `disposeModelObject` 释放 geometry 和 material，但 Three.js 的 `material.dispose()` 不会释放 material 引用的 texture。
- 重复移除模型、切后端和重建物理会累积 diffuse / sphere / toon / alpha 等 GPU 纹理。
- SkeletonHelper、手工 `GridHelper` 和 directional-light target 也存在不完整 cleanup。
- 位置：`mmdRuntimeEntry.ts#disposeModelObject`、`mmdRuntime.ts#dispose`、`MmdCanvas.tsx` helper/light effects。
- 修复方向：明确资源所有权；遍历并去重 model-owned textures；使用 loader 官方 disposal API（若提供）；为 primitive/helper 增加显式 dispose。

#### 7. WebGPU HDR 仍调用 WebGL PMREM 路径（已确认）

- `MmdSky` 无条件把当前 renderer cast 为 `WebGLRenderer`，HDR environment 路径随后调用 `THREE.PMREMGenerator`。
- WebGPU backend 下实际对象是 `WebGPURenderer`；HDR/EXR 环境可能异步报错，并留下部分应用的背景/环境状态。
- 位置：`MmdSky.tsx`、`mmdEnvMap.ts`、`MmdCanvas.tsx` WebGPU renderer factory。
- 修复方向：显式传 backend/capabilities；WebGPU 使用其支持的 environment 路径；自定义 CubeUV PMREM 只服务 WebGL material enhancement。

#### 8. PMREM 是进程全局单例，多 Studio 实例会互相干扰（已确认）

- `mmdPmremEnvMap.ts` 只有一个模块级 active texture 和 listener 集合。
- 任一 Studio window 改天空或卸载都会向全部订阅者 publish；renderer A 生成的 render-target texture 还可能交给 renderer B 使用。
- 位置：`mmdPmremEnvMap.ts`、`MmdSky.tsx`、`MmdCanvas.tsx` 的订阅逻辑。
- 修复方向：按 Canvas/runtime generation 隔离，通过 scene-local context/controller 传递；禁止跨 renderer 发布 render-target texture。

#### 9. 没有 WebGL context / WebGPU device loss 恢复（风险高）

- 当前没有 `webglcontextlost` / `webglcontextrestored` 处理，也没有监听 WebGPU `device.lost`。
- PostFX 的部分 catch 只避免当帧抛错，不会重建 renderer、composer、PMREM、TSL pipeline 或 runtime。
- GPU 丢失后 viewport 可能永久黑屏/冻结，而 store 仍显示 ready；应用也没有 MMD 专用 error boundary。
- 修复方向：建立 `initializing → ready → lost → recovering → failed` 状态机；快照后按新 generation 重建；WebGPU loss 自动尝试 WebGL；Canvas 外保留可保存工程和重试的错误 UI。

#### 10. WebGL 常驻 `preserveDrawingBuffer` 且空闲仍持续渲染（风险高）

- WebGL renderer 全程启用 `preserveDrawingBuffer: true`，但主要用途只是截图/录制读取。
- Canvas 使用 `frameloop="always"`；即使暂停播放，每帧仍遍历可见模型并同步动画、矩阵、材质和阴影。
- 这会持续增加显存带宽与 CPU/GPU 占用，在高 DPR、PostFX 和大型纹理包下明显降低 context-loss 余量。
- 位置：`MmdCanvas.tsx` renderer config / `useFrame`、`mmdRuntime.ts#update`。
- 修复方向：正常预览关闭 preserved buffer，截图走显式 render target；暂停时 demand render；仅播放、录制、物理 settling、控制器交互或动态效果时连续渲染。
- 经验参照（MMD VR 已实现「暂停 && 物理关时跳过 `runtime.update`」，见 `MmdVrStage.tsx`）：模型异步加载期间首帧会先把 `lastEvaluatedTimeRef` 置为当前时间，若加载完成后不补一次求值，`evaluationTime` 未变 → `update` 被永久跳过 → 骨骼从未求值、材质 enhance 从未初始化；修复是在加载完成回调里把 `lastEvaluatedTimeRef` 重置为 `-Infinity` 强制下一帧求值。若未来在 Studio 做 demand-render，必须采用同样的「加载完成后标记需求值」方案。且 Studio 暂停时 morph 权重与材质 override 依赖 `update` 内 `applyMorphOverrides`/材质同步实时生效，跳过整段会破坏侧栏即时预览；若要跳过，只能在 `mmdRuntime.update` 内按「时间未变 && 物理关」跳过 WASM 骨骼求值、保留 morph/材质/相机应用。

#### 11. 录制音频 graph 和 track 没有完整释放（已确认）

- 正常停止和 Canvas cleanup 只停止 video track；AudioContext、source、destination 和 audio tracks 没有统一 disconnect/close。
- 后端重挂后再次对同一 `<audio>` 调用 `createMediaElementSource` 可能失败，当前 catch 会静默退化成无声视频。
- 位置：`MmdCanvas.tsx#startRecording` / `stopRecording` / cleanup。
- 修复方向：音频 graph 提升到 `MmdStudioApp` 生命周期并复用；停止时释放本次拥有的全部 tracks；音频失败必须明确反馈。

#### 12. 实时导出可能提前结束，离线导出多一帧（已确认）

- realtime 以墙钟 timer 停止，但低于 20 FPS 时 timeline 的 delta 有上限，timeline 进度可能落后墙钟，最终视频被截短；recorder 还晚于 playback/audio 启动。
- offline video 和 PNG sequence 使用 `floor(duration / frameDuration) + 1`，精确 1 秒 30 FPS 会生成 31 个完整时长帧，视频比音频多约一帧。
- 位置：`useMmdRecordingController.ts`、`MmdCanvas.tsx` timeline update、`mmdWebCodecsExport.ts` frame loop。
- 修复方向：recorder 先启动再释放播放；以 timeline 到达出点为停止条件；统一半开区间 `[in, out)` 和 `ceil(duration * fps)`。

#### 13. 请求音频但编码失败时会静默产出无声视频（已确认）

- WebCodecs decode 和 MediaRecorder audio graph 的失败都被 catch 后当作 video-only 继续完成。
- 用户无法判断导出成功但没有音轨是浏览器限制、素材错误还是实现问题。
- 修复方向：导出结果返回 `audioIncluded` 与失败原因；用户要求音频时默认失败，或先明确确认降级。

### P2：工程规模、自动保存与文件语义

#### 14. Autosave 可在播放期间无限推迟，关闭时也不 flush（已确认）

- autosave 是 8 秒 trailing debounce，但依赖包含频繁变化的 `currentTime`；播放会持续重置 timer。
- cleanup 只清 timer，不保存；错误完全吞掉。部分导出设置也不在依赖列表中，单独修改不会触发 autosave。
- 位置：`useMmdProjectController.ts` autosave effect / `collectProjectSettings`。
- 修复方向：用明确 dirty revision 代替 transport time；debounce 之外设置最大保存间隔；串行保存；受控关闭前 flush；显示 quota/存储失败。

#### 15. Companion 资产会按模型重复存储（已确认）

- fallback grouping 可能把完整文件包作为每个模型的 companion，并包含模型本身。
- 保存时 primary model 写一次，companion 再写一次；多模型会重复 PMX/PMD、VMD、音频、HDR 和纹理，工程包导出还会将重复数据全部 base64 化。
- 位置：`folderImport.ts#companionsForModel`、`MmdStudioApp.tsx` ingest、`mmdProjectDb.ts`、`mmdProjectIO.ts`。
- 修复方向：资产按 relative path + content identity 去重；model record 引用共享资产；排除 primary model 和无关 motion/audio/sky。

#### 16. 多模型导入时动作归属不明确（已确认）

- 多 PMX 导入会先打开模型选择器，但识别出的 body/face/camera motion 随即应用给当前 runtime selection。
- 空场景会报“未选择模型”并中断后续媒体导入；已有场景则可能错误修改旧模型。
- camera motion 又按 runtime 中第一个可见且有 camera track 的模型生效，缺少项目级 owner 语义。
- 位置：`MmdStudioApp.tsx#ingestFiles`、`mmdRuntime.ts` motion/camera update。
- 修复方向：动作暂存到模型导入完成后；提供逐模型映射；camera motion 改为项目级资产或持久化明确 owner。

#### 17. 工程包和离线编码是无上限的纯内存流程（风险高）

- package export 同时持有 ArrayBuffer、base64、JSON 和 Blob；import 也会同时保留文本、base64、typed array 与 File。
- offline 编码使用内存 `BufferTarget`，4K/长视频和大型模型包可能直接耗尽标签页内存。
- 修复方向：改二进制流式 archive；避免 base64；预估内存并设置资产/工程/帧数上限；支持文件流输出时优先使用。

#### 18. Downloads 中的导出链接会过期（已确认）

- Studio 把 object URL 写入 Downloads history，但约 60 秒后主动 revoke，或下一次导出时提前 revoke。
- Downloads 仍显示可再次保存，实际链接已失效。
- 位置：`useMmdRecordingController.ts`、`mmdProjectIO.ts`、`DownloadsApp.tsx`。
- 修复方向：由 download store 独占 URL 生命周期；删除/淘汰记录时再 revoke，或持久化 Blob 并按需生成新 URL。

#### 19. “项目文件夹”实际是虚拟目录，不是系统目录（产品限制）

- 当前只保存 NekoVirtOS 虚拟文件系统中的 catalog pointer；二进制仍在 MMD Dexie DB。
- 没有 `FileSystemDirectoryHandle`、权限查询或重新授权；`webkitdirectory`/drop API 不支持时相对路径会退化。
- 需要在 UI 明确标注“虚拟项目目录”，避免用户误以为工程已写入设备文件夹。

## 测试与验收缺口

当前 Studio 自动测试只有 3 个文件、11 个纯逻辑测试：

- `mmdEnvMap.test.ts`：PMREM 尺寸计算
- `mmdLayoutPrefs.test.ts`：布局约束与 localStorage round-trip
- `mmdSsrEffect.test.ts`：SSR 强度/画质规则

测试环境是 Node，不覆盖真实浏览器、renderer 或 GPU。下列关键路径目前没有自动化验收：

1. WebGL/WebGPU 切换、失败 fallback、项目指定 backend 的恢复。
2. runtime 并发加载、取消、卸载、纹理和 Bullet world 释放。
3. IndexedDB 保存/加载/删除、缺失资产、损坏包和 package round-trip。
4. autosave debounce/最大间隔/关闭 flush/存储失败。
5. MediaRecorder/WebCodecs 的帧边界、音频、取消和 cleanup。
6. 多模型 companion 去重、动作归属和 camera owner。
7. WebGL context loss、WebGPU device loss、error boundary 恢复。
8. 大型项目、4K 导出、移动端内存与长时间稳定性。

“当前能力”中的“已有”仅表示实现代码存在，不表示已经通过以上浏览器/GPU 验收。

## 推荐偿还顺序

1. **统一 renderer generation 事务**：取消 pending load、唯一 backend switch、项目原子 hydrate、loss recovery。
2. **保证工程数据完整**：增强贴图资产化、加载前完整校验、失败 rollback、autosave flush。
3. **补齐资源所有权**：模型纹理、helper、PMREM、audio graph、export cleanup。
4. **修复导出时间语义**：统一 clock、半开帧区间、音频失败显式化。
5. **降低常驻成本**：demand rendering、关闭常驻 preserved buffer、工程资产去重和流式导出。
6. **建立浏览器集成测试**：先覆盖项目 round-trip、后端失败恢复、导出取消和 runtime stale completion。

## 相关文档

- [VR 桌面](./vr-desktop-roadmap.md)  
- [设置](./settings-roadmap.md)  
