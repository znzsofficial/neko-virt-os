import { describe, expect, it, vi } from "vitest";
import type {
  MmdDirectBufferPhysicsBackend,
  MmdPhysicsBackend,
  MmdPhysicsStepBufferLayout,
  MmdPhysicsStepBuffers,
  MmdPhysicsStepContext,
} from "@yohawing/three-mmd-loader/physics";
import { createCustomBulletMmdPhysicsBackend } from "@yohawing/three-mmd-loader/physics";
import { createControllerColliderPhysicsBackend, createDynamicSelfCollisionPhysicsBackend, createPhysicsDiagnosticsBackend } from "./mmdPhysics";

describe("dynamic rigid-body self-collision backend", () => {
  it("adds each dynamic body's own group to its collision mask", () => {
    let passedContext: MmdPhysicsStepContext | undefined;
    const step = vi.fn((context: MmdPhysicsStepContext) => {
      passedContext = context;
      return { simulated: true };
    });
    const base = { name: "fake", disabled: false, disposed: false, step } satisfies MmdPhysicsBackend;
    const backend = createDynamicSelfCollisionPhysicsBackend(base);
    const rigidBodies: NonNullable<MmdPhysicsStepContext["rigidBodies"]> = [
      { index: 0, motionType: "static", collisionGroup: 2, collisionMask: 0, shape: { type: "sphere", size: [1, 1, 1] } },
      { index: 1, motionType: "dynamic", collisionGroup: 3, collisionMask: 0xff97, shape: { type: "box", size: [1, 1, 1] } },
      { index: 2, motionType: "dynamicWithBone", collisionGroup: 0, collisionMask: 0xfffe, shape: { type: "capsule", size: [1, 1, 1] } },
    ];

    backend.step({ seconds: 0, deltaSeconds: 0, frame: 0, frameRate: 30, rigidBodies, joints: [] });

    const passed = passedContext!.rigidBodies!;
    expect(passed[0]).toBe(rigidBodies[0]);
    expect(passed[1].collisionMask).toBe(0xff9f);
    expect(passed[2].collisionMask).toBe(0xffff);
    expect(rigidBodies[1].collisionMask).toBe(0xff97);
  });
});

describe("physics diagnostics backend", () => {
  it("counts the exact rigid-body context forwarded to Bullet", () => {
    const base = {
      name: "fake-bullet",
      disabled: false,
      disposed: false,
      step: () => ({ simulated: true }),
    } satisfies MmdPhysicsBackend;
    const backend = createPhysicsDiagnosticsBackend(base);

    backend.step({
      seconds: 1,
      deltaSeconds: 1 / 60,
      frame: 30,
      frameRate: 30,
      rigidBodies: [
        { index: 0, motionType: "dynamic", shape: { type: "sphere", size: [1, 1, 1] } },
        { index: 1, motionType: "static", shape: { type: "sphere", size: [1, 1, 1] } },
      ],
      joints: [],
    });

    expect(backend.debugRigidBodyCount()).toBe(2);
    expect(backend.debugDynamicRigidBodyCount()).toBe(1);
    expect(backend.debugStepCount()).toBe(1);
  });
});

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
      expect(context.inputWorldMatricesColumnMajor?.slice(16, 32)).toEqual(Float32Array.from(rigidController));
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
    const controller = [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 2, 3, 4, 1] as const;
    const rigidController = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 3, 4, 1] as const;
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

  it("does not alter model masks when every collision group is occupied", () => {
    let passedBodies: MmdPhysicsStepContext["rigidBodies"];
    const base = {
      name: "all-groups",
      disabled: false,
      disposed: false,
      step: (context: MmdPhysicsStepContext) => {
        passedBodies = context.rigidBodies;
        return { simulated: true };
      },
    } satisfies MmdPhysicsBackend;
    const backend = createControllerColliderPhysicsBackend(base, () => [
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    ]);
    const rigidBodies = Array.from({ length: 16 }, (_, collisionGroup) => ({
      index: collisionGroup,
      motionType: "dynamic" as const,
      collisionGroup,
      collisionMask: 0,
      shape: { type: "sphere" as const, size: [1, 1, 1] as const },
    }));

    backend.step({
      seconds: 1,
      deltaSeconds: 1 / 60,
      frame: 30,
      frameRate: 30,
      skeleton: { bones: rigidBodies.map((body) => ({ index: body.index })) },
      rigidBodies,
      joints: [],
    });

    expect(passedBodies?.slice(0, 16)).toEqual(rigidBodies);
    expect(passedBodies?.[16]).toMatchObject({ collisionMask: 0 });
  });

  it("removes scale from production controller matrices without changing translation", () => {
    let passedContext: MmdPhysicsStepContext | undefined;
    const base = {
      name: "controller-rigid-matrix",
      disabled: false,
      disposed: false,
      step: (context: MmdPhysicsStepContext) => {
        passedContext = context;
        return { simulated: true };
      },
    } satisfies MmdPhysicsBackend;
    const controller = [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 7, 8, 9, 1] as const;
    const backend = createControllerColliderPhysicsBackend(base, () => [controller]);

    backend.step({
      seconds: 1,
      deltaSeconds: 1 / 60,
      frame: 30,
      frameRate: 30,
      skeleton: { bones: [{ index: 0 }] },
      rigidBodies: [{ index: 0, boneIndex: 0, motionType: "dynamic", shape: { type: "sphere", size: [1, 1, 1] } }],
      joints: [],
      inputTranslations: new Float32Array(3),
      inputRotations: new Float32Array([0, 0, 0, 1]),
      inputWorldMatricesColumnMajor: new Float32Array(16),
      output: {
        translations: new Float32Array(3),
        rotations: new Float32Array(4),
        worldMatricesColumnMajor: new Float32Array(16),
        updatedBoneIndices: [],
      },
      bonePhysicsToggles: new Uint8Array([1]),
    });

    expect(passedContext?.inputWorldMatricesColumnMajor?.slice(16, 32)).toEqual(
      Float32Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 7, 8, 9, 1]),
    );
    expect(passedContext?.rigidBodies).toHaveLength(2);
    expect(passedContext?.rigidBodies?.[1]).toMatchObject({ motionType: "static", boneIndex: 1 });
  });

  it("moves a controller from its hidden position without resetting the model world", () => {
    const reset = vi.fn();
    const step = vi.fn(() => ({ simulated: true }));
    const matrix = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -1_000, 0, 1]);
    const backend = createControllerColliderPhysicsBackend({
      name: "teleport",
      disabled: false,
      disposed: false,
      reset,
      step,
    }, () => [matrix]);
    const context: MmdPhysicsStepContext = {
      seconds: 1,
      deltaSeconds: 1 / 60,
      frame: 30,
      frameRate: 30,
      skeleton: { bones: [{ index: 0 }] },
      rigidBodies: [{ index: 0, motionType: "dynamic", shape: { type: "sphere", size: [1, 1, 1] } }],
      joints: [],
    };

    backend.step(context);
    matrix[13] = 1;
    backend.step(context);
    matrix[12] = 0.1;
    backend.step(context);

    expect(reset).not.toHaveBeenCalled();
    expect(step).toHaveBeenCalledTimes(3);
  });

  it("reports contacts involving appended controller rigid bodies", () => {
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] as const;
    const base = {
      name: "debug",
      disabled: false,
      disposed: false,
      step: () => ({ simulated: true }),
      debugContactCount: () => 3,
      debugPhysicsContacts: () => [
        { rigidBodyIndexA: 0, rigidBodyIndexB: 1 },
        { rigidBodyIndexA: 1, rigidBodyIndexB: 2 },
        { rigidBodyIndexA: 3, rigidBodyIndexB: 0 },
      ],
    } satisfies MmdPhysicsBackend & {
      debugContactCount: () => number;
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
    expect(backend.debugRigidBodyCount()).toBe(3);
    expect(backend.debugDynamicRigidBodyCount()).toBe(2);
    expect(backend.debugStepCount()).toBe(1);
  });

  it("forwards contact counts from the wrapped Bullet backend", () => {
    const base = {
      name: "wrapped-debug",
      disabled: false,
      disposed: false,
      step: () => ({ simulated: true }),
      debugContactCount: () => 1,
      debugPhysicsContacts: () => [{ rigidBodyIndexA: 0, rigidBodyIndexB: 1 }],
    } satisfies MmdPhysicsBackend & {
      debugContactCount: () => number;
      debugPhysicsContacts: () => { rigidBodyIndexA: number; rigidBodyIndexB: number }[];
    };
    const backend = createControllerColliderPhysicsBackend(base, () => [
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    ]);

    backend.step({
      seconds: 1,
      deltaSeconds: 1 / 60,
      frame: 30,
      frameRate: 30,
      skeleton: { bones: [{ index: 0 }] },
      rigidBodies: [{ index: 0, motionType: "dynamic", shape: { type: "sphere", size: [1, 1, 1] } }],
      joints: [],
    });

    expect(backend.debugControllerContactCount(0)).toBe(1);
  });

  it("collects controller contacts without materializing an excessive world contact list", () => {
    const debugPhysicsContacts = vi.fn(() => []);
    const debugPhysicsContactsForRigidBodyRange = vi.fn(() => [
      { rigidBodyIndexA: 0, rigidBodyIndexB: 2 },
    ]);
    const base = {
      name: "debug-overflow",
      disabled: false,
      disposed: false,
      step: () => ({ simulated: true }),
      debugContactCount: () => 257,
      debugPhysicsContacts,
      debugPhysicsContactsForRigidBodyRange,
    } satisfies MmdPhysicsBackend & {
      debugContactCount: () => number;
      debugPhysicsContacts: () => { rigidBodyIndexA: number; rigidBodyIndexB: number }[];
      debugPhysicsContactsForRigidBodyRange: (firstRigidBodyIndex: number, rigidBodyCount: number) => { rigidBodyIndexA: number; rigidBodyIndexB: number }[];
    };
    const backend = createControllerColliderPhysicsBackend(base, () => [
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    ]);
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

    expect(backend.debugControllerContactCount()).toBe(1);
    expect(debugPhysicsContactsForRigidBodyRange).toHaveBeenCalledWith(2, 1);
    expect(debugPhysicsContacts).not.toHaveBeenCalled();
  });
});

describe("patched mmd-anim Bullet backend", () => {
  it("decodes the patched 48-byte Bullet contact ABI", () => {
    const memory = new ArrayBuffer(4_096);
    const heapF32 = new Float32Array(memory);
    const heapU8 = new Uint8Array(memory);
    const heapU32 = new Uint32Array(memory);
    let nextPointer = 256;
    const module = {
      HEAPF32: heapF32,
      HEAPU8: heapU8,
      HEAPU32: heapU32,
      _malloc: (bytes: number) => {
        const pointer = nextPointer;
        nextPointer += Math.ceil(bytes / 8) * 8;
        return pointer;
      },
      _free: () => undefined,
      _mmd_anim_bullet_world_create: (outWorld: number) => {
        heapU32[outWorld >>> 2] = 1;
        return 0;
      },
      _mmd_anim_bullet_world_destroy: () => undefined,
      _mmd_anim_bullet_world_reset: () => 0,
      _mmd_anim_bullet_world_settle_to_current: () => 0,
      _mmd_anim_bullet_world_step: () => 0,
      _mmd_anim_bullet_world_add_rigidbody: () => 0,
      _mmd_anim_bullet_world_get_rigidbody_transform: () => 0,
      _mmd_anim_bullet_world_set_rigidbody_transform: () => 0,
      _mmd_anim_bullet_world_add_6dof_spring_joint: () => 0,
      _mmd_anim_bullet_world_collect_contacts: (
        _world: number,
        contacts: number,
        capacity: number,
        outCount: number,
      ) => {
        heapU32[outCount >>> 2] = 1;
        if (contacts && capacity) {
          const base = contacts >>> 2;
          new Int32Array(memory)[base] = 7;
          new Int32Array(memory)[base + 1] = 11;
          heapF32.set([-0.125, 1, 2, 3, 4, 5, 6, 0, 1, 0], base + 2);
        }
        return 0;
      },
      refreshMemoryViews: () => undefined,
    } as Parameters<typeof createCustomBulletMmdPhysicsBackend>[0];
    const backend = createCustomBulletMmdPhysicsBackend(module);

    expect(backend.debugContactCount()).toBe(1);
    expect(backend.debugPhysicsContacts()).toEqual([
      {
        rigidBodyIndexA: 7,
        rigidBodyIndexB: 11,
        distance: -0.125,
        positionWorldOnA: [1, 2, 3],
        positionWorldOnB: [4, 5, 6],
        normalWorldOnB: [0, 1, 0],
      },
    ]);
    backend.dispose?.();
  });

  it("filters a large Bullet contact buffer to a rigid-body range", () => {
    const contactCount = 300;
    const memory = new ArrayBuffer(32_768);
    const heapF32 = new Float32Array(memory);
    const heapU8 = new Uint8Array(memory);
    const heapU32 = new Uint32Array(memory);
    const heapI32 = new Int32Array(memory);
    let nextPointer = 256;
    const module = {
      HEAPF32: heapF32,
      HEAPU8: heapU8,
      HEAPU32: heapU32,
      _malloc: (bytes: number) => {
        const pointer = nextPointer;
        nextPointer += Math.ceil(bytes / 8) * 8;
        return pointer;
      },
      _free: () => undefined,
      _mmd_anim_bullet_world_create: (outWorld: number) => {
        heapU32[outWorld >>> 2] = 1;
        return 0;
      },
      _mmd_anim_bullet_world_destroy: () => undefined,
      _mmd_anim_bullet_world_reset: () => 0,
      _mmd_anim_bullet_world_settle_to_current: () => 0,
      _mmd_anim_bullet_world_step: () => 0,
      _mmd_anim_bullet_world_add_rigidbody: () => 0,
      _mmd_anim_bullet_world_get_rigidbody_transform: () => 0,
      _mmd_anim_bullet_world_set_rigidbody_transform: () => 0,
      _mmd_anim_bullet_world_add_6dof_spring_joint: () => 0,
      _mmd_anim_bullet_world_collect_contacts: (
        _world: number,
        contacts: number,
        capacity: number,
        outCount: number,
      ) => {
        heapU32[outCount >>> 2] = contactCount;
        for (let index = 0; index < Math.min(capacity, contactCount); index += 1) {
          const base = (contacts + index * 48) >>> 2;
          heapI32[base] = index === contactCount - 1 ? 0 : 1;
          heapI32[base + 1] = index === contactCount - 1 ? 343 : 2;
        }
        return 0;
      },
      refreshMemoryViews: () => undefined,
    } as Parameters<typeof createCustomBulletMmdPhysicsBackend>[0];
    const backend = createCustomBulletMmdPhysicsBackend(module) as ReturnType<typeof createCustomBulletMmdPhysicsBackend> & {
      debugPhysicsContactsForRigidBodyRange: (firstRigidBodyIndex: number, rigidBodyCount: number) => { rigidBodyIndexA: number; rigidBodyIndexB: number }[];
    };

    expect(backend.debugPhysicsContactsForRigidBodyRange(343, 2)).toHaveLength(1);
    expect(backend.debugPhysicsContactsForRigidBodyRange(343, 2)[0]).toMatchObject({
      rigidBodyIndexA: 0,
      rigidBodyIndexB: 343,
    });
    backend.dispose?.();
  });

  it("preserves dynamic-with-bone translation while applying dynamic translation", () => {
    const memory = new ArrayBuffer(16_384);
    const heapF32 = new Float32Array(memory);
    const heapU8 = new Uint8Array(memory);
    const heapU32 = new Uint32Array(memory);
    let nextPointer = 256;
    const module = {
      HEAPF32: heapF32,
      HEAPU8: heapU8,
      HEAPU32: heapU32,
      _malloc: (bytes: number) => {
        const pointer = nextPointer;
        nextPointer += Math.ceil(bytes / 8) * 8;
        return pointer;
      },
      _free: () => undefined,
      _mmd_anim_bullet_world_create: (outWorld: number) => {
        heapU32[outWorld >>> 2] = 1;
        return 0;
      },
      _mmd_anim_bullet_world_destroy: () => undefined,
      _mmd_anim_bullet_world_reset: () => 0,
      _mmd_anim_bullet_world_settle_to_current: () => 0,
      _mmd_anim_bullet_world_step: () => 0,
      _mmd_anim_bullet_world_add_rigidbody: (_world: number, _descriptor: number, outIndex: number) => {
        heapU32[outIndex >>> 2] += 1;
        return 0;
      },
      _mmd_anim_bullet_world_get_rigidbody_transform: (
        _world: number,
        index: number,
        position: number,
        rotation: number,
      ) => {
        heapF32.set([10 + index, 20 + index, 30 + index], position >>> 2);
        heapF32.set([0, 0, 0, 1], rotation >>> 2);
        return 0;
      },
      _mmd_anim_bullet_world_set_rigidbody_transform: () => 0,
      _mmd_anim_bullet_world_add_6dof_spring_joint: () => 0,
      refreshMemoryViews: () => undefined,
    } as Parameters<typeof createCustomBulletMmdPhysicsBackend>[0];
    const backend = createCustomBulletMmdPhysicsBackend(module);
    const outputTranslations = new Float32Array([1, 2, 3, 4, 5, 6]);
    const updatedBoneIndices: number[] = [];

    backend.step({
      seconds: 1 / 60,
      deltaSeconds: 1 / 60,
      frame: 0.5,
      frameRate: 30,
      skeleton: {
        bones: [
          { index: 0, parentIndex: -1, restTranslation: [0, 0, 0] },
          { index: 1, parentIndex: -1, restTranslation: [0, 0, 0] },
        ],
      },
      rigidBodies: [
        { index: 0, boneIndex: 0, motionType: "dynamic", shape: { type: "sphere", size: [1, 1, 1] } },
        { index: 1, boneIndex: 1, motionType: "dynamicWithBone", shape: { type: "sphere", size: [1, 1, 1] } },
      ],
      joints: [],
      inputWorldMatricesColumnMajor: new Float32Array([
        1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
        1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
      ]),
      output: {
        translations: outputTranslations,
        rotations: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1]),
        updatedBoneIndices,
      },
    });

    expect(Array.from(outputTranslations.slice(0, 3))).toEqual([10, 20, 30]);
    expect(Array.from(outputTranslations.slice(3, 6))).toEqual([4, 5, 6]);
    expect(updatedBoneIndices).toEqual([0, 1]);
    backend.dispose?.();
  });
});
