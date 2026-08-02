(() => {
  'use strict';

  const shaders = window.OpenGLV24Shaders;
  if (!shaders?.fs || shaders.fs.includes('BLOG_V295_ANTIBANDING')) return;

  let fragment = shaders.fs;

  /*
   * The original material brightness followed bodyLensWeight too strongly on
   * very smooth, dark gradients. That turns tiny 8-bit colour steps into
   * visible equal-depth contours. Keep the refraction geometry unchanged, but
   * reduce only the secondary brightness modulation that makes those contours
   * readable as rings.
   */
  fragment = fragment.replace(
    'float opticalBoost=1.0+bodyWeight*.24;',
    'float opticalBoost=1.0+bodyWeight*.16;',
  );
  fragment = fragment.replace(
    'color-=vec3(.055,.065,.085)*uBodyLensB.z*bodyWeight;',
    'color-=vec3(.040,.047,.060)*uBodyLensB.z*bodyWeight;',
  );

  const outputMarker = 'gl_FragColor=vec4(clamp(color,0.0,1.0),sat(alpha));';
  if (!fragment.includes(outputMarker)) {
    console.error('[Blog V29.5] Anti-banding patch could not find shader output marker.');
    return;
  }

  /*
   * Screen-space triangular dither, below one 8-bit colour step. It breaks up
   * residual colour quantisation without creating visible grain or changing
   * the liquid-glass edge geometry.
   */
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
