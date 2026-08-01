(() => {
  'use strict';

  const vs = `
    attribute vec2 aPosition;
    void main(){ gl_Position=vec4(aPosition,0.0,1.0); }
  `;

  const fs = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform vec2 uResolution;
    uniform vec2 uCardOrigin;
    uniform vec2 uRootResolution;
    uniform vec4 uRect;
    uniform sampler2D uClearTexture;
    uniform sampler2D uBlurLowTexture;
    uniform sampler2D uBlurMediumTexture;
    uniform sampler2D uBlurHighTexture;
    uniform vec4 uMaterial;
    uniform vec4 uBodyLensA;
    uniform vec4 uBodyLensB;
    uniform vec4 uBody;
    uniform vec4 uShoulder;
    uniform vec2 uShoulderFlow;
    uniform vec4 uDispersion;
    uniform float uRadius;
    uniform float uIntensity;
    uniform float uTextureReady;
    uniform float uBlurAmount;
    uniform float uOpticalScale;
    uniform vec4 uPress;

    float glassOpticalScale(){
      return uOpticalScale>0.0?clamp(uOpticalScale,0.28,1.0):1.0;
    }
    vec4 glassBodyLensA(){
      float scale=glassOpticalScale();
      return vec4(uBodyLensA.x*scale,uBodyLensA.y*scale,uBodyLensA.z,uBodyLensA.w);
    }
    vec4 glassBodyLensB(){
      float scale=glassOpticalScale();
      return vec4(uBodyLensB.x*scale,uBodyLensB.y*scale,uBodyLensB.z,uBodyLensB.w);
    }
    vec4 glassShoulder(){
      float scale=glassOpticalScale();
      return vec4(uShoulder.x*scale,uShoulder.y,uShoulder.z,uShoulder.w);
    }
    vec2 glassShoulderFlow(){
      float scale=glassOpticalScale();
      return vec2(uShoulderFlow.x*scale,uShoulderFlow.y);
    }
    vec4 glassDispersion(){
      float scale=glassOpticalScale();
      return vec4(uDispersion.x,uDispersion.y*scale,uDispersion.z*scale,uDispersion.w);
    }
    float sat(float x){return clamp(x,0.0,1.0);}
    float roundedBoxSdfPrepared(vec2 p,vec2 halfSize,vec2 core,float r){
      vec2 q=abs(p-halfSize)-core;
      return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r;
    }
    float insideFromSdf(float sdf){return max(-sdf,0.0);}
    vec2 globalUvAt(vec2 p,vec2 rootInv,vec2 texel){
      return clamp((uCardOrigin+p)*rootInv,texel,1.0-texel);
    }
    vec3 fallbackBackdrop(vec2 uv){
      float h=smoothstep(0.0,1.0,uv.y);
      return mix(vec3(0.12,0.22,0.38),vec3(0.36,0.50,0.72),h);
    }
    vec3 clearBackdrop(vec2 safeUv){
      if(uTextureReady<0.5){return fallbackBackdrop(safeUv);}
      return texture2D(uClearTexture,safeUv).rgb;
    }
    vec3 blurPyramidBackdropAt(vec2 safeUv,float requestedAmount){
      if(uTextureReady<0.5){return fallbackBackdrop(safeUv);}
      float amount=clamp(requestedAmount,0.0,4.0);
      if(amount<=0.001){return texture2D(uClearTexture,safeUv).rgb;}
      if(amount<1.0){
        vec3 clearColor=texture2D(uClearTexture,safeUv).rgb;
        vec3 lowColor=texture2D(uBlurLowTexture,safeUv).rgb;
        return mix(clearColor,lowColor,amount);
      }
      if(amount<2.0){
        vec3 lowColor=texture2D(uBlurLowTexture,safeUv).rgb;
        vec3 mediumColor=texture2D(uBlurMediumTexture,safeUv).rgb;
        return mix(lowColor,mediumColor,amount-1.0);
      }
      vec3 mediumColor=texture2D(uBlurMediumTexture,safeUv).rgb;
      vec3 highColor=texture2D(uBlurHighTexture,safeUv).rgb;
      return mix(mediumColor,highColor,(amount-2.0)*0.5);
    }
    vec2 softLimit(vec2 v,float limitPx){
      float len=length(v);
      float softLen=len/(1.0+len/max(limitPx,1.0));
      return v*(softLen/max(len,0.0001));
    }
    vec2 perimeterNormalPrepared(vec2 p,vec2 halfSize,vec2 core){
      vec2 local=p-halfSize;
      vec2 nearest=clamp(local,-core,core);
      vec2 radial=local-nearest;
      float radialLength=length(radial);
      if(radialLength>0.0001){return radial/radialLength;}
      vec2 safeCore=max(core,vec2(1.0));
      vec2 sideRatio=abs(local)/safeCore;
      if(sideRatio.x>sideRatio.y){return vec2(local.x<0.0?-1.0:1.0,0.0);}
      return vec2(0.0,local.y<0.0?-1.0:1.0);
    }
    float bodyLensReach(float minSize,float r){
      float requested=max(glassBodyLensB().y,8.0);
      float curvatureSafe=max(r*0.96,8.0);
      return min(requested,min(curvatureSafe,minSize*0.46));
    }
    float bodyLensWeightAtReach(float depth,vec3 lensParams){
      float x=sat(depth/max(lensParams.x,1.0));
      float smooth=x*x*(3.0-2.0*x);
      return pow(1.0-smooth,lensParams.y);
    }
    vec2 bodyRefractionFlow(vec2 normal,float depth,float weight,vec3 lensParams){
      float core=pow(weight,1.28);
      float remaining=max(lensParams.x-depth,0.0);
      float displacement=remaining*(1.0-exp(-(lensParams.z*core)/max(remaining,1.0)))*0.96;
      return -normal*displacement;
    }
    float centerEnvelope(vec2 u,float width){
      vec2 span=vec2(mix(0.72,1.16,width),mix(0.66,1.08,width));
      vec2 q=abs(u)/max(span,vec2(0.001));
      vec2 q2=q*q;
      return exp(-(q2.x*q2.x+q2.y*q2.y));
    }
    vec2 polynomialTransport(vec2 u,float curve){
      vec2 u2=u*u;
      float ky=mix(0.10,0.34,curve);
      float kx=mix(0.08,0.30,curve);
      float ay=mix(0.24,0.52,curve);
      float yRelax=mix(0.18,0.36,curve);
      float xBoost=mix(0.10,0.24,curve);
      vec2 transport=vec2(u.x*(1.0-ky*u2.y),-ay*u.y*(1.0-kx*u2.x));
      transport.x+=u.x*xBoost*(1.0-0.58*u2.y);
      transport.y+=u.y*yRelax*(1.0-0.66*u2.x);
      transport+=vec2(-u.y,u.x)*mix(0.004,0.020,curve);
      return transport;
    }
    vec2 centerTransport(vec2 p,vec2 center,vec2 invSafeCenter,float minSize,vec3 transportParams){
      vec2 u=(p-center)*invSafeCenter;
      float amplitude=minSize*0.5*transportParams.z*mix(0.18,0.46,transportParams.y);
      vec2 flow=polynomialTransport(u,transportParams.y)*amplitude*centerEnvelope(u,transportParams.x);
      return softLimit(flow,mix(52.0,118.0,transportParams.z));
    }
    float pressFieldAt(vec2 coord,vec2 rectInv,vec2 center,float aspect,float press){
      vec2 delta=clamp(coord*rectInv,0.0,1.0)-center;
      delta.x*=aspect;
      float d=length(delta);
      return pow(sat(1.0-d*0.92),1.45)*press;
    }
    float shoulderWidth(float minSize){return min(max(glassShoulder().x,1.0),minSize*0.46);}
    float shoulderCaptureWidth(float visibleWidth,float minSize){return min(max(glassShoulderFlow().x,visibleWidth),minSize*0.46);}
    float shoulderOuterEnvelopeAtX(float x){
      float exponent=mix(2.0,4.8,glassShoulder().z);
      return pow(max(1.0-x,0.0),exponent);
    }
    float shoulderMaterialFillAtX(float x){
      float exponent=mix(1.20,1.85,glassShoulder().z);
      return pow(max(1.0-x,0.0),exponent);
    }
    vec2 unifiedInnerContourPoint(vec2 boundaryPoint,vec2 center,vec2 safeHalfSize,vec2 invSafeCenter,float captureWidth){
      vec2 innerHalf=max(safeHalfSize-vec2(captureWidth),vec2(1.0));
      vec2 normalized=(boundaryPoint-center)*invSafeCenter;
      return center+normalized*innerHalf;
    }
    float shoulderTangentialSignal(vec2 p,vec2 tangent,vec2 center,vec2 invSafeCenter,float bodyCurve){
      vec2 u=(p-center)*invSafeCenter;
      vec2 contourVector=vec2(-u.y,u.x);
      float contourLength=length(contourVector);
      float contourSignal=0.0;
      if(contourLength>0.0001){contourSignal=dot(contourVector/contourLength,tangent);}
      float bodySignal=dot(polynomialTransport(u,bodyCurve),tangent);
      float mixed=0.48*contourSignal+0.52*bodySignal;
      return mixed/(0.65+abs(mixed));
    }
    float shoulderTangentialTravel(vec2 p,vec2 tangent,vec2 center,vec2 invSafeCenter,float captureWidth,float envelope,float bodyCurve){
      float flowStrength=glassShoulderFlow().y;
      if(flowStrength<=0.0001){return 0.0;}
      float amplitude=captureWidth*0.30*(flowStrength/2.4);
      return amplitude*shoulderTangentialSignal(p,tangent,center,invSafeCenter,bodyCurve)*pow(envelope,0.82);
    }
    vec4 evaluateShoulderSource(vec2 p,vec2 edgeNormal,vec2 center,vec2 safeHalfSize,vec2 sdfCore,vec2 invSafeCenter,float r,float depth,vec3 shoulderGeometry,float bodyCurve,out float sourceDepth,out vec2 sourceNormal){
      float envelope=shoulderOuterEnvelopeAtX(shoulderGeometry.x);
      float theta=glassShoulder().y*0.01745329252*envelope;
      float captureWidth=shoulderCaptureWidth(shoulderGeometry.y,shoulderGeometry.z);
      vec2 tangent=vec2(-edgeNormal.y,edgeNormal.x);
      float tangentTravel=shoulderTangentialTravel(p,tangent,center,invSafeCenter,captureWidth,envelope,bodyCurve);
      vec2 boundaryPoint=p+edgeNormal*depth;
      vec2 innerContourPoint=unifiedInnerContourPoint(boundaryPoint,center,safeHalfSize,invSafeCenter,captureWidth);
      vec2 sourcePoint=mix(p,innerContourPoint,envelope)+tangent*tangentTravel;
      float sourceSd=roundedBoxSdfPrepared(sourcePoint,center,sdfCore,r);
      if(sourceSd>-0.5){
        vec2 correctionNormal=perimeterNormalPrepared(sourcePoint,center,sdfCore);
        sourcePoint-=correctionNormal*(sourceSd+0.5);
        sourceSd=roundedBoxSdfPrepared(sourcePoint,center,sdfCore,r);
      }
      sourceDepth=max(-sourceSd,0.0);
      sourceNormal=perimeterNormalPrepared(sourcePoint,center,sdfCore);
      float fresnelBase=1.0-cos(theta);
      float fresnel2=fresnelBase*fresnelBase;
      float fresnel=0.04+0.96*fresnel2*fresnel2*fresnelBase;
      return vec4(sourcePoint,envelope,fresnel);
    }
    vec2 evaluateBodyOpticalCoordAt(vec2 point,float pointDepth,vec2 pointNormal,vec2 z,vec2 rectInv,vec2 center,vec2 invSafeCenter,float minSize,vec3 lensParams,float pointWeight,vec3 transportParams,vec4 pressOptics){
      vec2 pressFlow=vec2(0.0);
      if(pressOptics.w>0.0){
        float pointPressField=pressFieldAt(point,rectInv,pressOptics.xy,pressOptics.z,pressOptics.w);
        vec2 pressCenterPx=pressOptics.xy*z;
        vec2 inwardPx=softLimit((pressCenterPx-point)*(0.028*pressOptics.w+0.070*pointPressField),24.0+pressOptics.w*18.0);
        vec2 pressDelta=point-pressCenterPx;
        vec2 pressDir=pressDelta/max(length(pressDelta),0.001);
        vec2 pressDimplePx=-pressDir*pointPressField*(8.0+pressOptics.w*10.0);
        pressFlow=pressDimplePx+inwardPx*(1.76+0.46*pointWeight);
      }
      return point+bodyRefractionFlow(pointNormal,pointDepth,pointWeight,lensParams)+centerTransport(point,center,invSafeCenter,minSize,transportParams)+pressFlow;
    }

    void main(){
      vec2 coord=vec2(gl_FragCoord.x,uResolution.y-gl_FragCoord.y);
      vec2 z=max(uRect.zw,vec2(1.0));
      vec2 rectInv=1.0/z;
      vec2 p=coord-uRect.xy;
      vec2 center=z*0.5;
      vec2 safeHalfSize=max(center,vec2(1.0));
      vec2 invSafeCenter=1.0/safeHalfSize;
      float minSize=min(z.x,z.y);
      float r=min(uRadius,minSize*0.5);
      vec2 sdfCore=max(center-vec2(r),vec2(0.0));
      float sd=roundedBoxSdfPrepared(p,center,sdfCore,r);
      float mask=1.0-smoothstep(-0.75,0.75,sd);
      if(mask<=0.001)discard;

      float press=uPress.x;
      vec2 pressCenter=uPress.yz;
      float pressAspect=1.0;
      float pressField=0.0;
      float pressWide=0.0;

      float depth=insideFromSdf(sd);
      vec2 normal=perimeterNormalPrepared(p,center,sdfCore);
      vec4 resolvedBodyLensA=glassBodyLensA();
      vec4 resolvedBodyLensB=glassBodyLensB();
      vec4 resolvedShoulder=glassShoulder();
      vec4 resolvedDispersion=glassDispersion();
      float bodyReach=bodyLensReach(minSize,r);
      float bodyConcentration=mix(0.58,1.82,sat((resolvedBodyLensA.z+10.0)/20.0));
      float bodyRawPull=abs(resolvedBodyLensA.y)*0.052+abs(resolvedBodyLensA.x)*0.20+resolvedBodyLensB.x*0.12;
      vec3 lensParams=vec3(bodyReach,bodyConcentration,bodyRawPull);
      vec3 transportParams=vec3(sat((uBody.x-0.18)/(1.5-0.18)),sat((uBody.y-0.2)/3.0),sat(uBody.z/900.0));

      float bodyWeight=bodyLensWeightAtReach(depth,lensParams);
      vec2 pressBodyFlow=vec2(0.0);
      if(press>0.0){
        pressAspect=min(z.x/max(z.y,1.0),2.2);
        vec2 pressCenterPx=pressCenter*z;
        pressField=pressFieldAt(p,rectInv,pressCenter,pressAspect,press);
        pressWide=press*pow(sat(1.0-length((p*rectInv-pressCenter)*vec2(pressAspect,1.0))*0.58),1.25);
        vec2 inwardPx=softLimit((pressCenterPx-p)*(0.028*press+0.070*pressField),24.0+press*18.0);
        vec2 pressDelta=p-pressCenterPx;
        vec2 pressDir=pressDelta/max(length(pressDelta),0.001);
        vec2 pressDimplePx=-pressDir*pressField*(8.0+press*10.0);
        pressBodyFlow=pressDimplePx+inwardPx*(1.76+0.46*bodyWeight);
      }
      vec4 pressOptics=vec4(pressCenter,pressAspect,press);

      vec2 mainBodyFlow=bodyRefractionFlow(normal,depth,bodyWeight,lensParams);
      vec2 centerFlow=centerTransport(p,center,invSafeCenter,minSize,transportParams);
      vec2 bodyOpticalCoord=p+mainBodyFlow+centerFlow+pressBodyFlow;
      float materialWeight=bodyWeight;
      vec2 shoulderOptics=vec2(0.0);
      float shoulderXValue=0.0;
      bool shoulderActive=false;

      float width=shoulderWidth(minSize);
      if(depth<width){
        shoulderXValue=sat(depth/max(width,1.0));
        vec3 shoulderGeometry=vec3(shoulderXValue,width,minSize);
        float sourceDepth;
        vec2 sourceNormal;
        vec4 shoulderData=evaluateShoulderSource(p,normal,center,safeHalfSize,sdfCore,invSafeCenter,r,depth,shoulderGeometry,transportParams.y,sourceDepth,sourceNormal);
        vec2 sourcePoint=shoulderData.xy;
        shoulderOptics=shoulderData.zw;
        float sourceWeight=bodyLensWeightAtReach(sourceDepth,lensParams);
        bodyOpticalCoord=evaluateBodyOpticalCoordAt(sourcePoint,sourceDepth,sourceNormal,z,rectInv,center,invSafeCenter,minSize,lensParams,sourceWeight,transportParams,pressOptics);
        shoulderActive=true;
      }
      vec2 uvRoot=max(uRootResolution,vec2(1.0));
      vec2 rootInv=1.0/uvRoot;
      vec2 uvTexel=0.5*rootInv;
      vec2 bodyUv=globalUvAt(bodyOpticalCoord,rootInv,uvTexel);
      float bodyBlurAmount=clamp(uBlurAmount+pressField*0.42+pressWide*0.12,0.0,4.0);
      vec3 bodyColor=blurPyramidBackdropAt(bodyUv,bodyBlurAmount);

      float dispersionStrength=resolvedDispersion.x;
      float dispersionDistance=resolvedDispersion.y;
      if(dispersionStrength>0.001&&dispersionDistance>0.001){
        float dispersionWidth=max(resolvedDispersion.z,1.0);
        float edgeEnvelope=1.0-smoothstep(0.0,dispersionWidth,depth);
        float cornerAmount=1.0-max(abs(normal.x),abs(normal.y));
        float dispersionMask=pow(edgeEnvelope,resolvedDispersion.w)*dispersionStrength*(1.0+cornerAmount*0.72);
        if(dispersionMask>0.001){
          vec2 splitPx=normal*dispersionDistance*(0.72+0.28*edgeEnvelope);
          vec3 redSample=blurPyramidBackdropAt(globalUvAt(bodyOpticalCoord+splitPx,rootInv,uvTexel),bodyBlurAmount);
          vec3 blueSample=blurPyramidBackdropAt(globalUvAt(bodyOpticalCoord-splitPx,rootInv,uvTexel),bodyBlurAmount);
          vec3 prismColor=vec3(redSample.r,(redSample.g+blueSample.g)*0.5,blueSample.b);
          bodyColor=mix(bodyColor,prismColor,sat(dispersionMask));
        }
      }

      float opticalBoost=1.0+materialWeight*0.24;
      bodyColor*=uBody.w*uMaterial.z*opticalBoost;
      bodyColor-=vec3(0.055,0.065,0.085)*resolvedBodyLensB.z*materialWeight;
      bodyColor*=1.0-pressField*0.070-pressWide*0.025;
      bodyColor+=vec3(0.018,0.035,0.046)*pressField*0.38;
      if(resolvedBodyLensB.w>0.0){
        float bodyDebug=smoothstep(-1.6,0.0,sd)*mask;
        bodyColor=mix(bodyColor,vec3(1.0,0.45,0.0),bodyDebug*resolvedBodyLensB.w);
      }

      vec3 color=bodyColor;
      if(shoulderActive){
        float strength=resolvedShoulder.w;
        float fill=shoulderMaterialFillAtX(shoulderXValue);
        float outerRim=pow(shoulderOptics.x,2.8);
        vec2 lightDirection=normalize(vec2(-0.62,-0.78));
        float lightFacing=pow(sat(dot(normal,lightDirection)),2.7);
        float volumeShadow=0.014*strength*fill*(0.30+0.70*(1.0-lightFacing));
        color*=1.0-volumeShadow;
        float fillSheen=sat(0.072*strength*fill*(0.40+0.60*lightFacing));
        vec3 filledColor=mix(color,vec3(0.88,0.96,1.0),0.36);
        color=mix(color,filledColor,fillSheen);
        float reflection=sat(0.21*strength*shoulderOptics.y*outerRim*(0.18+0.82*lightFacing));
        vec3 reflectionColor=mix(color,vec3(0.93,0.98,1.0),0.72);
        color=mix(color,reflectionColor,reflection);
      }

      float bodyAlpha=uMaterial.y*(uMaterial.x/20.0)*uIntensity;
      float finalAlpha=sat(mask*bodyAlpha);
      vec3 finalColor=clamp(color,0.0,1.0);
      gl_FragColor=vec4(finalColor*finalAlpha,finalAlpha);
    }
  `;

  window.BlogAppGlassShaders = Object.freeze({ vs, fs });
})();
