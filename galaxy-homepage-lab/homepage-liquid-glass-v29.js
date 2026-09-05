(() => {
  'use strict';

  const card = document.querySelector('[data-liquid-glass="v29.5"]');
  const sourceCanvas = document.getElementById('galaxyCanvas');
  if (!card || !sourceCanvas) return;

  const backdropCanvas = card.querySelector('.liquid-glass__backdrop');
  const opticsCanvas = card.querySelector('.liquid-glass__optics');
  if (!(backdropCanvas instanceof HTMLCanvasElement) || !(opticsCanvas instanceof HTMLCanvasElement)) return;

  const params = {
    radius: 22,
    blurRadius: 0.230414746543779,
    blurIterations: 12,
    brightness: 1.14239631336406,
    contrast: 1.0241935483871,
    saturation: 1.112,
    bodyVisibility: 20,
    bodyMaxAlpha: 1,
    bodyOutputBrightness: 1.81152073732719,
    bodyLensBasePull: 300,
    bodyLensPullDp: 600,
    bodyLensConcentration: 10,
    bodyLensCornerBoost: 0,
    bodyLensExtraDistance: 200,
    bodyLensReachDp: 180,
    bodyLensDark: 0.23041474654378,
    bodyLowFrequencyWidth: 1.25059907834101,
    bodyLowFrequencyCurve: 0.2,
    bodyLowFrequencyGain: 12.4423963133641,
    bodyBrightness: 0.545161290322581,
    glassIntensity: 1.35,
    shoulderWidthPx: 21.7162162162162,
    shoulderMaxAngleDeg: 89.5,
    shoulderFalloffRoundness: 0,
    shoulderMaterialStrength: 4,
    shoulderTangentialFlowStrength: 0,
    shoulderCaptureWidthPx: 96,
  };

  const vertexShader = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const fragmentShader = `precision highp float;
uniform vec2 uRes,uOrigin,uRoot;
uniform sampler2D uBlurTexture;
uniform vec4 uMat,uBodyLensA,uBodyLensB,uBody;
uniform vec4 uShoulder;
uniform vec2 uShoulderFlow;
uniform float uShoulderEnabled,uRadius,uIntensity;

float sat(float x){return clamp(x,0.0,1.0);}
float boxSdf(vec2 p,vec2 z,float r){
  vec2 q=abs(p-z*.5)-max(z*.5-vec2(r),vec2(0.0));
  return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r;
}
float insideFromSdf(float sdf){return max(-sdf,0.0);}
vec2 globalUv(vec2 p){
  vec2 root=max(uRoot,vec2(1.0));
  vec2 texel=.5/root;
  return clamp((uOrigin+p)/root,texel,1.0-texel);
}
vec3 bodyBackdrop(vec2 uv){
  return texture2D(uBlurTexture,clamp(uv,0.0,1.0)).rgb;
}
vec2 softLimit(vec2 v,float lim){
  float n=length(v);
  float m=n/(1.0+n/max(lim,1.0));
  return v*(m/max(n,.0001));
}

vec2 perimeterNormalAt(vec2 p,vec2 z,float r){
  vec2 local=p-z*.5;
  vec2 core=max(z*.5-vec2(r),vec2(0.0));
  vec2 nearest=clamp(local,-core,core);
  vec2 radial=local-nearest;
  float radialLength=length(radial);
  if(radialLength>.0001){return radial/radialLength;}
  vec2 safeCore=max(core,vec2(1.0));
  vec2 sideRatio=abs(local)/safeCore;
  if(sideRatio.x>sideRatio.y){return vec2(local.x<0.0?-1.0:1.0,0.0);}
  return vec2(0.0,local.y<0.0?-1.0:1.0);
}

float bodyLensReach(vec2 z,float r){
  float requested=max(uBodyLensB.y,8.0);
  float curvatureSafe=max(r*.96,8.0);
  return min(requested,min(curvatureSafe,min(z.x,z.y)*.46));
}
float bodyLensWeight(float depth,vec2 z,float r){
  float reach=bodyLensReach(z,r);
  float x=sat(depth/max(reach,1.0));
  float smooth=x*x*(3.0-2.0*x);
  float concentration=mix(.58,1.82,sat((uBodyLensA.z+10.0)/20.0));
  return pow(1.0-smooth,concentration);
}
vec2 bodyRefractionFlow(vec2 p,vec2 n,vec2 z,float r,float depth,float weight){
  float rawPull=abs(uBodyLensA.y)*.052+abs(uBodyLensA.x)*.20+max(uBodyLensB.x,0.0)*.12;
  float core=pow(weight,1.28);
  float reach=bodyLensReach(z,r);
  float remaining=max(reach-depth,0.0);
  float displacement=remaining*(1.0-exp(-(rawPull*core)/max(remaining,1.0)))*.96;
  return -n*displacement;
}
float centerEnvelope(vec2 u){
  float width=sat((uBody.x-.18)/(1.5-.18));
  vec2 span=vec2(mix(.72,1.16,width),mix(.66,1.08,width));
  vec2 q=abs(u)/max(span,vec2(.001));
  return exp(-(pow(q.x,4.0)+pow(q.y,4.0)));
}
vec2 polynomialTransport(vec2 u){
  float curve=sat((uBody.y-.2)/3.0);
  float ky=mix(.10,.34,curve);
  float kx=mix(.08,.30,curve);
  float ay=mix(.24,.52,curve);
  float yRelax=mix(.18,.36,curve);
  float xBoost=mix(.10,.24,curve);
  vec2 transport=vec2(u.x*(1.0-ky*u.y*u.y),-ay*u.y*(1.0-kx*u.x*u.x));
  transport.x+=u.x*xBoost*(1.0-.58*u.y*u.y);
  transport.y+=u.y*yRelax*(1.0-.66*u.x*u.x);
  transport+=vec2(-u.y,u.x)*mix(.004,.020,curve);
  return transport;
}
vec2 centerTransport(vec2 p,vec2 z){
  vec2 u=(p-z*.5)/max(z*.5,vec2(1.0));
  float gain=sat(uBody.z/900.0);
  float curve=sat((uBody.y-.2)/3.0);
  float amplitude=min(z.x,z.y)*.5*gain*mix(.18,.46,curve);
  vec2 flow=polynomialTransport(u)*amplitude*centerEnvelope(u);
  return softLimit(flow,mix(52.0,118.0,gain));
}
vec2 evaluateBodyOpticalCoordAt(vec2 point,vec2 z,float r){
  float pointSd=boxSdf(point,z,r);
  float pointDepth=max(-pointSd,0.0);
  vec2 pointNormal=perimeterNormalAt(point,z,r);
  float pointWeight=bodyLensWeight(pointDepth,z,r);
  return point+bodyRefractionFlow(point,pointNormal,z,r,pointDepth,pointWeight)+centerTransport(point,z);
}
float shoulderWidth(vec2 z){return min(max(uShoulder.x,1.0),min(z.x,z.y)*.46);}
float shoulderCaptureWidth(vec2 z){
  float visible=shoulderWidth(z);
  float requested=max(uShoulderFlow.x,visible);
  return min(requested,min(z.x,z.y)*.46);
}
float shoulderX(float depth,vec2 z){return sat(depth/max(shoulderWidth(z),1.0));}
float shoulderOuterEnvelope(float depth,vec2 z){
  float x=shoulderX(depth,z);
  float exponent=mix(2.0,4.8,sat(uShoulder.z));
  return pow(max(1.0-x,0.0),exponent);
}
float shoulderMaterialFill(float depth,vec2 z){
  float x=shoulderX(depth,z);
  float exponent=mix(1.20,1.85,sat(uShoulder.z));
  return pow(max(1.0-x,0.0),exponent);
}
float shoulderMaxAngle(){return clamp(uShoulder.y,0.0,89.5)*.01745329252;}
float shoulderTheta(float depth,vec2 z){return shoulderMaxAngle()*shoulderOuterEnvelope(depth,z);}
vec2 unifiedInnerContourPoint(vec2 boundaryPoint,vec2 z){
  vec2 center=z*.5;
  vec2 halfSize=max(z*.5,vec2(1.0));
  float captureWidth=shoulderCaptureWidth(z);
  vec2 innerHalf=max(halfSize-vec2(captureWidth),vec2(1.0));
  vec2 normalized=(boundaryPoint-center)/halfSize;
  return center+normalized*innerHalf;
}
float shoulderTangentialSignal(vec2 p,vec2 edgeNormal,vec2 z){
  vec2 u=(p-z*.5)/max(z*.5,vec2(1.0));
  vec2 tangent=vec2(-edgeNormal.y,edgeNormal.x);
  vec2 contourVector=vec2(-u.y,u.x);
  float contourLength=length(contourVector);
  float contourSignal=0.0;
  if(contourLength>.0001){contourSignal=dot(contourVector/contourLength,tangent);}
  float bodySignal=dot(polynomialTransport(u),tangent);
  float mixed=.48*contourSignal+.52*bodySignal;
  return mixed/(.65+abs(mixed));
}
float shoulderTangentialTravel(vec2 p,vec2 edgeNormal,vec2 z,float depth){
  float captureWidth=shoulderCaptureWidth(z);
  float flowStrength=clamp(uShoulderFlow.y,0.0,2.4);
  float amplitude=captureWidth*.30*sat(flowStrength/2.4);
  float envelope=pow(shoulderOuterEnvelope(depth,z),.82);
  return amplitude*shoulderTangentialSignal(p,edgeNormal,z)*envelope;
}
vec4 evaluateShoulderSource(vec2 p,vec2 edgeNormal,vec2 z,float r,float depth){
  float visibleWidth=shoulderWidth(z);
  if(uShoulderEnabled<.5||depth>=visibleWidth){return vec4(p,0.0,0.0);}
  float envelope=shoulderOuterEnvelope(depth,z);
  float theta=shoulderTheta(depth,z);
  float tangentTravel=shoulderTangentialTravel(p,edgeNormal,z,depth);
  vec2 tangent=vec2(-edgeNormal.y,edgeNormal.x);
  vec2 boundaryPoint=p+edgeNormal*depth;
  vec2 innerContourPoint=unifiedInnerContourPoint(boundaryPoint,z);
  vec2 sourcePoint=mix(p,innerContourPoint,envelope)+tangent*tangentTravel;
  float sourceSd=boxSdf(sourcePoint,z,r);
  if(sourceSd>-.5){
    vec2 sourceNormal=perimeterNormalAt(sourcePoint,z,r);
    sourcePoint-=sourceNormal*(sourceSd+.5);
  }
  float f0=.04;
  float cosIncidence=cos(theta);
  float fresnel=f0+(1.0-f0)*pow(1.0-sat(cosIncidence),5.0);
  return vec4(sourcePoint,envelope,fresnel);
}
vec3 sampleBodyMaterial(vec2 uv,float bodyWeight){
  vec3 color=bodyBackdrop(uv);
  float opticalBoost=1.0+bodyWeight*.24;
  color*=uBody.w*uMat.z*opticalBoost;
  color-=vec3(.055,.065,.085)*uBodyLensB.z*bodyWeight;
  return color;
}
void main(){
  vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);
  vec2 z=uRes;
  float r=min(uRadius,min(z.x,z.y)*.5);
  float sd=boxSdf(p,z,r);
  float bodyMask=1.0-smoothstep(0.0,1.35,sd);
  if(bodyMask<=.001)discard;
  float depth=insideFromSdf(sd);
  vec2 normal=perimeterNormalAt(p,z,r);
  float bodyWeight=bodyLensWeight(depth,z,r);
  vec2 bodyOpticalCoord=p+bodyRefractionFlow(p,normal,z,r,depth,bodyWeight)+centerTransport(p,z);
  float materialWeight=bodyWeight;
  float shoulder=0.0;
  float shoulderFresnel=0.0;
  float width=shoulderWidth(z);
  if(uShoulderEnabled>.5&&depth<width){
    vec4 shoulderData=evaluateShoulderSource(p,normal,z,r,depth);
    vec2 sourcePoint=shoulderData.xy;
    shoulder=shoulderData.z;
    shoulderFresnel=shoulderData.w;
    float sourceDepth=max(-boxSdf(sourcePoint,z,r),0.0);
    materialWeight=bodyLensWeight(sourceDepth,z,r);
    bodyOpticalCoord=evaluateBodyOpticalCoordAt(sourcePoint,z,r);
  }
  vec3 color=sampleBodyMaterial(globalUv(bodyOpticalCoord),materialWeight);
  float strength=clamp(uShoulder.w,0.0,4.0);
  float fill=shoulderMaterialFill(depth,z);
  float outerRim=pow(shoulder,2.8);
  vec2 lightDirection=normalize(vec2(-.62,-.78));
  float lightFacing=pow(sat(dot(normal,lightDirection)),2.7);
  float volumeShadow=.014*strength*fill*(.30+.70*(1.0-lightFacing));
  color*=1.0-volumeShadow;
  float fillSheen=sat(.072*strength*fill*(.40+.60*lightFacing));
  vec3 filledColor=mix(color,vec3(.88,.96,1.0),.36);
  color=mix(color,filledColor,fillSheen);
  float reflection=sat(.21*strength*shoulderFresnel*outerRim*(.18+.82*lightFacing));
  vec3 reflectionColor=mix(color,vec3(.93,.98,1.0),.72);
  color=mix(color,reflectionColor,reflection);
  float alpha=bodyMask*sat(uMat.y*sat(uMat.x/20.0)*uIntensity);
  if(alpha<=.001)discard;
  gl_FragColor=vec4(clamp(color,0.0,1.0),sat(alpha));
}`;

  const localSource = document.createElement('canvas');
  const localSourceCtx = localSource.getContext('2d', { alpha: false });
  const colorCanvas = document.createElement('canvas');
  const colorCtx = colorCanvas.getContext('2d', { alpha: false });
  const blurA = document.createElement('canvas');
  const blurACtx = blurA.getContext('2d', { alpha: false });
  const blurB = document.createElement('canvas');
  const blurBCtx = blurB.getContext('2d', { alpha: false });
  const blurCanvas = document.createElement('canvas');
  const blurCtx = blurCanvas.getContext('2d', { alpha: false });
  const backdropCtx = backdropCanvas.getContext('2d', { alpha: true });

  let gl;
  let program;
  let buffer;
  let locations;
  let blurTexture;
  let visible = true;
  let lastCapture = -1e9;
  let lastRectKey = '';
  let failed = false;
  const CAPTURE_INTERVAL_MS = 1000 / 24;

  function setCanvasSize(canvas, width, height) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }

  function smoothContext(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true;
    try { ctx.imageSmoothingQuality = 'high'; } catch (_) {}
  }

  function shift(dst, src, width, height, step, horizontal) {
    smoothContext(dst);
    dst.clearRect(0, 0, width, height);
    dst.save();
    dst.globalCompositeOperation = 'lighter';
    dst.globalAlpha = 0.2;
    for (let i = -2; i <= 2; i += 1) {
      dst.drawImage(src, horizontal ? i * step : 0, horizontal ? 0 : i * step, width, height);
    }
    dst.restore();
    dst.save();
    dst.globalCompositeOperation = 'destination-over';
    dst.drawImage(src, 0, 0, width, height);
    dst.restore();
  }

  function blur(source, width, height, radius) {
    smoothContext(blurCtx);
    blurCtx.clearRect(0, 0, width, height);
    if (radius <= 0.025) {
      blurCtx.drawImage(source, 0, 0, width, height);
      return;
    }
    setCanvasSize(blurA, width, height);
    setCanvasSize(blurB, width, height);
    const passes = Math.max(1, Math.min(3, Math.ceil(params.blurIterations / 4)));
    const step = Math.max(0.25, radius / Math.sqrt(2 * passes));
    let current = source;
    for (let i = 0; i < passes; i += 1) {
      shift(blurACtx, current, width, height, step, true);
      shift(blurBCtx, blurA, width, height, step, false);
      current = blurB;
    }
    blurCtx.drawImage(current, 0, 0, width, height);
  }

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'Liquid glass shader compile failed');
    }
    return shader;
  }

  function initGl() {
    gl = opticsCanvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error('WebGL unavailable for liquid glass');
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexShader));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentShader));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Liquid glass program link failed');
    }
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const names = ['a', 'uRes', 'uOrigin', 'uRoot', 'uBlurTexture', 'uMat', 'uBodyLensA', 'uBodyLensB', 'uBody', 'uShoulder', 'uShoulderFlow', 'uShoulderEnabled', 'uRadius', 'uIntensity'];
    locations = {};
    for (const name of names) {
      locations[name] = name === 'a' ? gl.getAttribLocation(program, name) : gl.getUniformLocation(program, name);
    }
    blurTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, blurTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  function captureBackdrop() {
    const sourceRect = sourceCanvas.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    if (sourceRect.width <= 0 || sourceRect.height <= 0 || cardRect.width <= 0 || cardRect.height <= 0) return false;

    const quality = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(cardRect.width * quality));
    const height = Math.max(1, Math.round(cardRect.height * quality));
    const scaleX = sourceCanvas.width / sourceRect.width;
    const scaleY = sourceCanvas.height / sourceRect.height;
    const sx = Math.max(0, (cardRect.left - sourceRect.left) * scaleX);
    const sy = Math.max(0, (cardRect.top - sourceRect.top) * scaleY);
    const sw = Math.min(sourceCanvas.width - sx, cardRect.width * scaleX);
    const sh = Math.min(sourceCanvas.height - sy, cardRect.height * scaleY);
    if (sw <= 0 || sh <= 0) return false;

    for (const canvas of [localSource, colorCanvas, blurCanvas, backdropCanvas, opticsCanvas]) {
      setCanvasSize(canvas, width, height);
    }

    smoothContext(localSourceCtx);
    localSourceCtx.clearRect(0, 0, width, height);
    localSourceCtx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, width, height);

    smoothContext(colorCtx);
    colorCtx.clearRect(0, 0, width, height);
    colorCtx.save();
    colorCtx.filter = `brightness(${params.brightness}) contrast(${params.contrast}) saturate(${params.saturation})`;
    colorCtx.drawImage(localSource, 0, 0, width, height);
    colorCtx.restore();

    const effectiveBlur = Math.max(0, params.blurRadius * quality * Math.pow(Math.max(1, params.blurIterations), 0.55));
    blur(colorCanvas, width, height, effectiveBlur);

    smoothContext(backdropCtx);
    backdropCtx.clearRect(0, 0, width, height);
    backdropCtx.drawImage(blurCanvas, 0, 0, width, height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, blurTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, blurCanvas);
    return true;
  }

  function renderOptics() {
    const quality = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = opticsCanvas.width;
    const height = opticsCanvas.height;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(locations.a);
    gl.vertexAttribPointer(locations.a, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(locations.uRes, width, height);
    gl.uniform2f(locations.uOrigin, 0, 0);
    gl.uniform2f(locations.uRoot, width, height);
    gl.uniform1f(locations.uRadius, params.radius * quality);
    gl.uniform1f(locations.uIntensity, params.glassIntensity);
    gl.uniform4f(locations.uMat, params.bodyVisibility, params.bodyMaxAlpha, params.bodyOutputBrightness, 0);
    gl.uniform4f(locations.uBodyLensA, params.bodyLensBasePull * quality, params.bodyLensPullDp * quality, params.bodyLensConcentration, params.bodyLensCornerBoost);
    gl.uniform4f(locations.uBodyLensB, params.bodyLensExtraDistance * quality, params.bodyLensReachDp * quality, params.bodyLensDark, 0);
    gl.uniform4f(locations.uBody, params.bodyLowFrequencyWidth, params.bodyLowFrequencyCurve, params.bodyLowFrequencyGain, params.bodyBrightness);
    gl.uniform4f(locations.uShoulder, params.shoulderWidthPx * quality, params.shoulderMaxAngleDeg, params.shoulderFalloffRoundness, params.shoulderMaterialStrength);
    gl.uniform2f(locations.uShoulderFlow, params.shoulderCaptureWidthPx * quality, params.shoulderTangentialFlowStrength);
    gl.uniform1f(locations.uShoulderEnabled, 2);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, blurTexture);
    gl.uniform1i(locations.uBlurTexture, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function frame(now) {
    if (!failed && visible && !document.hidden && now - lastCapture >= CAPTURE_INTERVAL_MS) {
      const rect = card.getBoundingClientRect();
      const rectKey = `${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}:${Math.round(rect.height)}:${sourceCanvas.width}:${sourceCanvas.height}`;
      const layoutChanged = rectKey !== lastRectKey;
      if (layoutChanged || now - lastCapture >= CAPTURE_INTERVAL_MS) {
        try {
          if (captureBackdrop()) {
            renderOptics();
            lastCapture = now;
            lastRectKey = rectKey;
          }
        } catch (error) {
          failed = true;
          card.classList.add('liquid-glass--fallback');
          console.warn('[homepage-liquid-glass] falling back to shared CSS glass', error);
        }
      }
    }
    requestAnimationFrame(frame);
  }

  try {
    initGl();
    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
    }, { root: null, threshold: 0.01 });
    observer.observe(card);
    requestAnimationFrame(frame);
  } catch (error) {
    failed = true;
    card.classList.add('liquid-glass--fallback');
    console.warn('[homepage-liquid-glass] unavailable; using shared CSS glass', error);
  }
})();
