import * as THREE from "three";
import type { MaterialOverride } from "./mmdRuntimeMaterials";

export type MmdMaterialEnhanceState = {
  modelId: string;
  materialName: string;
  override: MaterialOverride;
  envIntensity: number;
};

const PARS_MARKER = "#include <map_pars_fragment>";
const INJECT_MARKER = "outgoingLight = ywMmdGammaToLinear( clamp( ywMmdColor, 0.0, 1.0 ) );";

type EnhanceShader = {
  uniforms: Record<string, { value: unknown }>;
};

function hexToLinearColor(hex: string) {
  const color = new THREE.Color(hex || "#ffffff");
  return color.convertSRGBToLinear();
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function clampRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const ENHANCE_SHADER_REV = "v5";

export function attachMmdMaterialEnhance(material: THREE.Material) {
  const typed = material as THREE.MeshToonMaterial;
  if (typed.userData.mmdEnhanceAttached === ENHANCE_SHADER_REV) return;
  typed.userData.mmdEnhanceAttached = ENHANCE_SHADER_REV;
  if (typed.userData.mmdEnhanceBaseDepthWrite == null) {
    typed.userData.mmdEnhanceBaseDepthWrite = typed.depthWrite;
  }
  if (typed.userData.mmdEnhanceBaseTransparent == null) {
    typed.userData.mmdEnhanceBaseTransparent = typed.transparent;
  }

  const prev = typed.onBeforeCompile.bind(typed);
  const prevKey = typed.customProgramCacheKey.bind(typed);

  typed.onBeforeCompile = (shader, renderer) => {
    prev(shader, renderer);
    const uniforms = shader.uniforms as Record<string, { value: unknown }>;
    uniforms.mmdEnhanceOpacity = { value: 1 };
    uniforms.mmdEnhanceMetallic = { value: 0 };
    uniforms.mmdEnhanceRoughness = { value: 0.55 };
    uniforms.mmdEnhanceOcclusion = { value: 1 };
    uniforms.mmdEnhanceEmission = { value: 0 };
    uniforms.mmdEnhanceEmissionColor = { value: new THREE.Color("#ffffff").convertSRGBToLinear() };
    uniforms.mmdEnhanceEnvInfluence = { value: 0 };
    uniforms.mmdEnhanceSpecularMode = { value: 0 };
    uniforms.mmdEnhanceLightingModel = { value: 0 };
    uniforms.mmdEnhanceHasAoMap = { value: 0 };
    uniforms.mmdEnhanceHasEmissionMap = { value: 0 };
    uniforms.mmdEnhanceHasMaskMap = { value: 0 };
    uniforms.mmdEnhanceAoMap = { value: null };
    uniforms.mmdEnhanceEmissionMap = { value: null };
    uniforms.mmdEnhanceMaskMap = { value: null };

    // Keep a stable handle for per-frame uniform sync.
    typed.userData.mmdEnhanceShader = shader as EnhanceShader;
    if (!typed.userData.mmdMaterialFactorShader) {
      typed.userData.mmdMaterialFactorShader = shader;
    }

    shader.fragmentShader = shader.fragmentShader.replace(
      PARS_MARKER,
      [
        PARS_MARKER,
        "uniform float mmdEnhanceOpacity;",
        "uniform float mmdEnhanceMetallic;",
        "uniform float mmdEnhanceRoughness;",
        "uniform float mmdEnhanceOcclusion;",
        "uniform float mmdEnhanceEmission;",
        "uniform vec3 mmdEnhanceEmissionColor;",
        "uniform float mmdEnhanceEnvInfluence;",
        "uniform float mmdEnhanceSpecularMode;",
        "uniform float mmdEnhanceLightingModel;",
        "uniform float mmdEnhanceHasAoMap;",
        "uniform float mmdEnhanceHasEmissionMap;",
        "uniform float mmdEnhanceHasMaskMap;",
        "uniform sampler2D mmdEnhanceAoMap;",
        "uniform sampler2D mmdEnhanceEmissionMap;",
        "uniform sampler2D mmdEnhanceMaskMap;",
      ].join("\n"),
    );

    if (!shader.fragmentShader.includes(INJECT_MARKER)) return;

    shader.fragmentShader = shader.fragmentShader.replace(
      INJECT_MARKER,
      [
        "  vec3 ywMmdEnhanceBaseColor = ywMmdColor;",
        "  vec3 ywMmdEnhanceEmissionColor = mmdEnhanceEmissionColor * mmdEnhanceEmission;",
        "  float ywMmdEnhanceRoughness = clamp( mmdEnhanceRoughness, 0.0, 1.0 );",
        "  float ywMmdEnhanceMetallic = clamp( mmdEnhanceMetallic, 0.0, 1.0 );",
        "  float ywMmdEnhanceOcclusion = clamp( mmdEnhanceOcclusion, 0.0, 1.0 );",
        "  float ywMmdEnhanceEnv = clamp( mmdEnhanceEnvInfluence * 0.35, 0.0, 1.5 );",
        "  vec3 ywMmdEnhanceViewDir = normalize( -vViewPosition );",
        "  float ywMmdEnhanceFresnel = pow( 1.0 - max( 0.0, dot( ywMmdNormal, ywMmdEnhanceViewDir ) ), mix( 5.5, 1.5, ywMmdEnhanceMetallic ) );",
        "  float ywMmdEnhanceSpecular = ywMmdEnhanceEnv * mix( 0.08, 0.6, ywMmdEnhanceMetallic ) * mix( 1.2, 0.22, ywMmdEnhanceRoughness ) * ( 0.2 + ywMmdEnhanceFresnel );",
        "  vec3 ywMmdEnhanceEnvDiffuse = vec3( ywMmdEnhanceEnv * mix( 0.025, 0.06, 1.0 - ywMmdEnhanceRoughness ) );",
        "  vec3 ywMmdEnhanceEnvSpecular = vec3( ywMmdEnhanceSpecular );",
        // Never reference vUv: untextured MMD mats often lack USE_UV / uv varying.
        "  #ifdef USE_MAP",
        "    vec2 ywMmdEnhanceUv = vMapUv;",
        "  #else",
        "    vec2 ywMmdEnhanceUv = vec2( 0.5 );",
        "  #endif",
        "  #ifdef USE_MAP",
        "  if ( mmdEnhanceHasMaskMap > 0.5 ) {",
        "    float ywMmdMask = texture2D( mmdEnhanceMaskMap, ywMmdEnhanceUv ).r;",
        "    ywMmdEnhanceOcclusion *= ywMmdMask;",
        "    ywMmdEnhanceEnv *= mix( 0.35, 1.0, ywMmdMask );",
        "  }",
        "  if ( mmdEnhanceHasAoMap > 0.5 ) {",
        "    float ywMmdAo = texture2D( mmdEnhanceAoMap, ywMmdEnhanceUv ).r;",
        "    ywMmdEnhanceOcclusion *= ywMmdAo;",
        "  }",
        "  if ( mmdEnhanceHasEmissionMap > 0.5 ) {",
        "    vec3 ywMmdEmissionTex = texture2D( mmdEnhanceEmissionMap, ywMmdEnhanceUv ).rgb;",
        "    ywMmdEnhanceEmissionColor *= ywMmdEmissionTex;",
        "  }",
        "  #endif",
        "  ywMmdColor *= mix( 1.0, ywMmdEnhanceOcclusion, 0.35 );",
        "  ywMmdColor += ywMmdEnhanceEmissionColor * ( 0.5 + mmdEnhanceEmission );",
        "  if ( mmdEnhanceSpecularMode < 0.5 ) {",
        "    ywMmdColor += ywMmdEnhanceEnvDiffuse;",
        "  } else if ( mmdEnhanceSpecularMode < 1.5 ) {",
        "    ywMmdColor += ywMmdEnhanceEnvDiffuse + ywMmdEnhanceEnvSpecular;",
        "  } else {",
        "    ywMmdColor = mix( ywMmdEnhanceBaseColor * ( 1.0 - ywMmdEnhanceMetallic * 0.25 ), ywMmdEnhanceBaseColor * 0.78 + ywMmdEnhanceEnvDiffuse + ywMmdEnhanceEnvSpecular * 1.4, 0.85 );",
        "  }",
        "  if ( mmdEnhanceLightingModel > 0.5 ) {",
        "    float ywMmdEnhanceSpecBoost = mix( 0.06, 0.22, ywMmdEnhanceMetallic );",
        "    ywMmdColor = mix( ywMmdColor, ywMmdEnhanceBaseColor * ( 1.0 - ywMmdEnhanceMetallic * 0.5 ) + ywMmdEnhanceEnvDiffuse * 1.4, 0.5 );",
        "    ywMmdColor += vec3( ywMmdEnhanceSpecBoost ) * ( 1.0 - ywMmdEnhanceRoughness );",
        "  }",
        "  ywMmdColor = mix( ywMmdColor, ywMmdColor + vec3( ywMmdEnhanceMetallic * 0.1 ), 0.5 );",
        "  ywMmdColor = mix( ywMmdColor, ywMmdColor * ( 1.0 - ywMmdEnhanceRoughness * 0.1 ), 0.5 );",
        "  outgoingLight = ywMmdGammaToLinear( clamp( ywMmdColor, 0.0, 1.0 ) );",
      ].join("\n"),
    );
  };

  typed.customProgramCacheKey = () => `${prevKey()}-yw-mmd-enhance-${ENHANCE_SHADER_REV}`;
  typed.needsUpdate = true;
}

export function syncMmdMaterialEnhance(material: THREE.Material, state: MmdMaterialEnhanceState) {
  const mat = material as THREE.MeshToonMaterial;
  const shader = (mat.userData.mmdEnhanceShader ?? mat.userData.mmdMaterialFactorShader) as EnhanceShader | undefined;
  if (!shader?.uniforms) return;

  const override = state.override;
  const opacity = clampRange(override.opacity, 0, 1);
  const metallic = clamp01(override.metallic);
  const roughness = clamp01(override.roughness);
  const occlusion = clamp01(override.occlusion);
  const emission = Math.max(0, override.emission);
  const envInfluence = Math.max(0, override.envInfluence) * Math.max(0, state.envIntensity);
  const specularMode = override.specularMode === "env" ? 2 : override.specularMode === "mmd+env" ? 1 : 0;
  const lightingModel = override.lightingModel === "pbr" ? 1 : 0;
  const emissionColor = hexToLinearColor(override.emissionColor);
  const enhancementData = mat.userData.mmdEnhanceTextures as {
    aoMap?: THREE.Texture | null;
    emissionMap?: THREE.Texture | null;
    maskMap?: THREE.Texture | null;
  } | undefined;

  const setNum = (key: string, value: number) => {
    const uniform = shader.uniforms[key];
    if (uniform) uniform.value = value;
  };
  setNum("mmdEnhanceOpacity", opacity);
  setNum("mmdEnhanceMetallic", metallic);
  setNum("mmdEnhanceRoughness", roughness);
  setNum("mmdEnhanceOcclusion", occlusion);
  setNum("mmdEnhanceEmission", emission);
  setNum("mmdEnhanceEnvInfluence", envInfluence);
  setNum("mmdEnhanceSpecularMode", specularMode);
  setNum("mmdEnhanceLightingModel", lightingModel);

  const emissionColorUniform = shader.uniforms.mmdEnhanceEmissionColor;
  if (emissionColorUniform?.value instanceof THREE.Color) emissionColorUniform.value.copy(emissionColor);

  if (shader.uniforms.mmdEnhanceAoMap) shader.uniforms.mmdEnhanceAoMap.value = enhancementData?.aoMap ?? null;
  if (shader.uniforms.mmdEnhanceEmissionMap) shader.uniforms.mmdEnhanceEmissionMap.value = enhancementData?.emissionMap ?? null;
  if (shader.uniforms.mmdEnhanceMaskMap) shader.uniforms.mmdEnhanceMaskMap.value = enhancementData?.maskMap ?? null;
  setNum("mmdEnhanceHasAoMap", enhancementData?.aoMap ? 1 : 0);
  setNum("mmdEnhanceHasEmissionMap", enhancementData?.emissionMap ? 1 : 0);
  setNum("mmdEnhanceHasMaskMap", enhancementData?.maskMap ? 1 : 0);

  const baseTransparent = Boolean(mat.userData.mmdEnhanceBaseTransparent);
  const baseDepthWrite = mat.userData.mmdEnhanceBaseDepthWrite !== false;
  const nextTransparent = opacity < 1 || baseTransparent;
  const nextDepthWrite = opacity < 1 ? false : baseDepthWrite;
  if (mat.opacity !== opacity) mat.opacity = opacity;
  if (mat.transparent !== nextTransparent) mat.transparent = nextTransparent;
  if (mat.depthWrite !== nextDepthWrite) mat.depthWrite = nextDepthWrite;
}
