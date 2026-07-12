import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { detectSkyFormat, type MmdSkyFormat } from "./mmdSkyFormats";
import { useMmdStudioStore } from "./mmdStudioStore";

const SOLID_BG = new THREE.Color("#0e1118");

function formatFromUrl(url: string, nameHint: string | null): MmdSkyFormat {
  // blob: URLs have no extension — use stored file name.
  if (nameHint) return detectSkyFormat(nameHint);
  try {
    const path = new URL(url, "https://local.invalid").pathname;
    return detectSkyFormat(path);
  } catch {
    return "ldr";
  }
}

function prepareEquirect(texture: THREE.Texture, format: MmdSkyFormat) {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = format === "ldr" ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Equirectangular sky / environment:
 * - .hdr (RGBE)
 * - .exr
 * - LDR panoramas .png / .jpg / .webp / .avif
 */
export function MmdSky() {
  const { scene, gl } = useThree();
  const skyMode = useMmdStudioStore((state) => state.skyMode);
  const skyHdrUrl = useMmdStudioStore((state) => state.skyHdrUrl);
  const skyHdrName = useMmdStudioStore((state) => state.skyHdrName);
  const skyAsBackground = useMmdStudioStore((state) => state.skyAsBackground);
  const skyAsEnvironment = useMmdStudioStore((state) => state.skyAsEnvironment);
  const envIntensity = useMmdStudioStore((state) => state.envIntensity);
  const textureRef = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    const previousBackground = scene.background;
    const previousEnvironment = scene.environment;

    function clearSkyTexture() {
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

    function applyTexture(texture: THREE.Texture, format: MmdSkyFormat) {
      if (cancelled) {
        texture.dispose();
        return;
      }
      clearSkyTexture();
      prepareEquirect(texture, format);
      textureRef.current = texture;
      scene.background = skyAsBackground ? texture : SOLID_BG;
      scene.environment = skyAsEnvironment ? texture : null;
      if ("environmentIntensity" in scene) {
        (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = envIntensity;
      }
      if ("outputColorSpace" in gl) {
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }
    }

    if (skyMode !== "hdr" || !skyHdrUrl) {
      clearSkyTexture();
      applySolid();
      return () => {
        // leave solid; parent unmount disposes scene
      };
    }

    const format = formatFromUrl(skyHdrUrl, skyHdrName);
    const onError = () => {
      if (!cancelled) applySolid();
    };

    if (format === "hdr") {
      const loader = new RGBELoader();
      loader.setDataType(THREE.HalfFloatType);
      loader.load(skyHdrUrl, (texture) => applyTexture(texture, "hdr"), undefined, onError);
    } else if (format === "exr") {
      const loader = new EXRLoader();
      loader.setDataType(THREE.HalfFloatType);
      loader.load(skyHdrUrl, (texture) => applyTexture(texture, "exr"), undefined, onError);
    } else {
      const loader = new THREE.TextureLoader();
      loader.load(
        skyHdrUrl,
        (texture) => applyTexture(texture, "ldr"),
        undefined,
        onError,
      );
    }

    return () => {
      cancelled = true;
      clearSkyTexture();
      scene.background = previousBackground instanceof THREE.Color ? previousBackground : SOLID_BG;
      scene.environment = previousEnvironment instanceof THREE.Texture ? null : previousEnvironment;
    };
  }, [envIntensity, gl, scene, skyAsBackground, skyAsEnvironment, skyHdrName, skyHdrUrl, skyMode]);

  useEffect(() => {
    if ("environmentIntensity" in scene) {
      (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = envIntensity;
    }
  }, [envIntensity, scene]);

  return null;
}
