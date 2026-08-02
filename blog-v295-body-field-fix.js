(() => {
  'use strict';

  const shaders = window.OpenGLV24Shaders;
  if (!shaders?.fs || shaders.fs.includes('BLOG_V295_FLAT_BODY_FIELD')) return;

  let fragment = shaders.fs;

  const functionStart = 'vec2 bodyRefractionFlow(';
  const functionEnd = '\n}\n\nfloat centerEnvelope';
  const startIndex = fragment.indexOf(functionStart);
  const endIndex = fragment.indexOf(functionEnd, startIndex);

  if (startIndex < 0 || endIndex < 0) {
    console.error('[Blog V29.5] Body-field patch target missing.');
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
  /* BLOG_V295_FLAT_BODY_FIELD
   * The article body must not be warped by rounded-box distance. A distance-
   * based body field turns smooth gradients into nested rounded contours.
   * The continuous two-dimensional centerTransport field remains active, and
   * the SDF-based mapping is retained only by the visible shoulder layer.
   */
  return vec2(0.0);
}`;

  fragment = fragment.slice(0, startIndex)
    + flatBodyFlow
    + fragment.slice(endIndex + 2);

  window.OpenGLV24Shaders = { ...shaders, fs: fragment };
})();
