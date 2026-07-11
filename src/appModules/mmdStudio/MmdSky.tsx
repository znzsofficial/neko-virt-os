import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { useMmdStudioStore } from "./mmdStudioStore";

const SOLID_BG = new THREE.Color("#0e1118");

/**
 * HDR equirectangular sky / environment.
 * Uses RGBELoader + EquirectangularReflectionMapping as scene.background / environment.
 */
export function MmdSky() {
  const { scene, gl } = useThree();
  const skyMode = useMmdStudioStore((state) => state.skyMode);
  const skyHdrUrl = useMmdStudioStore((state) => state.skyHdrUrl);
  const skyAsBackground = useMmdStudioStore((state) => state.skyAsBackground);
  const skyAsEnvironment = useMmdStudioStore((state) => state.skyAsEnvironment);
  const envIntensity = useMmdStudioStore((state) => state.envIntensity);
  const textureRef = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    const previousBackground = scene.background;
    const previousEnvironment = scene.environment;

    function clearHdrTexture() {
      if (textureRef.current) {
        textureRef.current.dispose();
        textureRef.current = null;
      }
    }

    function applySolid() {
      scene.background = SOLID_BG;
      scene.environment = null;
      if ("environmentIntensity" in scene) {
        (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = 1;
      }
    }

    if (skyMode !== "hdr" || !skyHdrUrl) {
      clearHdrTexture();
      applySolid();
      return () => {
        // leave solid; parent unmount disposes scene
      };
    }

    const loader = new RGBELoader();
    loader.setDataType(THREE.HalfFloatType);
    loader.load(
      skyHdrUrl,
      (texture) => {
        if (cancelled) {
          texture.dispose();
          return;
        }
        clearHdrTexture();
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.LinearSRGBColorSpace;
        textureRef.current = texture;
        scene.background = skyAsBackground ? texture : SOLID_BG;
        scene.environment = skyAsEnvironment ? texture : null;
        if ("environmentIntensity" in scene) {
          (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = envIntensity;
        }
        // Ensure tone mapping friendly output for HDR backgrounds.
        if ("outputColorSpace" in gl) {
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }
      },
      undefined,
      () => {
        if (!cancelled) applySolid();
      },
    );

    return () => {
      cancelled = true;
      clearHdrTexture();
      scene.background = previousBackground instanceof THREE.Color ? previousBackground : SOLID_BG;
      scene.environment = previousEnvironment instanceof THREE.Texture ? null : previousEnvironment;
    };
  }, [envIntensity, gl, scene, skyAsBackground, skyAsEnvironment, skyHdrUrl, skyMode]);

  useEffect(() => {
    if ("environmentIntensity" in scene) {
      (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = envIntensity;
    }
  }, [envIntensity, scene]);

  return null;
}
