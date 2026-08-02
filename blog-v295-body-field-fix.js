(() => {
  'use strict';

  const shaders = window.OpenGLV24Shaders;
  if (!shaders?.fs || shaders.fs.includes('BLOG_V295_BODY_FIELD_V2')) return;

  let fragment = shaders.fs;

  /*
   * The earlier patch removed only bodyRefractionFlow. That was insufficient:
   * the main body still used centerTransport, and materialWeight was still set
   * to bodyWeight (the rounded-box SDF depth field). Both paths can draw broad
   * rounded contour bands on a smooth background.
   *
   * The body now samples the already blurred backdrop directly and uses a
   * neutral material weight. The shoulder branch below still replaces both
   * bodyOpticalCoord and materialWeight, so edge refraction, shoulder width,
   * Fresnel and shoulder material remain unchanged.
   */

  const functionStart = 'vec2 bodyRefractionFlow(';
  const functionEnd = '\n}\n\nfloat centerEnvelope';
  const startIndex = fragment.indexOf(functionStart);
  const endIndex = fragment.indexOf(functionEnd, startIndex);

  if (startIndex < 0 || endIndex < 0) {
    console.error('[Blog V29.5] Body-field V2 patch target missing: bodyRefractionFlow.');
    return;
  }

  const flatBodyFlow = `vec2 bodyRefractionFlow(
  vec2 p,
  vec2 n,
  vec2 z,
  float r,
  float depth,
  float weight
){
  return vec2(0.0);
}`;

  fragment = fragment.slice(0, startIndex)
    + flatBodyFlow
    + fragment.slice(endIndex + 2);

  const originalBodySetup = `  vec2 pureBodyCoord=p
      +bodyRefractionFlow(
          p,normal,z,r,depth,bodyWeight
      )
      +centerTransport(p,z);

  vec2 bodyOpticalCoord=pureBodyCoord;
  float materialWeight=bodyWeight;`;

  const neutralBodySetup = `  /* BLOG_V295_BODY_FIELD_V2
   * The broad article body is a clean blurred pane. Only the visible shoulder
   * below uses rounded-distance optical and material weighting.
   */
  vec2 pureBodyCoord=p;
  vec2 bodyOpticalCoord=pureBodyCoord;
  float materialWeight=0.0;`;

  if (!fragment.includes(originalBodySetup)) {
    console.error('[Blog V29.5] Body-field V2 patch target missing: body setup.');
    return;
  }

  fragment = fragment.replace(originalBodySetup, neutralBodySetup);
  window.OpenGLV24Shaders = { ...shaders, fs: fragment };
})();
