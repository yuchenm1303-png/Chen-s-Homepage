import * as THREE from 'three';
import {
  BlendFunction,
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  ShaderPass,
  ToneMappingEffect,
  ToneMappingMode,
} from 'https://cdn.jsdelivr.net/npm/postprocessing@6.39.4/build/index.js';

const canvas = document.getElementById('galaxyCanvas');
if (!canvas) throw new Error('Galaxy canvas is required.');

const CONFIG = Object.freeze({
  bloomIntensity: 0.7,
  bloomThreshold: 0.08,
  bloomRadius: 0.72,
  bloomLevels: 5,
  intensity: 1.35,
  size: 2.05,
  twinkleSpeed: 0.62,
  brightStarCount: 14800,
  backgroundFraction: 0.27,
  densityStarCount: 118000,
  densityIntensity: 1.15,
  densityTwinkleSpeed: 0.30,
  fov: 55,
  near: 0.1,
  far: 60,
});

const BRIGHT_PALETTE = [
  new THREE.Color('#6DCBF4'), new THREE.Color('#7AB1FE'),
  new THREE.Color('#F87915'), new THREE.Color('#FA994C'),
  new THREE.Color('#F5F6FB'),
];
const DENSITY_PALETTE = [
  new THREE.Color('#EAF1F8'), new THREE.Color('#DDEBFA'),
  new THREE.Color('#BFDFFF'), new THREE.Color('#F3D2B2'),
  new THREE.Color('#E9B287'),
];

const FILTERED_CORE = `
varying float vParticleDiameter;
float astraCubicCoverage(float coordinate) {
  float x = abs(coordinate);
  if (x < 1.0) return (4.0 - 6.0 * x * x + 3.0 * x * x * x) / 6.0;
  float tail = max(2.0 - x, 0.0);
  return tail * tail * tail / 6.0;
}
float astraFilteredCore(vec2 pixel, float area) {
  return astraCubicCoverage(pixel.x) * astraCubicCoverage(pixel.y)
    * area * vParticleDiameter * vParticleDiameter;
}
`;

const BRIGHT_VERTEX = `
attribute float starBrightness;
attribute vec3 starColor;
attribute float starOpacity;
attribute float starScale;
attribute float twinklePhase;
attribute float twinkleRate;
uniform float uIntensity;
uniform float uIntroProgress;
uniform float uPixelRatio;
uniform float uTime;
uniform float uTwinkleSpeed;
varying float vBrightness;
varying vec3 vColor;
varying float vOpacity;
varying float vRayStrength;
${FILTERED_CORE}
float astraParticleRevealProgress(float progress, float seed) {
  float delay = seed * 0.015;
  return smoothstep(delay, 0.14 + delay, progress)
    * mix(0.2, 1.0, smoothstep(0.2, 1.0, progress));
}
void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  float cameraDepth = max(-viewPosition.z, 0.2);
  float twinkle = 0.86 + 0.14 * sin(twinklePhase + uTime * uTwinkleSpeed * twinkleRate);
  vBrightness = uIntensity * starBrightness * twinkle;
  vColor = starColor;
  vOpacity = starOpacity * (0.92 + twinkle * 0.08);
  vRayStrength = smoothstep(1.45, 2.8, starBrightness);
  float revealSeed = fract(twinklePhase * 0.159 + starScale * 0.317);
  float introLocalProgress = astraParticleRevealProgress(uIntroProgress, revealSeed);
  float introParticleScale = sqrt(introLocalProgress);
  vOpacity *= smoothstep(0.0, 0.2, introLocalProgress);
  float depthScale = clamp(8.5 / cameraDepth, 0.28, 2.05);
  gl_PointSize = uPixelRatio * (0.35 + starScale * 3.8) * depthScale
    * (0.97 + twinkle * 0.03) * introParticleScale;
  vParticleDiameter = gl_PointSize;
  gl_PointSize = max(gl_PointSize, 4.0);
  gl_Position = projectionMatrix * viewPosition;
}`;

const BRIGHT_FRAGMENT = `
varying float vBrightness;
varying vec3 vColor;
varying float vOpacity;
varying float vRayStrength;
${FILTERED_CORE}
void main() {
  vec2 pixel = (gl_PointCoord - vec2(0.5)) * max(vParticleDiameter, 4.0);
  vec2 point = pixel * 2.0 / max(vParticleDiameter, 0.0001);
  float distanceToCenter = length(point);
  float disc = 1.0 - smoothstep(0.08, 1.0, distanceToCenter);
  float core = pow(disc, 2.2);
  float horizontalRay = exp(-abs(point.y) * 28.0) * (1.0 - smoothstep(0.18, 1.0, abs(point.x)));
  float verticalRay = exp(-abs(point.x) * 28.0) * (1.0 - smoothstep(0.18, 1.0, abs(point.y)));
  float rays = max(horizontalRay, verticalRay) * 0.28 * vRayStrength;
  float resolved = smoothstep(2.0, 4.0, vParticleDiameter);
  float alpha = mix(astraFilteredCore(pixel, 0.150904), max(core, rays), resolved) * vOpacity;
  if (alpha <= 0.0) discard;
  float whiteCore = mix(0.59228, core, resolved) * smoothstep(0.9, 2.8, vBrightness) * 0.82;
  float colorEnergy = 1.0 - min(vColor.r, min(vColor.g, vColor.b));
  vec3 emission = mix(vColor, vec3(1.0), whiteCore) * vBrightness * (1.0 + colorEnergy * 0.42);
  gl_FragColor = vec4(emission, alpha);
}`;

const DENSITY_VERTEX = `
attribute float starBrightness;
attribute vec3 starColor;
attribute float starOpacity;
attribute float starScale;
attribute float twinklePhase;
attribute float twinkleRate;
uniform float uIntensity;
uniform float uIntroProgress;
uniform float uPixelRatio;
uniform float uTime;
uniform float uTwinkleSpeed;
varying float vBrightness;
varying vec3 vColor;
varying float vOpacity;
varying float vFluxCompensation;
${FILTERED_CORE}
void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  float cameraDepth = max(-viewPosition.z, 0.2);
  float depthScale = clamp(8.6 / cameraDepth, 0.24, 1.16);
  float twinkle = 0.95 + 0.05 * sin(twinklePhase + uTime * uTwinkleSpeed * twinkleRate);
  vBrightness = uIntensity * starBrightness * twinkle;
  vColor = starColor;
  vOpacity = starOpacity * (0.97 + twinkle * 0.03) * smoothstep(0.0, 0.55, uIntroProgress);
  float opticalDiameter = uPixelRatio * (0.30 + starScale * 3.4) * depthScale * (0.995 + twinkle * 0.005);
  vParticleDiameter = max(opticalDiameter, uPixelRatio * 0.82);

  // Preserve integrated radiance for unresolved stars. The Astra filtered core
  // intentionally scales coverage with diameter^2; that is ideal for resolved
  // particles, but it made subpixel Milky Way populations lose almost all flux.
  // Compensate only below a small reference footprint, without changing sprite
  // size, geometry, star count, or the bright-star optical pipeline.
  float referenceDiameter = uPixelRatio * 2.15;
  float fluxRatio = referenceDiameter / max(vParticleDiameter, 0.0001);
  vFluxCompensation = clamp(fluxRatio * fluxRatio, 1.0, 6.0);

  gl_PointSize = max(vParticleDiameter, 4.0);
  gl_Position = projectionMatrix * viewPosition;
}`;

const DENSITY_FRAGMENT = `
varying float vBrightness;
varying vec3 vColor;
varying float vOpacity;
varying float vFluxCompensation;
${FILTERED_CORE}
void main() {
  vec2 pixel = (gl_PointCoord - vec2(0.5)) * max(vParticleDiameter, 4.0);
  float alpha = astraFilteredCore(pixel, 0.205) * vOpacity * vFluxCompensation;
  if (alpha <= 0.000006) discard;
  gl_FragColor = vec4(vColor * vBrightness, alpha);
}`;

const ASTRA_BLOOM_PREFILTER = `
#include <common>
uniform sampler2D inputBuffer;
uniform vec2 sourceTexelSize;
uniform float threshold;
uniform float smoothing;
varying vec2 vUv;
void main() {
  vec2 offset = sourceTexelSize * 0.5;
  vec4 color = (
    texture2D(inputBuffer, vUv + vec2(-offset.x, -offset.y)) +
    texture2D(inputBuffer, vUv + vec2( offset.x, -offset.y)) +
    texture2D(inputBuffer, vUv + vec2(-offset.x,  offset.y)) +
    texture2D(inputBuffer, vUv + vec2( offset.x,  offset.y))
  ) * 0.25;
  gl_FragColor = color * smoothstep(threshold, threshold + smoothing, luminance(color.rgb));
}`;
const ASTRA_BLOOM_RECONSTRUCTION = `
uniform sampler2D source;
uniform vec2 stepSize;
varying vec2 vUv;
void main() {
  vec4 color = texture2D(source, vUv) * 0.2270270270;
  color += (texture2D(source, vUv + stepSize * 1.3846153846) + texture2D(source, vUv - stepSize * 1.3846153846)) * 0.3162162162;
  color += (texture2D(source, vUv + stepSize * 3.2307692308) + texture2D(source, vUv - stepSize * 3.2307692308)) * 0.0702702703;
  gl_FragColor = color;
}`;

class AstraBloomEffect extends BloomEffect {
  constructor(options) {
    super(options);
    this.sourceTexelSize = new THREE.Uniform(new THREE.Vector2());
    this.blurSource = new THREE.Uniform(null);
    this.blurStep = new THREE.Uniform(new THREE.Vector2());
    this.horizontalTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.verticalTarget = this.horizontalTarget.clone();
    this.reconstruction = new ShaderPass(new THREE.ShaderMaterial({
      uniforms: { source: this.blurSource, stepSize: this.blurStep },
      vertexShader: `varying vec2 vUv; void main(){vUv=position.xy*0.5+0.5;gl_Position=vec4(position.xy,1.0,1.0);}`,
      fragmentShader: ASTRA_BLOOM_RECONSTRUCTION,
      blending: THREE.NoBlending, depthTest: false, depthWrite: false, toneMapped: false,
    }));
    this.luminanceMaterial.uniforms.sourceTexelSize = this.sourceTexelSize;
    this.luminanceMaterial.fragmentShader = ASTRA_BLOOM_PREFILTER;
    this.luminanceMaterial.needsUpdate = true;
    this.uniforms.set('map', new THREE.Uniform(this.verticalTarget.texture));
  }
  setSize(width, height) {
    super.setSize(width, height);
    this.horizontalTarget.setSize(Math.max(1, Math.round(width * 0.5)), Math.max(1, Math.round(height * 0.5)));
    this.verticalTarget.setSize(this.horizontalTarget.width, this.horizontalTarget.height);
  }
  update(renderer, inputBuffer, deltaTime) {
    this.sourceTexelSize.value.set(1 / inputBuffer.width, 1 / inputBuffer.height);
    super.update(renderer, inputBuffer, deltaTime);
    this.blurSource.value = super.texture;
    this.blurStep.value.set(1 / this.horizontalTarget.width, 0);
    this.reconstruction.render(renderer, null, this.horizontalTarget);
    this.blurSource.value = this.horizontalTarget.texture;
    this.blurStep.value.set(0, 1 / this.verticalTarget.height);
    this.reconstruction.render(renderer, null, this.verticalTarget);
  }
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}
function gaussian(random) {
  const u = Math.max(random(), 1e-7);
  const v = Math.max(random(), 1e-7);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}
function gaussianWeight(value, centre, width) {
  return Math.exp(-Math.pow((value - centre) / width, 2));
}

function makeGeometry(count) {
  return {
    positions: new Float32Array(count * 3),
    brightness: new Float32Array(count),
    colors: new Float32Array(count * 3),
    opacity: new Float32Array(count),
    scale: new Float32Array(count),
    phase: new Float32Array(count),
    rate: new Float32Array(count),
  };
}
function finishPoints(data, vertexShader, fragmentShader, uniforms) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('starBrightness', new THREE.BufferAttribute(data.brightness, 1));
  geometry.setAttribute('starColor', new THREE.BufferAttribute(data.colors, 3));
  geometry.setAttribute('starOpacity', new THREE.BufferAttribute(data.opacity, 1));
  geometry.setAttribute('starScale', new THREE.BufferAttribute(data.scale, 1));
  geometry.setAttribute('twinklePhase', new THREE.BufferAttribute(data.phase, 1));
  geometry.setAttribute('twinkleRate', new THREE.BufferAttribute(data.rate, 1));
  const material = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, transparent: true, toneMapped: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    vertexShader, fragmentShader, uniforms,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, geometry, material };
}

function buildBrightField() {
  const random = seeded(0xA57A2D31);
  const data = makeGeometry(CONFIG.brightStarCount);
  const fovTan = Math.tan(THREE.MathUtils.degToRad(CONFIG.fov * 0.5));
  const angle = THREE.MathUtils.degToRad(34), c = Math.cos(angle), s = Math.sin(angle);

  function pickColor(seed, centreWeight) {
    const adjusted = centreWeight > 0 && random() < centreWeight * 0.28 ? 0.64 + random() * 0.36 : seed;
    if (adjusted < 0.36) return BRIGHT_PALETTE[0];
    if (adjusted < 0.52) return BRIGHT_PALETTE[1];
    if (adjusted < 0.64) return BRIGHT_PALETTE[2];
    if (adjusted < 0.74) return BRIGHT_PALETTE[3];
    return BRIGHT_PALETTE[4];
  }
  function sampleDepth(isBand) {
    const shell = random();
    if (isBand) {
      if (shell < 0.045) return 4.5 + Math.pow(random(), 0.72) * 6.0;
      if (shell < 0.36) return 9.0 + Math.pow(random(), 0.78) * 15.0;
      return 18.0 + Math.pow(random(), 0.88) * 31.0;
    }
    if (shell < 0.08) return 3.2 + Math.pow(random(), 0.72) * 6.8;
    if (shell < 0.42) return 8.0 + Math.pow(random(), 0.78) * 14.0;
    return 17.0 + Math.pow(random(), 0.86) * 30.0;
  }
  function sampleBand() {
    for (let guard = 0; guard < 40; guard++) {
      const complex = random();
      let along;
      if (complex < 0.16) along = -0.58 + gaussian(random) * 0.16;
      else if (complex < 0.36) along = -0.10 + gaussian(random) * 0.18;
      else if (complex < 0.58) along = 0.28 + gaussian(random) * 0.17;
      else if (complex < 0.72) along = 0.63 + gaussian(random) * 0.13;
      else along = random() * 2.55 - 1.28;
      along = THREE.MathUtils.clamp(along, -1.34, 1.34);
      const centreWeight = Math.exp(-Math.pow((along - 0.18) / 0.38, 2));
      const width = 0.070 + 0.050 * (1 - Math.min(1, Math.abs(along) / 1.34)) + 0.040 * centreWeight;
      const centreLine = 0.025 * Math.sin(along * 2.6 + 0.45) + 0.014 * Math.sin(along * 6.4 - 0.8);
      let across = centreLine + gaussian(random) * width;
      const rift = centreLine + 0.010 * Math.sin(along * 7.2 + 0.6) - 0.008 * Math.sin(along * 13.0);
      if (Math.abs(across - rift) < 0.014 + centreWeight * 0.013 && random() < 0.42 + 0.36 * centreWeight) continue;
      across += (random() - 0.5) * 0.010 * (1 + Math.abs(along));
      return { along, across, centreWeight };
    }
    return { along: random() * 2.4 - 1.2, across: gaussian(random) * 0.11, centreWeight: 0 };
  }

  for (let i = 0; i < CONFIG.brightStarCount; i++) {
    const isBand = random() >= CONFIG.backgroundFraction;
    const depth = sampleDepth(isBand);
    const halfHeight = fovTan * depth * 1.30, halfWidth = halfHeight * 2.2;
    let x, y, centreWeight = 0;
    if (isBand) {
      const b = sampleBand(); centreWeight = b.centreWeight;
      const nx = b.along * c - b.across * s, ny = b.along * s + b.across * c;
      x = nx * halfWidth * 0.82 + gaussian(random) * depth * (0.018 + 0.022 * (1 - centreWeight));
      y = ny * halfHeight * 1.04 + gaussian(random) * depth * (0.018 + 0.022 * (1 - centreWeight)) * 0.55;
    } else {
      x = (random() * 2 - 1) * halfWidth; y = (random() * 2 - 1) * halfHeight;
    }
    const o = i * 3; data.positions[o] = x; data.positions[o+1] = y; data.positions[o+2] = -depth;
    const chance = random();
    const heroCutoff = isBand ? 0.9978 - centreWeight * 0.0008 : 0.9987;
    const brightCutoff = isBand ? 0.979 - centreWeight * 0.005 : 0.985;
    let sc, br, op;
    if (chance > heroCutoff) { sc=(1.45+random()*0.85)*CONFIG.size; br=3.05+random()*0.75; op=0.90+random()*0.09; }
    else if (chance > brightCutoff) { sc=(0.62+random()*0.82)*CONFIG.size; br=1.75+random()*1.12; op=0.74+random()*0.22; }
    else { const p=isBand?0.92+centreWeight*0.15:0.78; sc=(0.055+Math.pow(random(),2.65)*0.34)*CONFIG.size; br=(0.54+random()*0.82)*p; op=(0.18+random()*0.58)*p; }
    const dq = THREE.MathUtils.clamp(1.12 - depth / 80, 0.58, 1.0);
    data.brightness[i]=br*dq; data.opacity[i]=op*(0.72+0.28*dq); data.scale[i]=sc;
    data.phase[i]=random()*Math.PI*2; data.rate[i]=0.65+random()*0.70;
    const color = pickColor(random(), isBand ? centreWeight : 0);
    data.colors[o]=color.r; data.colors[o+1]=color.g; data.colors[o+2]=color.b;
  }
  return finishPoints(data, BRIGHT_VERTEX, BRIGHT_FRAGMENT, {
    uIntensity:{value:CONFIG.intensity}, uIntroProgress:{value:0}, uPixelRatio:{value:1},
    uTime:{value:0}, uTwinkleSpeed:{value:CONFIG.twinkleSpeed},
  });
}

function buildDensityField() {
  const random = seeded(0x4D494C5A);
  const data = makeGeometry(CONFIG.densityStarCount);
  const fovTan = Math.tan(THREE.MathUtils.degToRad(CONFIG.fov * 0.5));
  const angle = THREE.MathUtils.degToRad(34), c = Math.cos(angle), s = Math.sin(angle);

  function pickColor(centreWeight) {
    const seed = random();
    if (seed < 0.50 - centreWeight * 0.08) return DENSITY_PALETTE[0];
    if (seed < 0.70) return DENSITY_PALETTE[1];
    if (seed < 0.84 - centreWeight * 0.05) return DENSITY_PALETTE[2];
    if (seed < 0.96) return DENSITY_PALETTE[3];
    return DENSITY_PALETTE[4];
  }
  function sampleDepth() {
    const shell = random();
    if (shell < 0.012) return 5.5 + Math.pow(random(),0.78)*7.0;
    if (shell < 0.14) return 11.0 + Math.pow(random(),0.84)*14.0;
    return 20.0 + Math.pow(random(),0.92)*36.0;
  }
  function sampleAlong() {
    const mode=random();
    if(mode<0.10)return -1.08+gaussian(random)*0.13;
    if(mode<0.23)return -0.74+gaussian(random)*0.15;
    if(mode<0.37)return -0.38+gaussian(random)*0.15;
    if(mode<0.58)return 0.00+gaussian(random)*0.17;
    if(mode<0.78)return 0.31+gaussian(random)*0.15;
    if(mode<0.90)return 0.68+gaussian(random)*0.16;
    return random()*3.12-1.56;
  }
  function sampleBand() {
    for(let guard=0;guard<112;guard++){
      const along=THREE.MathUtils.clamp(sampleAlong(),-1.58,1.58);
      const centreWeight=gaussianWeight(along,0.20,0.38), broadWeight=gaussianWeight(along,0.03,1.14);
      const centreLine=0.024*Math.sin(along*2.05+0.32)+0.014*Math.sin(along*5.5-0.50);
      const baseWidth=0.155+broadWeight*0.072+centreWeight*0.155;
      const roll=random(); let population=0,widthScale=0.72;
      if(roll>0.64&&roll<=0.90){population=1;widthScale=1.24;} else if(roll>0.90){population=2;widthScale=2.12;}
      const bulge=centreWeight>0.08&&random()<centreWeight*0.56; if(bulge)widthScale*=1.42;
      const ridgeOffset=0.022*Math.sin(along*2.9-0.34)+0.012*Math.sin(along*7.7+1.10);
      let across=centreLine+ridgeOffset+gaussian(random)*baseWidth*widthScale;
      const mainRift=centreLine+0.016*Math.sin(along*5.1+0.62)-0.018*Math.sin(along*10.5-0.18);
      const mainRiftWidth=0.032+broadWeight*0.010+centreWeight*0.046;
      if(Math.abs(across-mainRift)<mainRiftWidth){const rb=population===0?0.96:population===1?0.84:0.54;if(random()<Math.min(0.992,rb+centreWeight*0.03))continue;}
      const branchWindow=gaussianWeight(along,0.24,0.64), branchRift=centreLine-0.095+0.018*Math.sin(along*8.2+1.08);
      if(Math.abs(across-branchRift)<0.020+branchWindow*0.018){const reject=(population===0?0.68:population===1?0.44:0.22)*branchWindow;if(random()<reject)continue;}
      const complexPeak=Math.max(gaussianWeight(along,-0.86,0.22),gaussianWeight(along,-0.30,0.20),gaussianWeight(along,0.13,0.23),gaussianWeight(along,0.56,0.22));
      const granular=0.76+0.10*Math.sin(along*11.6+across*16.0)+0.08*Math.sin(along*20.7-across*23.0);
      const survival=THREE.MathUtils.clamp(granular+complexPeak*0.20+centreWeight*0.10,population===2?0.42:0.58,1.0);
      if(random()>survival)continue;
      across+=gaussian(random)*0.010*(1.0+Math.abs(along)*0.28);
      return{along,across,centreWeight,population,bulge,complexPeak};
    }
    return{along:random()*2.9-1.45,across:gaussian(random)*0.24,centreWeight:0,population:2,bulge:false,complexPeak:0};
  }

  for(let i=0;i<CONFIG.densityStarCount;i++){
    const depth=sampleDepth(), halfHeight=fovTan*depth*1.30, halfWidth=halfHeight*2.2, b=sampleBand();
    const nx=b.along*c-b.across*s, ny=b.along*s+b.across*c;
    let x=nx*halfWidth*0.83, y=ny*halfHeight*1.04;
    const pth=b.population===0?0.014:b.population===1?0.024:0.040;
    const th=pth+(1-b.centreWeight)*0.009+(b.bulge?0.015:0);
    x+=gaussian(random)*depth*th; y+=gaussian(random)*depth*th*0.60;
    const o=i*3; data.positions[o]=x; data.positions[o+1]=y; data.positions[o+2]=-depth;
    const centreBoost=0.90+b.centreWeight*0.50, complexBoost=0.92+b.complexPeak*0.20;
    const populationQuiet=b.population===0?1.0:b.population===1?0.82:0.62;
    const depthQuiet=THREE.MathUtils.clamp(1.14-depth/112,0.64,1.0);
    const roll=random(); let ob,oo,os;
    if(roll<0.58){ob=0.42+random()*0.32;oo=0.34+random()*0.26;os=0.020+Math.pow(random(),2.5)*0.060;}
    else if(roll<0.93){ob=0.58+random()*0.40;oo=0.42+random()*0.30;os=0.060+Math.pow(random(),2.4)*0.115;}
    else{ob=0.78+random()*0.48;oo=0.52+random()*0.30;os=0.145+Math.pow(random(),2.2)*0.205;}
    data.brightness[i]=ob*centreBoost*complexBoost*populationQuiet*depthQuiet;
    data.opacity[i]=oo*(0.94+b.centreWeight*0.22)*populationQuiet;
    data.scale[i]=os; data.phase[i]=random()*Math.PI*2; data.rate[i]=0.72+random()*0.46;
    const color=pickColor(b.centreWeight); data.colors[o]=color.r; data.colors[o+1]=color.g; data.colors[o+2]=color.b;
  }
  const out=finishPoints(data,DENSITY_VERTEX,DENSITY_FRAGMENT,{
    uIntensity:{value:CONFIG.densityIntensity},uIntroProgress:{value:0},uPixelRatio:{value:1},
    uTime:{value:0},uTwinkleSpeed:{value:CONFIG.densityTwinkleSpeed},
  });
  out.points.renderOrder=-10;
  return out;
}

const renderer=new THREE.WebGLRenderer({canvas,alpha:false,antialias:true,depth:false,powerPreference:'high-performance'});
renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.NoToneMapping; renderer.setClearColor(0x000000,1);
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x000000);
const camera=new THREE.PerspectiveCamera(CONFIG.fov,1,CONFIG.near,CONFIG.far); camera.position.set(0,0,0);
const densityField=buildDensityField(); const brightField=buildBrightField();
scene.add(densityField.points); scene.add(brightField.points);
const composer=new EffectComposer(renderer,{depthBuffer:false,frameBufferType:THREE.HalfFloatType,multisampling:2});
composer.addPass(new RenderPass(scene,camera));
const bloom=new AstraBloomEffect({blendFunction:BlendFunction.ADD,intensity:CONFIG.bloomIntensity,levels:CONFIG.bloomLevels,luminanceSmoothing:0.18,luminanceThreshold:CONFIG.bloomThreshold,mipmapBlur:true,radius:CONFIG.bloomRadius});
composer.addPass(new EffectPass(camera,bloom,new ToneMappingEffect({mode:ToneMappingMode.ACES_FILMIC})));

const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false;
const pointer={targetX:0,targetY:0,currentX:0,currentY:0};
let width=1,height=1,pixelRatio=1;
function resize(){
  const w=Math.max(1,Math.floor(canvas.clientWidth)),h=Math.max(1,Math.floor(canvas.clientHeight)),dpr=Math.min(window.devicePixelRatio||1,1.5);
  if(w===width&&h===height&&dpr===pixelRatio)return; width=w;height=h;pixelRatio=dpr;
  renderer.setDrawingBufferSize(width,height,pixelRatio); composer.setSize(width,height,false);
  bloom.setSize(Math.max(1,Math.floor(width*pixelRatio*0.5)),Math.max(1,Math.floor(height*pixelRatio*0.5)));
  camera.aspect=width/Math.max(height,1);camera.updateProjectionMatrix();
  brightField.material.uniforms.uPixelRatio.value=pixelRatio; densityField.material.uniforms.uPixelRatio.value=pixelRatio;
}
function shapeAxis(value){const dead=0.045,a=Math.abs(value);if(a<=dead)return 0;const n=Math.min(1,(a-dead)/(1-dead));return Math.sign(value)*n*n*(3-2*n);}
window.addEventListener('pointermove',e=>{if(reducedMotion)return;pointer.targetX=shapeAxis(e.clientX/Math.max(window.innerWidth,1)*2-1);pointer.targetY=shapeAxis(-(e.clientY/Math.max(window.innerHeight,1)*2-1));},{passive:true});
function resetPointer(){pointer.targetX=0;pointer.targetY=0;} window.addEventListener('pointerleave',resetPointer,{passive:true});window.addEventListener('blur',resetPointer,{passive:true});
function damp(current,target,speed,dt){return current+(target-current)*(1-Math.exp(-speed*dt));}
const started=performance.now();let previous=started;const lookTarget=new THREE.Vector3();
function frame(now){
  resize();const dt=Math.min(0.05,Math.max(0.001,(now-previous)/1000));previous=now;const elapsed=(now-started)/1000;
  pointer.currentX=damp(pointer.currentX,pointer.targetX,2.7,dt);pointer.currentY=damp(pointer.currentY,pointer.targetY,2.7,dt);
  if(!reducedMotion){camera.position.x=pointer.currentX*0.34;camera.position.y=pointer.currentY*0.20;lookTarget.set(pointer.currentX*1.05,pointer.currentY*0.62,-12);camera.lookAt(lookTarget);}else{camera.position.set(0,0,0);camera.lookAt(0,0,-12);}
  const intro=reducedMotion?1:THREE.MathUtils.clamp(elapsed/1.65,0,1);
  for(const f of [brightField,densityField]){f.material.uniforms.uIntroProgress.value=intro;f.material.uniforms.uTime.value=reducedMotion?0:elapsed;}
  brightField.material.uniforms.uTwinkleSpeed.value=reducedMotion?0:CONFIG.twinkleSpeed;
  densityField.material.uniforms.uTwinkleSpeed.value=reducedMotion?0:CONFIG.densityTwinkleSpeed;
  composer.render(dt);requestAnimationFrame(frame);
}
window.addEventListener('resize',resize,{passive:true});resize();requestAnimationFrame(frame);
