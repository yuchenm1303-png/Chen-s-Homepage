(() => {
  'use strict';

  const shaders = window.OpenGLV24Shaders;
  if (!shaders?.fs || shaders.fs.includes('BLOG_V295_ANTIBANDING')) return;

  let fragment = shaders.fs;

  const originalBodyFlow = `vec2 bodyRefractionFlow(
  vec2 p,
  vec2 n,
  vec2 z,
  float r,
  float depth,
  float weight
){
  float rawPull=
      abs(uBodyLensA.y)*.052
      +abs(uBodyLensA.x)*.20
      +max(uBodyLensB.x,0.0)*.12;
  float core=pow(weight,1.28);
  float reach=bodyLensReach(z,r);
  float remaining=max(reach-depth,0.0);
  float displacement=
      remaining
      *(1.0-exp(-(rawPull*core)/max(remaining,1.0)))
      *.96;
  return -n*displacement;
}`;

  const monotonicBodyFlow = `vec2 bodyRefractionFlow(
  vec2 p,
  vec2 n,
  vec2 z,
  float r,
  float depth,
  float weight
){
  /* BLOG_V295_MONOTONIC_LENS
   * Keep source depth strictly increasing from edge to centre. The previous
   * exponential compression could make neighbouring depth bands converge on
   * nearly the same source coordinates, producing visible nested contours on
   * smooth dark gradients.
   */
  float rawPull=
      abs(uBodyLensA.y)*.052
      +abs(uBodyLensA.x)*.20
      +max(uBodyLensB.x,0.0)*.12;
  float reach=bodyLensReach(z,r);
  float depth01=sat(depth/max(reach,1.0));
  float edge01=1.0-depth01;
  float singleLobe=edge01*edge01*(3.0-2.0*edge01);
  float strength=sat(rawPull/128.0);
  float maxTravel=min(
      reach*.24*mix(.55,1.0,strength),
      72.0
  );
  float displacement=maxTravel*singleLobe;
  return -n*displacement;
}`;

  if (!fragment.includes(originalBodyFlow)) {
    console.error('[Blog V29.5] Monotonic lens patch target missing: bodyRefractionFlow.');
    return;
  }
  fragment = fragment.replace(originalBodyFlow, monotonicBodyFlow);

  const replacements = [
    [
      'float opticalBoost=1.0+bodyWeight*.24;',
      'float opticalBoost=1.0+bodyWeight*.16;',
      'body optical boost',
    ],
    [
      'color-=vec3(.055,.065,.085)*uBodyLensB.z*bodyWeight;',
      'color-=vec3(.040,.047,.060)*uBodyLensB.z*bodyWeight;',
      'body depth darkening',
    ],
  ];

  for (const [source, replacement, label] of replacements) {
    if (!fragment.includes(source)) {
      console.error(`[Blog V29.5] Anti-banding patch target missing: ${label}.`);
      return;
    }
    fragment = fragment.replace(source, replacement);
  }

  const outputMarker = 'gl_FragColor=vec4(clamp(color,0.0,1.0),sat(alpha));';
  if (!fragment.includes(outputMarker)) {
    console.error('[Blog V29.5] Anti-banding patch target missing: final shader output.');
    return;
  }

  const antiBandingOutput = `
  /* BLOG_V295_ANTIBANDING */
  float ditherA=fract(52.9829189*fract(dot(
      gl_FragCoord.xy,
      vec2(.06711056,.00583715)
  )));
  float ditherB=fract(52.9829189*fract(dot(
      gl_FragCoord.yx+vec2(19.19,47.47),
      vec2(.06711056,.00583715)
  )));
  float triangularDither=(ditherA+ditherB-1.0)*(.72/255.0);
  color+=vec3(triangularDither);
  gl_FragColor=vec4(clamp(color,0.0,1.0),sat(alpha));`;

  fragment = fragment.replace(outputMarker, antiBandingOutput);
  window.OpenGLV24Shaders = { ...shaders, fs: fragment };
})();
