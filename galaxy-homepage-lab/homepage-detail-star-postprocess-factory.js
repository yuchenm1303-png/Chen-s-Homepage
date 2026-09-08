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

// Keep the detail-star postprocess byte-for-byte aligned with the galaxy's
// approved Astra bloom reconstruction. This is not a new glow treatment: it is
// the same HDR prefilter -> mipmap bloom -> reconstruction -> ACES pipeline.
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
    this.horizontalTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
    });
    this.verticalTarget = this.horizontalTarget.clone();
    this.reconstruction = new ShaderPass(new THREE.ShaderMaterial({
      uniforms: { source: this.blurSource, stepSize: this.blurStep },
      vertexShader: 'varying vec2 vUv; void main(){vUv=position.xy*0.5+0.5;gl_Position=vec4(position.xy,1.0,1.0);}',
      fragmentShader: ASTRA_BLOOM_RECONSTRUCTION,
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }));
    this.luminanceMaterial.uniforms.sourceTexelSize = this.sourceTexelSize;
    this.luminanceMaterial.fragmentShader = ASTRA_BLOOM_PREFILTER;
    this.luminanceMaterial.needsUpdate = true;
    this.uniforms.set('map', new THREE.Uniform(this.verticalTarget.texture));
  }

  setSize(width, height) {
    super.setSize(width, height);
    this.horizontalTarget.setSize(
      Math.max(1, Math.round(width * 0.5)),
      Math.max(1, Math.round(height * 0.5)),
    );
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

const BLOOM = Object.freeze({
  intensity: 0.7,
  threshold: 0.08,
  radius: 0.72,
  levels: 5,
  smoothing: 0.18,
});

window.__SMIREL_CREATE_DETAIL_STELLAR_POSTPROCESS__ = function createDetailStellarPostprocess({
  renderer,
  scene,
  camera,
  size = 512,
}) {
  if (!renderer || !scene || !camera) return null;

  // The UI canvas is permanently 512px at DPR 1. Keep the render targets fixed
  // and skip MSAA; the visual bloom path remains the same while avoiding the
  // resize/multisample cost that made the old independent renderer stutter.
  const composer = new EffectComposer(renderer, {
    depthBuffer: false,
    frameBufferType: THREE.HalfFloatType,
    multisampling: 0,
  });
  const renderPass = new RenderPass(scene, camera);
  const bloom = new AstraBloomEffect({
    blendFunction: BlendFunction.ADD,
    intensity: BLOOM.intensity,
    levels: BLOOM.levels,
    luminanceSmoothing: BLOOM.smoothing,
    luminanceThreshold: BLOOM.threshold,
    mipmapBlur: true,
    radius: BLOOM.radius,
  });
  const toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  const effectPass = new EffectPass(camera, bloom, toneMapping);

  composer.addPass(renderPass);
  composer.addPass(effectPass);
  composer.setSize(size, size, false);
  bloom.setSize(
    Math.max(1, Math.floor(size * 0.5)),
    Math.max(1, Math.floor(size * 0.5)),
  );

  return {
    render(deltaTime = 1 / 30) {
      bloom.luminanceMaterial.uniforms.threshold.value = BLOOM.threshold;
      bloom.intensity = BLOOM.intensity;
      bloom.mipmapBlurPass.radius = BLOOM.radius;
      composer.render(deltaTime);
    },
    dispose() {
      try { composer.dispose?.(); } catch (_) {}
      try { bloom.dispose?.(); } catch (_) {}
      try { renderPass.dispose?.(); } catch (_) {}
      try { effectPass.dispose?.(); } catch (_) {}
    },
  };
};

window.__SMIREL_DETAIL_STELLAR_POSTPROCESS_V1__ = true;
