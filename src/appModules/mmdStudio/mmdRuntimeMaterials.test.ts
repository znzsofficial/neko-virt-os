import { describe, expect, it } from "vitest";
import type { ThreeMmdModel } from "@yohawing/three-mmd-loader";
import * as THREE from "three";
import {
  applyMaterialOverride,
  createDefaultMaterialOverrides,
  type MaterialPipelineEntry,
} from "./mmdRuntimeMaterials";

describe("applyMaterialOverride", () => {
  it("updates only materials with the selected name", () => {
    const selected = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
    const untouched = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 });
    selected.userData.mmdWebGpuStripped = true;
    untouched.userData.mmdWebGpuStripped = true;
    const materialOverrides = createDefaultMaterialOverrides(["Selected", "Untouched"]);
    materialOverrides.Selected = {
      ...materialOverrides.Selected,
      roughness: 0.25,
      metallic: 0.7,
      envInfluence: 0.5,
    };
    const entry: MaterialPipelineEntry = {
      id: "model-1",
      model: { mesh: { material: [selected, untouched] } } as unknown as ThreeMmdModel,
      materialNames: ["Selected", "Untouched"],
      materialVisible: {},
      materialOverrides,
      visible: true,
    };

    applyMaterialOverride(entry, "Selected", { envIntensity: 2 });

    expect(selected.roughness).toBe(0.25);
    expect(selected.metalness).toBe(0.7);
    expect(selected.envMapIntensity).toBe(1);
    expect(untouched.roughness).toBe(0.6);
    expect(untouched.metalness).toBe(0);
  });

  it("updates the selected classic MMD shader uniform", () => {
    const selected = new THREE.MeshToonMaterial();
    const untouched = new THREE.MeshToonMaterial();
    const selectedEmission = { value: 0 };
    const untouchedEmission = { value: 0 };
    selected.userData.mmdEnhanceShader = { uniforms: { mmdEnhanceEmission: selectedEmission } };
    untouched.userData.mmdEnhanceShader = { uniforms: { mmdEnhanceEmission: untouchedEmission } };
    const materialOverrides = createDefaultMaterialOverrides(["Selected", "Untouched"]);
    materialOverrides.Selected = { ...materialOverrides.Selected, emission: 1.5 };
    const entry: MaterialPipelineEntry = {
      id: "model-1",
      model: { mesh: { material: [selected, untouched] } } as unknown as ThreeMmdModel,
      materialNames: ["Selected", "Untouched"],
      materialVisible: {},
      materialOverrides,
      visible: true,
    };

    applyMaterialOverride(entry, "Selected", {});

    expect(selectedEmission.value).toBe(1.5);
    expect(untouchedEmission.value).toBe(0);
  });

  it("replays an override when the classic shader compiles later", () => {
    const selected = new THREE.MeshToonMaterial();
    const materialOverrides = createDefaultMaterialOverrides(["Selected"]);
    materialOverrides.Selected = { ...materialOverrides.Selected, emission: 1.25 };
    const entry: MaterialPipelineEntry = {
      id: "model-1",
      model: { mesh: { material: selected } } as unknown as ThreeMmdModel,
      materialNames: ["Selected"],
      materialVisible: {},
      materialOverrides,
      visible: true,
    };

    applyMaterialOverride(entry, "Selected", {});
    const shader = {
      uniforms: {},
      vertexShader: "",
      fragmentShader: "#include <map_pars_fragment>",
    };
    selected.onBeforeCompile(
      shader as unknown as THREE.WebGLProgramParametersWithUniforms,
      {} as THREE.WebGLRenderer,
    );

    expect(shader.uniforms).toMatchObject({ mmdEnhanceEmission: { value: 1.25 } });
  });
});
