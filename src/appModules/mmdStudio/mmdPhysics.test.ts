import { describe, expect, it, vi } from "vitest";
import type {
  MmdDirectBufferPhysicsBackend,
  MmdPhysicsBackend,
  MmdPhysicsStepBufferLayout,
  MmdPhysicsStepBuffers,
  MmdPhysicsStepContext,
} from "@yohawing/three-mmd-loader/physics";
import { createControllerColliderPhysicsBackend } from "./mmdPhysics";

describe("controller collider physics backend", () => {
  it("appends controller bodies and only returns original bone output", () => {
    let augmentedRigidBodies: MmdPhysicsStepContext["rigidBodies"];
    const step = vi.fn((context: MmdPhysicsStepContext) => {
      expect(context.skeleton?.bones).toHaveLength(3);
      expect(context.rigidBodies).toHaveLength(3);
      expect(context.rigidBodies?.[1]).toMatchObject({ motionType: "static", boneIndex: 1 });
      expect(context.rigidBodies?.[0]).toMatchObject({ collisionMask: 0xffff });
      expect(context.rigidBodies?.[1]).toMatchObject({ collisionGroup: 15 });
      expect(context.inputWorldMatricesColumnMajor).toHaveLength(48);
      if (augmentedRigidBodies) expect(context.rigidBodies).toBe(augmentedRigidBodies);
      augmentedRigidBodies = context.rigidBodies;
      const output = context.output!;
      output.translations![0] = 7;
      (output.updatedBoneIndices as number[]).push(0, 1, 2);
      return { simulated: true, updatedBoneCount: 3 };
    });
    const base = {
      name: "fake",
      disabled: false,
      disposed: false,
      step,
    } satisfies MmdPhysicsBackend;
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] as const;
    const backend = createControllerColliderPhysicsBackend(base, () => [identity, identity]);
    const outputTranslations = new Float32Array(3);
    const updatedBoneIndices: number[] = [];

    const context: MmdPhysicsStepContext = {
      seconds: 1,
      deltaSeconds: 1 / 60,
      frame: 30,
      frameRate: 30,
      skeleton: { bones: [{ index: 0 }] },
      rigidBodies: [{ index: 0, boneIndex: 0, motionType: "dynamic", shape: { type: "sphere", size: [1, 1, 1] } }],
      joints: [],
      inputTranslations: new Float32Array(3),
      inputRotations: new Float32Array([0, 0, 0, 1]),
      inputWorldMatricesColumnMajor: new Float32Array(identity),
      output: {
        translations: outputTranslations,
        rotations: new Float32Array(4),
        worldMatricesColumnMajor: new Float32Array(16),
        updatedBoneIndices,
      },
      bonePhysicsToggles: new Uint8Array([1]),
    };
    const result = backend.step(context);
    backend.step(context);

    expect(outputTranslations[0]).toBe(7);
    expect(updatedBoneIndices).toEqual([0]);
    expect(result.updatedBoneCount).toBe(1);
  });

  it("preserves direct buffers and fills controller slots in place", () => {
    let buffers: MmdPhysicsStepBuffers | undefined;
    const acquireStepBuffers = vi.fn((layout: MmdPhysicsStepBufferLayout) => {
      buffers = {
        inputTranslations: new Float32Array(layout.translationValueCount),
        inputRotations: new Float32Array(layout.rotationValueCount),
        inputWorldMatricesColumnMajor: new Float32Array(layout.worldMatrixValueCount),
        outputTranslations: new Float32Array(layout.translationValueCount),
        outputRotations: new Float32Array(layout.rotationValueCount),
        outputWorldMatricesColumnMajor: new Float32Array(layout.worldMatrixValueCount),
        bonePhysicsToggles: new Uint8Array(layout.boneCount),
        updatedBoneIndices: new Uint32Array(layout.boneCount),
      };
      return buffers;
    });
    const step = vi.fn((context: MmdPhysicsStepContext) => {
      expect(context.inputWorldMatricesColumnMajor).toBe(buffers?.inputWorldMatricesColumnMajor);
      expect(context.inputWorldMatricesColumnMajor?.slice(16, 32)).toEqual(Float32Array.from(controller));
      expect(context.bonePhysicsToggles?.[1]).toBe(1);
      const indices = context.output?.updatedBoneIndices as Uint32Array;
      indices[0] = 0;
      indices[1] = 1;
      return { simulated: true, updatedBoneCount: 2 };
    });
    const base = {
      name: "direct",
      disabled: false,
      disposed: false,
      acquireStepBuffers,
      step,
    } satisfies MmdDirectBufferPhysicsBackend;
    const controller = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 3, 4, 1] as const;
    const backend = createControllerColliderPhysicsBackend(base, () => [controller]) as MmdDirectBufferPhysicsBackend;
    const direct = backend.acquireStepBuffers({
      boneCount: 1,
      translationValueCount: 3,
      rotationValueCount: 4,
      worldMatrixValueCount: 16,
    })!;
    expect(acquireStepBuffers).toHaveBeenCalledWith({
      boneCount: 2,
      translationValueCount: 6,
      rotationValueCount: 8,
      worldMatrixValueCount: 32,
    });

    const result = backend.step({
      seconds: 1,
      deltaSeconds: 1 / 60,
      frame: 30,
      frameRate: 30,
      skeleton: { bones: [{ index: 0 }] },
      rigidBodies: [],
      joints: [],
      inputTranslations: direct.inputTranslations,
      inputRotations: direct.inputRotations,
      inputWorldMatricesColumnMajor: direct.inputWorldMatricesColumnMajor,
      output: {
        translations: direct.outputTranslations,
        rotations: direct.outputRotations,
        worldMatricesColumnMajor: direct.outputWorldMatricesColumnMajor,
        updatedBoneIndices: direct.updatedBoneIndices,
      },
      bonePhysicsToggles: direct.bonePhysicsToggles,
    });

    expect(result.updatedBoneCount).toBe(1);
    expect(direct.updatedBoneIndices?.[0]).toBe(0);
  });

  it("reports contacts involving appended controller rigid bodies", () => {
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] as const;
    const base = {
      name: "debug",
      disabled: false,
      disposed: false,
      step: () => ({ simulated: true }),
      debugPhysicsContacts: () => [
        { rigidBodyIndexA: 0, rigidBodyIndexB: 1 },
        { rigidBodyIndexA: 1, rigidBodyIndexB: 2 },
        { rigidBodyIndexA: 3, rigidBodyIndexB: 0 },
      ],
    } satisfies MmdPhysicsBackend & {
      debugPhysicsContacts: () => { rigidBodyIndexA: number; rigidBodyIndexB: number }[];
    };
    const backend = createControllerColliderPhysicsBackend(base, () => [identity]);
    backend.step({
      seconds: 1,
      deltaSeconds: 1 / 60,
      frame: 30,
      frameRate: 30,
      skeleton: { bones: [{ index: 0 }, { index: 1 }] },
      rigidBodies: [
        { index: 0, motionType: "dynamic", shape: { type: "sphere", size: [1, 1, 1] } },
        { index: 1, motionType: "dynamic", shape: { type: "sphere", size: [1, 1, 1] } },
      ],
      joints: [],
    });

    expect(backend.debugControllerContactCount()).toBe(2);
    expect(backend.debugControllerContactCount(0)).toBe(1);
    expect(backend.debugRigidBodyCount()).toBe(2);
    expect(backend.debugDynamicRigidBodyCount()).toBe(2);
    expect(backend.debugStepCount()).toBe(1);
  });

  it("does not materialize an excessive contact list for HUD diagnostics", () => {
    const debugPhysicsContacts = vi.fn(() => []);
    const base = {
      name: "debug-overflow",
      disabled: false,
      disposed: false,
      step: () => ({ simulated: true }),
      debugContactCount: () => 257,
      debugPhysicsContacts,
    } satisfies MmdPhysicsBackend & {
      debugContactCount: () => number;
      debugPhysicsContacts: () => { rigidBodyIndexA: number; rigidBodyIndexB: number }[];
    };
    const backend = createControllerColliderPhysicsBackend(base, () => []);

    expect(backend.debugControllerContactCount()).toBe(0);
    expect(debugPhysicsContacts).not.toHaveBeenCalled();
  });
});
