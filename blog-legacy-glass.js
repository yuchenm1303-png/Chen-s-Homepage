(() => {
  'use strict';

  const VERTEX_SHADER = `
    attribute vec2 aPosition;
    void main(){ gl_Position=vec4(aPosition,0.0,1.0); }
  `;

  /* Direct code-equivalent port of LegacyOpenGLGlassShader.kt. */
  const FRAGMENT_SHADER = `
    precision mediump float;
    uniform vec2 uResolution;
    uniform vec2 uCardOrigin;
    uniform vec2 uRootResolution;
    uniform vec4 uRect;
    uniform float uRadius;
    uniform vec4 uPress;
    uniform float uTextureReady;
    uniform vec4 uMaterial;
    uniform vec4 uRefraction;
    uniform vec4 uOptics;
    uniform sampler2D uBlurTexture;
    uniform sampler2D uLensTexture;

    float sat(float x){return clamp(x,0.0,1.0);}

    float roundedBoxSdfPrepared(vec2 coord,vec2 halfSize,vec2 core,float radius){
      vec2 q=abs(coord-halfSize)-core;
      return length(max(q,0.0))+min(max(q.x,q.y),0.0)-radius;
    }

    vec2 perimeterNormalPrepared(vec2 coord,vec2 halfSize,vec2 core){
      vec2 local=coord-halfSize;
      vec2 nearest=clamp(local,-core,core);
      vec2 radial=local-nearest;
      float radialLength=length(radial);
      if(radialLength>0.0001){return radial/radialLength;}
      vec2 safeCore=max(core,vec2(1.0));
      vec2 sideRatio=abs(local)/safeCore;
      if(sideRatio.x>sideRatio.y){return vec2(local.x<0.0?-1.0:1.0,0.0);}
      return vec2(0.0,local.y<0.0?-1.0:1.0);
    }

    vec2 globalUvAt(vec2 visualCoord,vec2 rootInv){
      return clamp((uCardOrigin+visualCoord)*rootInv,0.0,1.0);
    }

    vec3 fallbackBackdrop(vec2 uv){
      float h=smoothstep(0.0,1.0,uv.y);
      return mix(vec3(0.12,0.22,0.38),vec3(0.36,0.50,0.72),h);
    }

    vec3 sourceBlurBackdrop(vec2 uv){
      vec2 safeUv=clamp(uv,0.0,1.0);
      if(uTextureReady<0.5){return fallbackBackdrop(safeUv);}
      return texture2D(uBlurTexture,safeUv).rgb;
    }

    vec3 sourceLensBackdrop(vec2 uv){
      vec2 safeUv=clamp(uv,0.0,1.0);
      if(uTextureReady<0.5){return fallbackBackdrop(safeUv);}
      return texture2D(uLensTexture,safeUv).rgb;
    }

    vec3 blurBackdrop(vec2 uv,float edgeWeight,vec2 rootInv){
      float sampleRadius=uOptics.x;
      if(sampleRadius<=0.50){return sourceBlurBackdrop(uv);}
      float blurBoost=1.0+edgeWeight*0.38;
      vec2 px=vec2(sampleRadius*blurBoost)*rootInv;
      vec3 c=sourceBlurBackdrop(uv)*0.200;
      c+=sourceBlurBackdrop(uv+vec2(px.x,0.0))*0.110;
      c+=sourceBlurBackdrop(uv-vec2(px.x,0.0))*0.110;
      c+=sourceBlurBackdrop(uv+vec2(0.0,px.y))*0.110;
      c+=sourceBlurBackdrop(uv-vec2(0.0,px.y))*0.110;
      c+=sourceBlurBackdrop(uv+px)*0.090;
      c+=sourceBlurBackdrop(uv+vec2(-px.x,px.y))*0.090;
      c+=sourceBlurBackdrop(uv+vec2(px.x,-px.y))*0.090;
      c+=sourceBlurBackdrop(uv-px)*0.090;
      return c;
    }

    float rimWideFromInside(float inside,float edgeWidth){
      return 1.0-smoothstep(0.0,edgeWidth,inside);
    }

    float rimCoreFromInside(float inside,float coreWidth){
      return 1.0-smoothstep(0.0,coreWidth,inside);
    }

    float dragBandFromInside(float inside,float dragWidth){
      return pow(1.0-smoothstep(0.0,dragWidth,inside),1.35);
    }

    float bodyDomeAt(vec2 coord,vec2 rectInv,float domeAspect){
      vec2 local=clamp(coord*rectInv,0.0,1.0);
      vec2 p=local*2.0-1.0;
      p.x*=domeAspect;
      float d=length(p);
      return pow(sat(1.0-d*0.74),1.65);
    }

    float thicknessAt(vec2 coord,vec2 halfSize,vec2 core,vec2 rectInv,float radius,float edgeWidth,float coreWidth,float domeAspect){
      float sd=roundedBoxSdfPrepared(coord,halfSize,core,radius);
      float inside=max(-sd,0.0);
      float maskGuard=1.0-smoothstep(1.5,16.0,sd);
      float rimWide=rimWideFromInside(inside,edgeWidth);
      float rimCore=rimCoreFromInside(inside,coreWidth);
      float dome=bodyDomeAt(coord,rectInv,domeAspect);
      return (dome*0.22+rimWide*0.46+rimCore*0.34)*maskGuard;
    }

    float pressFieldAt(vec2 coord,vec2 rectInv,vec2 center,float aspect,float press){
      vec2 delta=clamp(coord*rectInv,0.0,1.0)-center;
      delta.x*=aspect;
      float d=length(delta);
      return pow(sat(1.0-d*0.92),1.45)*press;
    }

    vec2 softLimitPx(vec2 v,float limitPx){
      float len=length(v);
      float softLen=len/(1.0+len/max(limitPx,1.0));
      return v*(softLen/max(len,0.0001));
    }

    float colorSignal(vec3 c){
      float luma=dot(c,vec3(0.299,0.587,0.114));
      float chroma=length(c-vec3(luma));
      return sat((luma-0.20)*1.25+chroma*1.55);
    }

    vec3 edgeColorDrag(vec2 coord,vec2 halfSize,vec2 coreGeometry,float band,float core,float edgeWidth,vec2 rootInv){
      vec2 n=perimeterNormalPrepared(coord,halfSize,coreGeometry);
      vec2 t=vec2(-n.y,n.x);
      float pull=clamp(8.0+abs(uRefraction.y)*0.030,8.0,42.0);
      float smear=clamp(4.0+edgeWidth*0.55,4.0,22.0);
      vec2 baseIn=coord-n*pull;
      vec2 baseFar=coord-n*(pull*1.85);
      vec2 baseOut=coord+n*(pull*0.45);
      vec2 smearNear=t*smear;
      vec2 smearFar=smearNear*1.85;
      vec3 c=sourceLensBackdrop(globalUvAt(baseIn,rootInv))*0.28;
      c+=sourceLensBackdrop(globalUvAt(baseFar,rootInv))*0.18;
      c+=sourceLensBackdrop(globalUvAt(baseOut,rootInv))*0.12;
      c+=sourceLensBackdrop(globalUvAt(baseIn+smearNear,rootInv))*0.14;
      c+=sourceLensBackdrop(globalUvAt(baseIn-smearNear,rootInv))*0.14;
      c+=sourceLensBackdrop(globalUvAt(baseIn+smearFar,rootInv))*0.07;
      c+=sourceLensBackdrop(globalUvAt(baseIn-smearFar,rootInv))*0.07;
      vec3 soft=blurBackdrop(globalUvAt(baseIn,rootInv),band,rootInv)*0.45+c*0.55;
      float signal=colorSignal(c);
      float dragAlpha=band*(0.035+sat(max(uRefraction.z,0.0))*0.105+core*0.030)*signal;
      return mix(vec3(0.0),soft,sat(dragAlpha));
    }

    void main(){
      vec2 coord=vec2(gl_FragCoord.x,uResolution.y-gl_FragCoord.y);
      vec2 rectSize=max(uRect.zw,vec2(1.0));
      vec2 rectInv=1.0/rectSize;
      vec2 halfSize=rectSize*0.5;
      vec2 visualCoord=coord-uRect.xy;
      float minSize=min(rectSize.x,rectSize.y);
      float radius=min(uRadius,minSize*0.5);
      vec2 coreGeometry=max(halfSize-vec2(radius),vec2(0.0));
      float sd=roundedBoxSdfPrepared(visualCoord,halfSize,coreGeometry,radius);
      float mask=1.0-smoothstep(0.0,1.35,sd);
      if(mask<=0.001)discard;

      vec2 rootInv=1.0/max(uRootResolution,vec2(1.0));
      float edgeWidth=clamp(uOptics.y,6.0,minSize*0.34);
      float coreWidth=max(edgeWidth*0.28,3.0);
      float dragWidth=max(edgeWidth*1.45,8.0);
      float rectAspect=rectSize.x/rectSize.y;
      float aspect=min(rectAspect,2.2);
      float domeAspect=min(rectAspect,2.4)*0.38;

      float press=uPress.x;
      vec2 pressCenter=uPress.yz;
      vec2 pressCenterPx=pressCenter*rectSize;
      float pressField=0.0;
      float pressWide=0.0;
      vec2 inwardPx=vec2(0.0);
      vec2 pressDimplePx=vec2(0.0);
      if(press>0.0){
        pressField=pressFieldAt(visualCoord,rectInv,pressCenter,aspect,press);
        pressWide=press*pow(sat(1.0-length((visualCoord*rectInv-pressCenter)*vec2(aspect,1.0))*0.58),1.25);
        inwardPx=softLimitPx((pressCenterPx-visualCoord)*(0.028*press+0.070*pressField),24.0+press*18.0);
        vec2 pressDelta=visualCoord-pressCenterPx;
        vec2 pressDir=pressDelta/max(length(pressDelta),0.001);
        pressDimplePx=-pressDir*pressField*(8.0+press*10.0);
      }

      vec2 pressedCoord=visualCoord+inwardPx;
      vec2 bgUv=globalUvAt(pressedCoord,rootInv);
      float stepPx=2.0;
      float tL=thicknessAt(visualCoord-vec2(stepPx,0.0),halfSize,coreGeometry,rectInv,radius,edgeWidth,coreWidth,domeAspect);
      float tR=thicknessAt(visualCoord+vec2(stepPx,0.0),halfSize,coreGeometry,rectInv,radius,edgeWidth,coreWidth,domeAspect);
      float tU=thicknessAt(visualCoord-vec2(0.0,stepPx),halfSize,coreGeometry,rectInv,radius,edgeWidth,coreWidth,domeAspect);
      float tD=thicknessAt(visualCoord+vec2(0.0,stepPx),halfSize,coreGeometry,rectInv,radius,edgeWidth,coreWidth,domeAspect);
      vec2 grad=vec2(tR-tL,tD-tU);

      float inside=max(-sd,0.0);
      float rimWide=rimWideFromInside(inside,edgeWidth);
      float rimCore=rimCoreFromInside(inside,coreWidth);
      float dragBand=dragBandFromInside(inside,dragWidth);
      float gLen=length(grad);
      float gradGate=smoothstep(0.0004,0.012,gLen);
      float gradScale=gradGate*min(1.0,0.22/max(gLen,0.0001));
      grad*=gradScale;
      float gradEnergy=sat(gLen*gradScale*uRefraction.w);

      vec2 rawRefractPx=grad*(uRefraction.x+uRefraction.y*rimWide+press*(26.0+52.0*pressField))*max(uMaterial.x,0.0);
      rawRefractPx+=pressDimplePx;
      rawRefractPx+=inwardPx*(0.76+0.46*rimWide);
      float limitPx=mix(18.0,62.0,rimWide)+sat(abs(uRefraction.y)/600.0)*16.0+press*20.0;
      vec2 refractPx=softLimitPx(rawRefractPx,limitPx);
      vec2 refractedUv=bgUv+refractPx*rootInv;

      vec3 color=blurBackdrop(refractedUv,rimWide+pressField*0.85+pressWide*0.22,rootInv);
      vec3 lensColor=sourceLensBackdrop(refractedUv);
      float lensMix=sat(rimCore*max(uRefraction.z,0.0)*0.42+pressField*0.220+pressWide*0.075);
      color=mix(color,lensColor,lensMix);

      float dragAmount=dragBand+press*rimWide*0.32+pressField*0.18;
      if(dragAmount>0.002){
        vec3 dragColor=edgeColorDrag(visualCoord+inwardPx*0.72,halfSize,coreGeometry,dragAmount,rimCore,edgeWidth,rootInv);
        float dragMix=sat(max(max(dragColor.r,dragColor.g),dragColor.b));
        color=mix(color,dragColor,dragMix);
      }

      float rimOpticalBoost=rimCore*0.16+gradEnergy*0.045+press*rimCore*0.080+pressField*0.040;
      color*=uMaterial.z*(1.0+rimOpticalBoost);
      color*=1.0-pressField*0.070-pressWide*0.025;
      color+=vec3(0.018,0.035,0.046)*pressField*0.38;
      if(uOptics.z>0.0){
        float debugEdge=smoothstep(-1.65,0.0,sd)*mask;
        color=mix(color,vec3(1.0,0.45,0.0),debugEdge*uOptics.z);
      }
      color-=vec3(0.06,0.07,0.09)*uOptics.w*rimWide;
      color=clamp(color,0.0,1.0);
      float finalAlpha=clamp(uMaterial.y*uMaterial.x,0.0,1.0)*mask;
      gl_FragColor=vec4(color,finalAlpha);
    }
  `;

  const STYLE = Object.freeze({
    ringWidth: 8.295,
    edgePull: -199.078,
    edgeBrightness: 1.083,
    visibility: 19.954,
    maxAlpha: 1,
    pullScale: -5.53,
    compressionScale: -10,
    cornerScale: 54.378,
    darkScale: -2.21,
    sampleRadius: 66.359,
    debugAlpha: 0,
  });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const smoothStep = (value) => {
    const x = clamp(value, 0, 1);
    return x * x * (3 - 2 * x);
  };

  function cubicBezier(x1, y1, x2, y2) {
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;
    const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
    const sampleY = (t) => ((ay * t + by) * t + cy) * t;
    const sampleDx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      let t = clamp(x, 0, 1);
      for (let index = 0; index < 7; index += 1) {
        const derivative = sampleDx(t);
        if (Math.abs(derivative) < 1e-7) break;
        t = clamp(t - (sampleX(t) - x) / derivative, 0, 1);
      }
      return sampleY(t);
    };
  }

  const EASE = Object.freeze({
    fastOutSlowIn: cubicBezier(0.40, 0.00, 0.20, 1.00),
    press: cubicBezier(0.12, 0.00, 0.08, 1.00),
    sink: cubicBezier(0.10, 0.00, 0.08, 1.00),
    release: cubicBezier(0.14, 0.00, 0.12, 1.00),
  });
  const STIFFNESS = Object.freeze({ low: 200, mediumLow: 400 });
  const tweenStep = (target, duration, easing) => ({ type: 'tween', target, duration, easing });
  const springStep = (target, dampingRatio, stiffness) => ({ type: 'spring', target, dampingRatio, stiffness });

  function elasticityFor(element) {
    const rect = element.getBoundingClientRect();
    const w = Math.max(rect.width, 1);
    const h = Math.max(rect.height, 1);
    const shortSide = Math.min(w, h);
    const longSide = Math.max(w, h);
    const areaSide = Math.sqrt(w * h);
    const aspect = longSide / shortSide;
    const invSmooth = (x) => 1 - smoothStep(clamp(x, 0, 1));
    const smallHeight = invSmooth((h - 48) / 150);
    const smallShort = invSmooth((shortSide - 52) / 170);
    const smallArea = invSmooth((areaSide - 104) / 310);
    const smallness = clamp(smallHeight * 0.56 + smallShort * 0.24 + smallArea * 0.20, 0, 1);
    const compactHeight = invSmooth((h - 76) / 132);
    const rowness = clamp(smoothStep(clamp((aspect - 2.10) / 4.30, 0, 1)) * compactHeight, 0, 1);
    const heightDamp = clamp((270 - h) / 220, 0.0457, 1.50);
    const areaDamp = clamp((520 - areaSide) / 460, 0.0437, 1.50);
    const bodyRaw = 1.10 * heightDamp * areaDamp * (1 + smallness * 16) * (1 - rowness * 0.958) * 10.631;
    return clamp(bodyRaw, 0.10, 0.11);
  }

  function makeState(element) {
    return {
      element,
      material: 0,
      lens: 0,
      sweep: 0,
      centerX: 0.5,
      centerY: 0.5,
      pointerId: null,
      animations: new Map(),
    };
  }

  class BlogLegacyGlassEngine {
    constructor() {
      this.canvas = document.createElement('canvas');
      this.gl = this.canvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
      });
      this.program = null;
      this.locations = null;
      this.buffer = null;
      this.texture = null;
      this.textureSource = null;
      this.states = [];
      this.cleanup = [];
      this.requestParentRender = () => {};
    }

    initialise() {
      if (!this.gl) return false;
      const gl = this.gl;
      const vertex = this.compile(gl.VERTEX_SHADER, VERTEX_SHADER);
      const fragment = this.compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      if (!vertex || !fragment) return false;
      const program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
      this.program = program;
      const attributes = ['aPosition'];
      const uniforms = [
        'uResolution', 'uCardOrigin', 'uRootResolution', 'uRect', 'uRadius',
        'uPress', 'uTextureReady', 'uMaterial', 'uRefraction', 'uOptics',
        'uBlurTexture', 'uLensTexture',
      ];
      this.locations = {};
      attributes.forEach((name) => { this.locations[name] = gl.getAttribLocation(program, name); });
      uniforms.forEach((name) => { this.locations[name] = gl.getUniformLocation(program, name); });
      if (this.locations.aPosition < 0 || uniforms.some((name) => this.locations[name] === null)) return false;
      this.buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
      gl.useProgram(program);
      gl.enableVertexAttribArray(this.locations.aPosition);
      gl.vertexAttribPointer(this.locations.aPosition, 2, gl.FLOAT, false, 0, 0);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      this.texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(this.locations.uBlurTexture, 0);
      gl.uniform1i(this.locations.uLensTexture, 0);
      return true;
    }

    compile(type, source) {
      const gl = this.gl;
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('Legacy app glass shader compile failed:', gl.getShaderInfoLog(shader));
        return null;
      }
      return shader;
    }

    bind(elements, requestParentRender) {
      this.detach();
      this.requestParentRender = requestParentRender || (() => {});
      this.states = [...elements].map(makeState);
      this.states.forEach((state) => this.attachInteraction(state));
    }

    detach() {
      this.cleanup.splice(0).forEach((remove) => remove());
      this.states.forEach((state) => {
        state.element.style.transform = '';
        state.element.style.transformOrigin = '';
      });
      this.states = [];
    }

    attachInteraction(state) {
      const element = state.element;
      const updateCenter = (event) => {
        const rect = element.getBoundingClientRect();
        state.centerX = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
        state.centerY = clamp((event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1);
      };
      const down = (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        state.pointerId = event.pointerId;
        updateCenter(event);
        this.beginPress(state);
      };
      const move = (event) => {
        if (state.pointerId !== event.pointerId) return;
        updateCenter(event);
        this.requestParentRender();
      };
      const up = (event) => {
        if (state.pointerId !== event.pointerId) return;
        updateCenter(event);
        state.pointerId = null;
        this.endPress(state);
      };
      element.addEventListener('pointerdown', down, { passive: true });
      window.addEventListener('pointermove', move, { passive: true });
      window.addEventListener('pointerup', up, { passive: true });
      window.addEventListener('pointercancel', up, { passive: true });
      this.cleanup.push(() => element.removeEventListener('pointerdown', down));
      this.cleanup.push(() => window.removeEventListener('pointermove', move));
      this.cleanup.push(() => window.removeEventListener('pointerup', up));
      this.cleanup.push(() => window.removeEventListener('pointercancel', up));
    }

    beginPress(state) {
      state.animations.clear();
      if (state.material < 0.22) state.material = 0.22;
      if (state.lens < 0.18) state.lens = 0.18;
      state.sweep = 0;
      this.setSequence(state, 'material', [
        tweenStep(0.92, 132, EASE.press),
        tweenStep(1.10, 210, EASE.sink),
        springStep(0.94, 0.72, STIFFNESS.mediumLow),
      ]);
      this.setSequence(state, 'lens', [
        tweenStep(0.78, 150, EASE.press),
        tweenStep(1.04, 330, EASE.fastOutSlowIn),
      ]);
      this.setSequence(state, 'sweep', [tweenStep(1.18, 520, EASE.fastOutSlowIn)]);
      this.requestParentRender();
    }

    endPress(state) {
      state.animations.clear();
      this.setSequence(state, 'material', [
        tweenStep(-0.145, 130, EASE.release),
        springStep(0.060, 0.50, STIFFNESS.mediumLow),
        springStep(0, 0.72, STIFFNESS.low),
      ]);
      this.setSequence(state, 'lens', [
        tweenStep(0.42, 180, EASE.release),
        tweenStep(0, 480, EASE.fastOutSlowIn),
      ]);
      this.setSequence(state, 'sweep', [
        tweenStep(0.18, 260, EASE.fastOutSlowIn),
        tweenStep(0, 420, EASE.fastOutSlowIn),
      ]);
      this.requestParentRender();
    }

    setSequence(state, property, steps) {
      state.animations.set(property, {
        property,
        steps,
        index: 0,
        from: state[property],
        started: performance.now(),
        velocity: 0,
      });
    }

    update(time, delta) {
      let active = false;
      this.states.forEach((state) => {
        for (const [property, animation] of [...state.animations]) {
          const step = animation.steps[animation.index];
          if (!step) {
            state.animations.delete(property);
            continue;
          }
          active = true;
          if (step.type === 'tween') {
            const progress = clamp((time - animation.started) / step.duration, 0, 1);
            state[property] = animation.from + (step.target - animation.from) * step.easing(progress);
            if (progress >= 1) this.advance(state, animation, time);
          } else {
            const damping = 2 * step.dampingRatio * Math.sqrt(step.stiffness);
            const acceleration = -step.stiffness * (state[property] - step.target) - damping * animation.velocity;
            animation.velocity += acceleration * delta;
            state[property] += animation.velocity * delta;
            if (Math.abs(state[property] - step.target) < 0.0012 && Math.abs(animation.velocity) < 0.004) {
              state[property] = step.target;
              this.advance(state, animation, time);
            }
          }
        }
        this.applyTransform(state);
      });
      return active;
    }

    advance(state, animation, time) {
      animation.index += 1;
      const next = animation.steps[animation.index];
      if (!next) {
        state.animations.delete(animation.property);
        return;
      }
      animation.from = state[animation.property];
      animation.started = time;
      animation.velocity = 0;
    }

    dynamic(state) {
      const positive = Math.max(state.material, 0);
      const rebound = smoothStep(clamp(-state.material / 0.18, 0, 1));
      const compression = smoothStep(clamp(positive / 0.94, 0, 1));
      return {
        rebound,
        compression,
        press: clamp(Math.max(positive, state.lens * 0.86, rebound * 0.28), 0, 1),
      };
    }

    applyTransform(state) {
      const dynamic = this.dynamic(state);
      const elasticity = elasticityFor(state.element);
      const scaleX = 1 + dynamic.compression * (0.006 + 0.049 * elasticity) - dynamic.rebound * 0.018 * elasticity;
      const scaleY = 1 - dynamic.compression * (0.010 + 0.064 * elasticity) + dynamic.rebound * 0.030 * elasticity;
      const translateY = dynamic.compression * (0.70 + 3.90 * elasticity) - dynamic.rebound * 1.55 * elasticity;
      state.element.style.transformOrigin = `${state.centerX * 100}% ${state.centerY * 100}%`;
      state.element.style.transform = `translateY(${translateY}px) scale(${scaleX}, ${scaleY})`;
    }

    uploadTexture(source) {
      if (!source || this.textureSource === source) return;
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      this.textureSource = source;
    }

    render(output, dpr, rootWidth, rootHeight, blurSource) {
      if (!this.program) return;
      this.uploadTexture(blurSource);
      const gl = this.gl;
      this.states.forEach((state) => {
        const rect = state.element.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2 || rect.bottom < 0 || rect.top > innerHeight) return;
        const width = Math.max(1, Math.round(rect.width * dpr));
        const height = Math.max(1, Math.round(rect.height * dpr));
        if (this.canvas.width !== width) this.canvas.width = width;
        if (this.canvas.height !== height) this.canvas.height = height;
        gl.viewport(0, 0, width, height);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(this.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.enableVertexAttribArray(this.locations.aPosition);
        gl.vertexAttribPointer(this.locations.aPosition, 2, gl.FLOAT, false, 0, 0);
        const radiusCss = parseFloat(getComputedStyle(state.element).borderTopLeftRadius) || 19;
        const radius = Math.min(radiusCss * dpr, Math.min(width, height) * 0.5);
        const dynamic = this.dynamic(state);
        gl.uniform2f(this.locations.uResolution, width, height);
        gl.uniform2f(this.locations.uCardOrigin, rect.left * dpr, rect.top * dpr);
        gl.uniform2f(this.locations.uRootResolution, rootWidth, rootHeight);
        gl.uniform4f(this.locations.uRect, 0, 0, width, height);
        gl.uniform1f(this.locations.uRadius, radius);
        gl.uniform4f(this.locations.uPress, dynamic.press, state.centerX, state.centerY, 0);
        gl.uniform1f(this.locations.uTextureReady, 1);
        gl.uniform4f(this.locations.uMaterial, STYLE.visibility, STYLE.maxAlpha, STYLE.edgeBrightness, 0);
        gl.uniform4f(this.locations.uRefraction, STYLE.pullScale, STYLE.edgePull, STYLE.compressionScale, STYLE.cornerScale);
        gl.uniform4f(this.locations.uOptics, STYLE.sampleRadius, STYLE.ringWidth, STYLE.debugAlpha, STYLE.darkScale);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        output.drawImage(this.canvas, Math.round(rect.left * dpr), Math.round(rect.top * dpr), width, height);
      });
    }
  }

  window.BlogLegacyGlassEngine = BlogLegacyGlassEngine;
})();
