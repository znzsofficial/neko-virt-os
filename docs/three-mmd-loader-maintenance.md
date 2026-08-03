# three-mmd-loader 近期维护记录

最后更新：2026-08-03

文档索引：[docs/README.md](./README.md)

## 用途

本文记录 NekoVirtOS 对 `@yohawing/three-mmd-loader` 的近期排查、本地补丁、上游提交和后续维护步骤。更新依赖、处理上游 review 或移除 pnpm patch 前，应先查阅本文。

## 仓库与依赖

| 项目 | 位置 / 地址 | 包管理器 | 说明 |
|------|-------------|----------|------|
| NekoVirtOS | `E:\WebProjects\neko-virt-os` | pnpm | 使用 loader、保存临时正式补丁和项目集成代码 |
| loader 本地 clone | `E:\WebProjects\three-mmd-loader` | npm | 上游贡献、测试和 review 修改 |
| upstream | <https://github.com/yohawing/three-mmd-loader> | npm | 默认分支 `main` |
| fork | <https://github.com/znzsofficial/three-mmd-loader> | npm | remote 名为 `fork` |

当前 NekoVirtOS 依赖：

- `@yohawing/three-mmd-loader@0.8.1`
- `mmd-anim WASM 0.3.3`
- Bullet 运行资产：`public/mmd/0.8.1/mmd_bullet.js`、`public/mmd/0.8.1/mmd_bullet.wasm`；版本化目录保证 ABI 配套的 JS/WASM 同步更新
- pnpm patch：`patches/@yohawing__three-mmd-loader@0.8.1.patch`
- `pnpm-workspace.yaml` 中的 `patchedDependencies` 负责应用补丁
- 当前 lockfile patch hash：`4ae21dfc73e3a1817a9bc8cc487f8c1d9c36b4da9c86a64af4d8dae37457cfce`

上游仓库提交了 `package-lock.json`，其开发文档和 CI 均使用 npm。不要在 `E:\WebProjects\three-mmd-loader` 中使用 pnpm 更新依赖或 lockfile。NekoVirtOS 仍使用 pnpm。

## 已解决问题

### 1. dynamicWithBone 缩放漂移

#### 表现

- 开启物理后缩小模型，衣服等物理骨骼向模型原始高度漂移。
- 本地测试模型为 `sample/默认/诺诺.pmx`，此前多个模型均可复现。`sample/` 已被 Git 忽略，模型许可禁止二次分发，不得提交到仓库。

#### 根因

`MmdAnimBulletPhysicsBackend` 将所有非静态刚体的 Bullet 平移和旋转统一写回骨骼。MMD 的 `dynamicWithBone`（physics-with-bone）语义应保留动画骨骼的局部平移，只反馈物理旋转。

旧 Ammo backend 已遵循该语义；新的 mmd-anim backend 对 `dynamic` 和 `dynamicWithBone` 未作区分。模型缩放后，错误的世界平移反馈尤其明显。

#### 修复语义

| 刚体模式 | 平移来源 | 旋转来源 | `updatedBoneIndices` |
|----------|----------|----------|----------------------|
| `dynamic` | Bullet | Bullet | 写入 |
| `dynamicWithBone` | 动画输入 | Bullet | 写入 |

保留了 0.8.1 的 solver ownership 和前向步进逻辑。没有在 physics step 中整体缩放刚体 world，也没有取消现有 root unit-scale 处理。

#### 上游记录

- Issue [#37](https://github.com/yohawing/three-mmd-loader/issues/37)
- PR [#38](https://github.com/yohawing/three-mmd-loader/pull/38)
- 分支：`fix/dynamic-with-bone-translation`
- Commit：`20e16942c6e5301599500183cc5a967cbbd3b5e3`
- Commit 标题：`fix(physics): preserve dynamic-with-bone translation`

截至 2026-08-03：PR 为 `OPEN`、`MERGEABLE`，无 review、评论或 change request，GitHub 未显示 checks。

### 2. Bullet contact 查询未接通

#### 表现

- 原生 Bullet 已提供 contact 数据，但 TypeScript backend 没有暴露查询方法。
- viewer 已尝试调用 `debugContactCount()` / `debugPhysicsContacts()`，compatibility backend 未实现转发，因此运行时始终无法取得接触。
- NekoVirtOS 控制器 collider 可以参与物理，但无法据此触发触觉反馈。

#### 根因

原生导出 `_mmd_anim_bullet_world_collect_contacts` 已存在，缺失的是 TypeScript mmd-anim backend 的 ABI 解码和 `CustomBulletMmdCompatibilityBackend` 的方法转发。

原生 `mmd_anim_bullet_contact_point` 每条为 48 bytes：

| 偏移内容 | 类型 |
|----------|------|
| `rigidbody_index_a` | `int32` |
| `rigidbody_index_b` | `int32` |
| `distance` | `float` |
| `position_world_on_a[3]` | `float[3]` |
| `position_world_on_b[3]` | `float[3]` |
| `normal_world_on_b[3]` | `float[3]` |

#### 修复语义

- `debugContactCount()` 使用 count-only native query，不创建 contact 列表。
- `debugPhysicsContacts()` 解码完整 48-byte ABI。
- contact buffer 仅在详细查询时延迟分配，后续查询复用，backend dispose 时释放。
- native module 缺少可选导出或 backend 已 dispose 时，安全返回 `0` / `[]`。
- stable Custom Bullet compatibility backend 转发两个方法。
- 不需要修改或重建原生 WASM。

#### 上游记录

- Issue [#39](https://github.com/yohawing/three-mmd-loader/issues/39)
- PR [#40](https://github.com/yohawing/three-mmd-loader/pull/40)
- 分支：`fix/bullet-contact-debug-api`
- Commit：`60e99d72e46c08004dc98acac8648a48f3ee4442`
- Commit 标题：`feat(physics): expose Bullet contact queries`

截至 2026-08-03：PR 为 `OPEN`、`MERGEABLE`，无 review、评论或 change request，GitHub 未显示 checks。

## NekoVirtOS 集成修改

以下改动服务于本项目，不应混入上述 loader PR：

| 修改 | 位置 | 说明 |
|------|------|------|
| Controller collider wrapper | `src/appModules/mmdStudio/mmdPhysics.ts` | 向物理 context 追加控制器刚体，读取 contact 并区分左右控制器 |
| Contact / backend 回归测试 | `src/appModules/mmdStudio/mmdPhysics.test.ts` | 覆盖 direct buffers、contact forwarding、contact 上限和 patched backend 行为 |
| VR 触觉状态 | `src/mmdVrShowcase/mmdVrHaptics.ts` | 管理左右手接触、震动强度和 gate |
| 触觉执行 | `src/mmdVrShowcase/components/MmdVrControllerColliders.tsx` | 驱动 WebXR haptic actuator |
| VR contact 采样 | `src/mmdVrShowcase/components/MmdVrStage.tsx` | 从物理 backend 采样 controller contact |
| Unit-scale physics step | `src/appModules/mmdStudio/mmdRuntime.ts`、`mmdRuntimeEntry.ts` | 模型显示缩放与 PMX 原尺寸物理 world 的集成处理 |

### 受控的物理重建

模型 transform 后调用 `rebuildPhysics()` 会销毁全部模型并异步重载，期间模型和面板消失，因此 transform 路径不再重建，而是对位置、旋转和复位执行非破坏性 `resetPhysics()` reseed。

`MmdRuntimeHandle.rebuildPhysics()` 仅用于切换“衣物互撞”这类刚体创建时配置。重建期间 UI 保持 busy，并保存模型变换、动作、morph 权重与收藏、材质可见性和材质覆盖；失败时尝试按旧配置恢复。

该问题属于 NekoVirtOS runtime 生命周期，不是 loader 上游问题。

### 已撤回的方案

曾考虑在 physics step 时取消 root scale 强制为 `1`，但刚体形状和关节仍是 PMX 原尺寸，整体传入缩放会产生新的尺寸不一致。该方案未经验证且已撤回，当前不缩放整个 physics context。

## 真机确认

用户已在设备上确认：

- 控制器碰撞后有震动。
- 开启物理后可以调整模型大小，模型和面板不会消失。
- 缩小模型后衣服不再向上漂。
- 当前模型缩放、物理和触觉行为正常。

## 已执行验证

### NekoVirtOS

```bash
pnpm install --frozen-lockfile
pnpm exec tsc -b --pretty false
pnpm test -- src/appModules/mmdStudio/mmdPhysics.test.ts src/mmdVrShowcase/mmdVrHaptics.test.ts src/mmdVrShowcase/mmdVrStore.test.ts src/appModules/mmdStudio/mmdRuntime.test.ts
pnpm build
git diff --check
```

验证结果：4 个指定测试文件、30 项测试通过；TypeScript 和生产构建通过。`git diff --check` 仅有 Windows CRLF 提示。

### loader PR #38

```bash
npm ci
npm run lint
npm run build
npm test
npm run check:fixtures
npm run smoke:dist
```

结果：82 个测试文件，761 项通过，5 项跳过；5 个 fixture 通过。

### loader PR #40

```bash
npm run lint
npm run build
npm test
npm run check:fixtures
npm run smoke:dist
```

结果：82 个测试文件，762 项通过，5 项跳过；5 个 fixture 通过。

`npm run smoke:types` 在本机 Windows + Node.js 26.5.0 下会因上游脚本使用 `spawnSync("npm")` 而找不到 `npm.cmd`。这是脚本的 Windows 调用限制；TypeScript build 和 declarations 已通过，上游 Linux Node.js 22/24 CI 应执行该 smoke test。

## 后续操作

### 查询 PR 状态

在 `E:\WebProjects\three-mmd-loader` 中运行：

```bash
gh pr view 38 --repo yohawing/three-mmd-loader
gh pr view 40 --repo yohawing/three-mmd-loader
gh pr checks 38 --repo yohawing/three-mmd-loader
gh pr checks 40 --repo yohawing/three-mmd-loader
```

如维护者要求修改，切换对应分支，修改、验证、创建新 commit 后正常 push。不要 amend 已推送 commit，除非用户明确要求。

### 同步上游

```bash
git fetch upstream
git switch main
git merge --ff-only upstream/main
git push fork main
```

贡献分支有 review 修改时，先确认 upstream 是否已前进，再按上游偏好 rebase 或 merge。不要 force-push，除非明确获得批准。

### 上游合并但尚未发布

- 保留 NekoVirtOS pnpm patch。
- 不要仅因 PR merged 就把依赖指向任意 Git commit。
- 等待包含两个修复的正式 npm 版本，除非有明确需求提前使用 commit/预发布版本。

### 新版本发布后

1. 确认 release/npm 包同时包含 PR #38 和 PR #40。
2. 在独立分支更新 `@yohawing/three-mmd-loader` 版本。
3. 检查新版本是否仍需要 patch 中的其他内容。
4. 仅当发布包已覆盖全部 patch 行为时，删除 `patchedDependencies` 条目和 patch 文件。
5. 运行 `pnpm install` 更新 lockfile，确认旧 patch hash 消失。
6. 重跑 TypeScript、指定物理/触觉测试、完整测试和 build。
7. 再次进行真机回归：模型缩放、衣服物理、面板存续、左右控制器碰撞和震动。

不要直接删除整个 patch。当前 patch 同时包含 `dynamicWithBone` 和 contact API 两部分；如果上游只合并或发布其中一个，应重新生成只保留未发布修复的最小 patch。

## 本地分支保留策略

当前 loader clone 中应保留：

- `fix/dynamic-with-bone-translation`，跟踪 `fork/fix/dynamic-with-bone-translation`
- `fix/bullet-contact-debug-api`，跟踪 `fork/fix/bullet-contact-debug-api`

PR 合并且 NekoVirtOS 已升级到包含修复的正式版本后，才考虑删除本地和 fork 分支。删除前确认没有待处理 review、未发布 commit 或回归修复。

## 非阻塞提示

- Windows checkout 可能显示 LF/CRLF 转换警告。
- NekoVirtOS build 可能提示 loader parser 的 `node:fs/promises`、`node:url` 被 Vite externalized。
- 部分 bundle chunk 超过 500 kB。
- 上述提示与本次物理/contact 修复无直接关系。
