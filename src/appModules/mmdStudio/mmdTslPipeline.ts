/**
 * Thin wrapper around @yohawing/three-mmd-loader/webgpu experimental TSL facade.
 * Keeps dynamic import so WebGL-only builds do not pull three/webgpu until needed.
 */

import type { Object3D, SkinnedMesh, WebGPURenderer } from "three/webgpu";

export type MmdTslPipelineModel = {
  readonly root: Object3D;
  readonly mesh: SkinnedMesh;
};

export type MmdTslPipeline = {
  readonly renderer: WebGPURenderer;
  readonly light: import("three").DirectionalLight | undefined;
  createModelLoadOptions: (overrides?: Record<string, unknown>) => Record<string, unknown>;
  attach: (
    model: MmdTslPipelineModel,
    options?: {
      light?: import("three").DirectionalLight;
      sparseMorphs?: boolean;
      selfShadowEnabled?: boolean;
      selfShadow?: boolean;
    },
  ) => boolean;
  detach: (model: MmdTslPipelineModel) => boolean;
  prepareRender: (scene: import("three").Scene) => boolean;
  render: (scene: import("three").Scene, camera: import("three").Camera) => boolean;
  setSelfShadowEnabled: (enabled: boolean) => boolean;
  dispose: () => void;
};

export async function createStudioMmdTslPipeline(
  renderer: unknown,
  options: {
    light?: import("three").DirectionalLight;
    selfShadowEnabled?: boolean;
  } = {},
): Promise<MmdTslPipeline> {
  const { createMmdTslPipeline } = await import("@yohawing/three-mmd-loader/webgpu");
  // Studio policy: ground-only classic shadows on WebGL; WebGPU TSL self-shadow off by default.
  return createMmdTslPipeline(renderer as WebGPURenderer, {
    light: options.light,
    selfShadowEnabled: options.selfShadowEnabled === true,
    appendOutlineGroups: true,
  }) as Promise<MmdTslPipeline>;
}

export async function getTslModelLoadOptions(overrides?: Record<string, unknown>) {
  const { createModelLoadOptions } = await import("@yohawing/three-mmd-loader/webgpu");
  return createModelLoadOptions(overrides ?? {});
}
