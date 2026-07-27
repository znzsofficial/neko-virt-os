import { describe, expect, it, vi } from "vitest";
import type { ThreeMmdModel } from "@yohawing/three-mmd-loader";
import * as THREE from "three";
import { disposeLoadedModelObject } from "./mmdRuntimeEntry";

describe("disposeLoadedModelObject", () => {
  it("releases loader-owned runtime and GPU resources", () => {
    const geometry = new THREE.BufferGeometry();
    const texture = new THREE.Texture();
    texture.userData.mmdTextureOwnership = "loader";
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const bone = new THREE.Bone();
    const skeleton = new THREE.Skeleton([bone]);
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.add(bone);
    mesh.bind(skeleton);
    const root = new THREE.Group();
    root.add(mesh);
    const parent = new THREE.Group();
    parent.add(root);
    const runtime = { dispose: vi.fn() };
    const geometryDispose = vi.spyOn(geometry, "dispose");
    const materialDispose = vi.spyOn(material, "dispose");
    const textureDispose = vi.spyOn(texture, "dispose");
    const skeletonDispose = vi.spyOn(skeleton, "dispose");
    const model = {
      root,
      mesh,
      runtime,
      outlineMeshes: [],
      renderOrderMeshes: [],
    } as unknown as ThreeMmdModel;

    disposeLoadedModelObject(model);

    expect(root.parent).toBeNull();
    expect(runtime.dispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
    expect(skeletonDispose).toHaveBeenCalledOnce();
  });
});
