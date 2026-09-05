const upstreamUrl = new URL('./astra-deep-nebula-mid-variants-loader.js', import.meta.url);
const response = await fetch(upstreamUrl, { cache: 'no-store' });
if (!response.ok) throw new Error(`Failed to load stable galaxy renderer: ${response.status}`);

let source = await response.text();
const directoryUrl = new URL('./', import.meta.url).href;

function replaceOnce(input, search, replacement, label) {
  if (!input.includes(search)) {
    throw new Error(`${label} marker not found; refusing to patch an unknown renderer revision.`);
  }
  return input.replace(search, replacement);
}

// This wrapper itself executes from a Blob. Pin every relative lookup in the
// stable loader back to the real repository directory so the existing nested
// loader chain keeps resolving exactly as before.
source = replaceOnce(
  source,
  "const upstreamUrl = new URL('./astra-deep-nebula-loader.js', import.meta.url);",
  `const upstreamUrl = new URL('./astra-deep-nebula-loader.js', ${JSON.stringify(directoryUrl)});`,
  'Stable loader upstream URL',
);
source = replaceOnce(
  source,
  "const directoryUrl = new URL('./', import.meta.url).href;",
  `const directoryUrl = ${JSON.stringify(directoryUrl)};`,
  'Stable loader directory URL',
);

// The previous same-context prototype still bypassed Three.js state management
// and copied the default framebuffer into a temporary texture. The final
// architecture keeps V29.5 entirely inside EffectComposer: the glass ShaderPass
// samples the previous pass' GPU texture directly, refracts only the DOM card
// rectangle and passes every pixel outside that rectangle through unchanged.
const glassRendererBlock = `
const homepageGlassCard = document.querySelector('[data-liquid-glass="v29.5"]');

function buildHomepageV295Fragment() {
  const original = window.OpenGLV24Shaders?.fs;
  if (!original) {
    console.warn('[homepage-liquid-glass] pinned V29.5 shader is unavailable');
    return 'uniform sampler2D uBlurTexture; varying vec2 vUv; void main(){ gl_FragColor=texture2D(uBlurTexture,vUv); }';
  }

  let fragment = original.replace(
    'uniform float uShoulderEnabled,uRadius,uIntensity;',
    'uniform float uShoulderEnabled,uRadius,uIntensity;\\nuniform vec2 uBlurTexel;\\nvarying vec2 vUv;',
  );

  fragment = fragment.replace(
    /vec3 bodyBackdrop\\(vec2 uv\\)\\{[\\s\\S]*?\\n\\}/,
    'vec3 bodyBackdrop(vec2 uv){\\n'
      + '  vec2 c=clamp(uv,uBlurTexel*1.6,vec2(1.0)-uBlurTexel*1.6);\\n'
      + '  vec2 s=vec2(c.x,1.0-c.y);\\n'
      + '  vec3 color=texture2D(uBlurTexture,s).rgb*.20;\\n'
      + '  color+=texture2D(uBlurTexture,s+vec2( uBlurTexel.x,0.0)).rgb*.12;\\n'
      + '  color+=texture2D(uBlurTexture,s+vec2(-uBlurTexel.x,0.0)).rgb*.12;\\n'
      + '  color+=texture2D(uBlurTexture,s+vec2(0.0, uBlurTexel.y)).rgb*.12;\\n'
      + '  color+=texture2D(uBlurTexture,s+vec2(0.0,-uBlurTexel.y)).rgb*.12;\\n'
      + '  color+=texture2D(uBlurTexture,s+vec2( uBlurTexel.x, uBlurTexel.y)).rgb*.08;\\n'
      + '  color+=texture2D(uBlurTexture,s+vec2(-uBlurTexel.x, uBlurTexel.y)).rgb*.08;\\n'
      + '  color+=texture2D(uBlurTexture,s+vec2( uBlurTexel.x,-uBlurTexel.y)).rgb*.08;\\n'
      + '  color+=texture2D(uBlurTexture,s+vec2(-uBlurTexel.x,-uBlurTexel.y)).rgb*.08;\\n'
      + '  color*=1.14239631336406;\\n'
      + '  color=(color-vec3(.5))*1.0241935483871+vec3(.5);\\n'
      + '  float luma=dot(color,vec3(.2126,.7152,.0722));\\n'
      + '  color=mix(vec3(luma),color,1.112);\\n'
      + '  return clamp(color,0.0,1.0);\\n'
      + '}',
  );

  fragment = fragment.replace(
    'vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);',
    'vec2 rootTop=vec2(gl_FragCoord.x,uRoot.y-gl_FragCoord.y);\\n'
      + '  vec2 p=rootTop-uOrigin;\\n'
      + '  if(p.x<0.0||p.y<0.0||p.x>=uRes.x||p.y>=uRes.y){\\n'
      + '    gl_FragColor=texture2D(uBlurTexture,vUv);\\n'
      + '    return;\\n'
      + '  }',
  );

  fragment = fragment.replace(
    'if(bodyMask<=.001)discard;',
    'if(bodyMask<=.001){gl_FragColor=texture2D(uBlurTexture,vUv);return;}',
  );
  fragment = fragment.replace(
    'if(alpha<=.001)discard;',
    'if(alpha<=.001){gl_FragColor=texture2D(uBlurTexture,vUv);return;}',
  );
  return fragment;
}

const homepageGlassUniforms = {
  uBlurTexture: { value: null },
  uRes: { value: new THREE.Vector2(0, 0) },
  uOrigin: { value: new THREE.Vector2(0, 0) },
  uRoot: { value: new THREE.Vector2(1, 1) },
  uMat: { value: new THREE.Vector4(20, 1, 1.81152073732719, 0) },
  uBodyLensA: { value: new THREE.Vector4(300, 600, 10, 0) },
  uBodyLensB: { value: new THREE.Vector4(200, 180, 0.23041474654378, 0) },
  uBody: { value: new THREE.Vector4(1.25059907834101, 0.2, 12.4423963133641, 0.545161290322581) },
  uShoulder: { value: new THREE.Vector4(21.7162162162162, 89.5, 0, 4) },
  uShoulderFlow: { value: new THREE.Vector2(96, 0) },
  uShoulderEnabled: { value: 2 },
  uRadius: { value: 46 },
  uIntensity: { value: 1.35 },
  uBlurTexel: { value: new THREE.Vector2(1, 1) },
};

const homepageGlassMaterial = new THREE.ShaderMaterial({
  uniforms: homepageGlassUniforms,
  vertexShader: 'varying vec2 vUv; void main(){vUv=position.xy*0.5+0.5;gl_Position=vec4(position.xy,1.0,1.0);}',
  fragmentShader: buildHomepageV295Fragment(),
  depthTest: false,
  depthWrite: false,
  transparent: false,
  blending: THREE.NoBlending,
  toneMapped: false,
});

const homepageGlassPass = new ShaderPass(homepageGlassMaterial, 'uBlurTexture');
composer.addPass(homepageGlassPass);

function updateHomepageGlassUniforms() {
  const rootWidth = Math.max(canvas.width, 1);
  const rootHeight = Math.max(canvas.height, 1);
  const u = homepageGlassUniforms;
  u.uRoot.value.set(rootWidth, rootHeight);

  if (!homepageGlassCard) {
    u.uRes.value.set(0, 0);
    return;
  }

  const canvasRect = canvas.getBoundingClientRect();
  const cardRect = homepageGlassCard.getBoundingClientRect();
  if (canvasRect.width <= 0 || canvasRect.height <= 0 || cardRect.width <= 0 || cardRect.height <= 0) {
    u.uRes.value.set(0, 0);
    return;
  }

  const scaleX = rootWidth / canvasRect.width;
  const scaleY = rootHeight / canvasRect.height;
  const left = THREE.MathUtils.clamp((cardRect.left - canvasRect.left) * scaleX, 0, rootWidth);
  const top = THREE.MathUtils.clamp((cardRect.top - canvasRect.top) * scaleY, 0, rootHeight);
  const right = THREE.MathUtils.clamp((cardRect.right - canvasRect.left) * scaleX, 0, rootWidth);
  const bottom = THREE.MathUtils.clamp((cardRect.bottom - canvasRect.top) * scaleY, 0, rootHeight);
  const cardWidth = Math.max(0, right - left);
  const cardHeight = Math.max(0, bottom - top);
  u.uOrigin.value.set(left, top);
  u.uRes.value.set(cardWidth, cardHeight);

  const scale = (scaleX + scaleY) * 0.5;
  const effectiveBlurPx = 0.230414746543779 * scale * Math.pow(12, 0.55);
  u.uBlurTexel.value.set(
    effectiveBlurPx / rootWidth,
    effectiveBlurPx / rootHeight,
  );
  u.uRadius.value = 46 * scale;
  u.uBodyLensA.value.set(300 * scale, 600 * scale, 10, 0);
  u.uBodyLensB.value.set(200 * scale, 180 * scale, 0.23041474654378, 0);
  u.uShoulder.value.set(21.7162162162162 * scale, 89.5, 0, 4);
  u.uShoulderFlow.value.set(96 * scale, 0);
}
`;

const composerAnchor = "composer.addPass(new EffectPass(camera, bloom, new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })));";
const composerReplacement = `${composerAnchor}\n${glassRendererBlock}`;
const frameAnchor = "  if (shouldRenderScene) {\n    composer.render(dt);";
const frameReplacement = "  if (shouldRenderScene) {\n    updateHomepageGlassUniforms();\n    composer.render(dt);";

const homepagePassPatch = `
source = replaceOnce(
  source,
  /composer\\.addPass\\(new EffectPass\\(camera, bloom, new ToneMappingEffect\\(\\{ mode: ToneMappingMode\\.ACES_FILMIC \\}\\)\\)\\);/,
  ${JSON.stringify(composerReplacement)},
  'Homepage V29.5 composer pass',
);
source = replaceOnce(
  source,
  /  if \\(shouldRenderScene\\) \\{\\n    composer\\.render\\(dt\\);/,
  ${JSON.stringify(frameReplacement)},
  'Homepage V29.5 uniform update',
);
`;

// The stable loader already injects its performance patch into the deep-nebula
// loader immediately before this marker. Inject the homepage pass right after
// those performance transforms so our frame hook targets the optimized loop.
const stableModuleMarker = "const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));";
const bridgeInjection = `
const homepagePassPatch = ${JSON.stringify(homepagePassPatch)};
source = replaceOnce(
  source,
  moduleMarker,
  homepagePassPatch + '\\n\\n' + moduleMarker,
  'Homepage V29.5 pass insertion point',
);
`;

source = replaceOnce(
  source,
  stableModuleMarker,
  `${bridgeInjection}\n\n${stableModuleMarker}`,
  'Homepage composer bridge insertion point',
);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
