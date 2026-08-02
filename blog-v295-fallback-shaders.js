'use strict';

/*
 * Local compatibility shader for the blog reader.
 * The pinned V29.5 shader remains the preferred renderer. This file only
 * installs a compact neutral-glass shader when the external asset is blocked
 * or unavailable, so the reader never falls back to an opaque white panel.
 */
if (!window.OpenGLV24Shaders) {
  window.OpenGLV24Shaders = {
    vs: `
      attribute vec2 a;
      void main() {
        gl_Position = vec4(a, 0.0, 1.0);
      }
    `,
    fs: `
      precision highp float;

      uniform vec2 uRes, uOrigin, uRoot;
      uniform sampler2D uBlurTexture;
      uniform vec4 uMat, uBodyLensA, uBodyLensB, uBody;
      uniform vec4 uShoulder;
      uniform vec2 uShoulderFlow;
      uniform float uShoulderEnabled, uRadius, uIntensity;

      float sat(float value) {
        return clamp(value, 0.0, 1.0);
      }

      float roundedBoxSdf(vec2 point, vec2 size, float radius) {
        vec2 halfSize = size * 0.5;
        vec2 q = abs(point - halfSize) - max(halfSize - vec2(radius), vec2(0.0));
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
      }

      vec2 safeNormal(vec2 value) {
        float magnitude = length(value);
        return magnitude > 0.0001 ? value / magnitude : vec2(0.0, -1.0);
      }

      vec2 rootUv(vec2 localPoint) {
        vec2 root = max(uRoot, vec2(1.0));
        vec2 halfTexel = 0.5 / root;
        return clamp((uOrigin + localPoint) / root, halfTexel, 1.0 - halfTexel);
      }

      void main() {
        vec2 point = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
        vec2 size = max(uRes, vec2(1.0));
        float radius = min(uRadius, min(size.x, size.y) * 0.5);
        float sdf = roundedBoxSdf(point, size, radius);
        float mask = 1.0 - smoothstep(0.0, 1.25, sdf);
        if (mask <= 0.001) discard;

        float depth = max(-sdf, 0.0);
        vec2 centre = size * 0.5;
        vec2 centred = (point - centre) / max(centre, vec2(1.0));
        vec2 normal = safeNormal(point - centre);

        float shoulderWidth = max(1.0, min(uShoulder.x, min(size.x, size.y) * 0.46));
        float shoulder = 1.0 - smoothstep(0.0, shoulderWidth, depth);
        float shoulderMode = sat(uShoulderEnabled * 0.5);
        float lensReach = max(8.0, min(uBodyLensB.y, min(size.x, size.y) * 0.46));
        float lensWeight = 1.0 - smoothstep(0.0, lensReach, depth);

        float basePull = abs(uBodyLensA.x) * 0.012 + abs(uBodyLensA.y) * 0.004;
        float extraPull = max(uBodyLensB.x, 0.0) * 0.010;
        float concentration = sat((uBodyLensA.z + 10.0) / 20.0);
        float cornerBoost = uBodyLensA.w * 0.001;
        float lowFrequency = sat(uBody.z / 900.0);
        float curve = sat((uBody.y - 0.2) / 3.0);

        vec2 tangent = vec2(-normal.y, normal.x);
        vec2 flow = -normal * (basePull + extraPull) * lensWeight;
        flow += centred * min(size.x, size.y) * 0.018 * lowFrequency * (1.0 - dot(centred, centred) * 0.35);
        flow += tangent * uShoulderFlow.y * 2.4 * shoulder * shoulderMode;
        flow += normal * uShoulderFlow.x * 0.015 * shoulder * shoulderMode;
        flow *= mix(0.72, 1.16, concentration) + cornerBoost + curve * 0.08;

        vec2 uv = rootUv(point + flow);
        vec2 chroma = tangent / max(uRoot, vec2(1.0)) * shoulder * 1.35;
        vec3 baseColour;
        baseColour.r = texture2D(uBlurTexture, clamp(uv + chroma, 0.0, 1.0)).r;
        baseColour.g = texture2D(uBlurTexture, clamp(uv, 0.0, 1.0)).g;
        baseColour.b = texture2D(uBlurTexture, clamp(uv - chroma, 0.0, 1.0)).b;

        float materialBrightness = max(0.15, uBody.w * uMat.z);
        float darkening = sat(uBodyLensB.z) * lensWeight * 0.10;
        baseColour = baseColour * materialBrightness - vec3(darkening * 0.30, darkening * 0.38, darkening * 0.48);

        vec2 lightDirection = safeNormal(vec2(-0.62, -0.78));
        float lightFacing = pow(sat(dot(normal, lightDirection)), 2.2);
        float edgeStrength = shoulder * sat(uShoulder.w / 4.0);
        float edgeAngle = sat(uShoulder.y / 89.5);
        float edgeRoundness = sat(uShoulder.z);
        float highlight = edgeStrength * (0.08 + 0.20 * lightFacing) * mix(0.75, 1.15, edgeAngle);
        highlight *= mix(0.82, 1.18, edgeRoundness);

        vec3 glassTint = mix(vec3(0.92, 0.96, 1.00), vec3(1.00, 0.95, 0.99), sat(uBody.x / 1.5) * 0.18);
        vec3 colour = mix(baseColour, glassTint, highlight);
        colour += vec3(0.025, 0.035, 0.055) * shoulder * shoulderMode;

        float debugMix = sat(uBodyLensB.w) * smoothstep(-1.4, 0.0, sdf);
        colour = mix(colour, vec3(1.0, 0.45, 0.0), debugMix);

        float alpha = mask * sat(uMat.y * sat(uMat.x / 20.0) * uIntensity);
        if (alpha <= 0.001) discard;
        gl_FragColor = vec4(clamp(colour, 0.0, 1.0), alpha);
      }
    `
  };
}
