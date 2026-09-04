const c=document.getElementById('galaxyCanvas'),rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
const g=c.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'high-performance',premultipliedAlpha:false});
if(!g)throw Error('WebGL2 required');
const hdr=!!g.getExtension('EXT_color_buffer_float'),fl=g.getExtension('OES_texture_float_linear');
const VS=`#version 300 es
precision highp float;
in vec3 aPosition;in vec3 aColor;in float aSize;in float aAlpha;in float aPhase;in float aRate;in float aKind;
uniform float uAspect,uTime,uDpr,uExposure,uPointerActive;uniform vec2 uPointer;
out vec3 vColor;out float vOpacity,vBrightness,vRayStrength,vParticleDiameter;flat out float vKind;
mat2 R(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
void main(){
 vec3 p=aPosition;float z=clamp((p.z+1.)*.5,0.,1.);
 float bg=1.-step(.5,aKind),st=step(.5,aKind)*(1.-step(1.5,aKind)),br=step(1.5,aKind)*(1.-step(2.5,aKind)),he=step(2.5,aKind)*(1.-step(3.5,aKind));
 float fs=mix(.38,.78,z)*(.72+.28*aRate),fa=mix(.005,.022,z),px=aPhase*.71+aPosition.x*4.2+aPosition.y*1.8,py=aPhase*1.13-aPosition.x*2.6+aPosition.y*3.4;
 vec2 fd=normalize(vec2(.70,1.)),ac=vec2(-fd.y,fd.x);float fm=mix(.22,1.,clamp(st+br+he,0.,1.))*mix(1.,.52,he);
 p.xy+=fd*(sin(px+uTime*fs)-sin(px))*fa*fm+ac*(cos(py+uTime*fs*.73)-cos(py))*fa*.46*fm;
 p.xy+=uPointer*mix(.0035,.021,z);vec2 d=p.xy-vec2(uPointer.x*uAspect,uPointer.y);p.xy+=normalize(d+vec2(.0001))*exp(-dot(d,d)*15.)*uPointerActive*(.002+.013*z);p.xy=R(-.017+uPointer.x*.006)*p.xy;
 p.x=(p.x-.535)*1.72;p.y*=1.035;float compact=1.-smoothstep(.78,1.08,uAspect);p.x=mix(p.x,p.x*.76,compact);gl_Position=vec4(p.x/max(uAspect,.62),p.y,0,1);
 float a=sin(aPhase+uTime*.62*aRate),b=sin(aPhase*1.73+uTime*(.36+.27*aRate));float tw=.93+.07*a;tw=mix(tw,.88+.12*a+.03*b,st);tw=mix(tw,.79+.17*a+.05*b,br);tw=mix(tw,.76+.20*a+.06*b,he);
 float pd=max(.15,aSize*uDpr)*mix(.82,1.22,z)*(1.+br*.05+he*.08);float sb=(.48+aSize*.20)*bg+(.82+aSize*.34)*st+(2.55+aSize*.36)*br+(5.10+min(aSize,10.)*.07)*he;
 float seq=fract(aPhase*.173+aPosition.x*.071+aPosition.y*.113),rev=smoothstep(0.,1.,clamp(uExposure*1.22-seq*.36,0.,1.));float lu=dot(aColor,vec3(.2126,.7152,.0722));
 vColor=clamp(mix(vec3(lu),aColor,1.08+st*.18+br*.52+he*.72),0.,1.35);vOpacity=min(1.,aAlpha*rev*(.91+tw*.09)*(1.+br*.12+he*.08));vBrightness=sb*tw;vRayStrength=smoothstep(2.4,5.3,sb);vParticleDiameter=pd;vKind=aKind;
 gl_PointSize=max(pd,4.+br*3.+he*10.);
}`;
const FS=`#version 300 es
precision highp float;
in vec3 vColor;in float vOpacity,vBrightness,vRayStrength,vParticleDiameter;flat in float vKind;uniform float uBloomOnly;out vec4 o;
float cc(float x){x=abs(x);if(x<1.)return(4.-6.*x*x+3.*x*x*x)/6.;float t=max(2.-x,0.);return t*t*t/6.;}
float fc(vec2 p){return cc(p.x)*cc(p.y)*.150904*vParticleDiameter*vParticleDiameter;}
void main(){
 float br=step(1.5,vKind)*(1.-step(2.5,vKind)),he=step(2.5,vKind)*(1.-step(3.5,vKind)),maj=clamp(br+he,0.,1.);if(uBloomOnly>.5&&maj<.5)discard;if(vKind>3.5)discard;
 if(maj<.5){vec2 px=(gl_PointCoord-.5)*max(vParticleDiameter,4.);vec2 p=px*2./max(vParticleDiameter,.0001);float r=length(p),rs=smoothstep(2.,4.,vParticleDiameter),disc=pow(1.-smoothstep(.05,.86,r),2.8),al=mix(fc(px),disc,rs)*vOpacity;if(al<=0.)discard;float hot=exp(-r*r*30.)*smoothstep(.9,2.4,vBrightness);o=vec4(mix(vColor,vec3(1),hot*.7)*vBrightness,al);return;}
 vec2 q=gl_PointCoord*2.-1.;float r=length(q);if(r>1.)discard;
 float needle=exp(-r*r*980.),core=exp(-r*r*250.),inner=exp(-r*r*72.),colorCorona=exp(-r*r*30.)*(1.-exp(-r*r*160.)),micro=exp(-r*r*11.)*(1.-smoothstep(.58,1.,r));
 float hr=exp(-abs(q.y)*170.)*exp(-abs(q.x)*3.6),vr=exp(-abs(q.x)*170.)*exp(-abs(q.y)*3.6),cross=max(hr,vr),ra=mix(.055,.30,he)*vRayStrength;
 vec2 d=vec2(q.x+q.y,q.y-q.x)*.70710678;float diag=max(exp(-abs(d.y)*150.)*exp(-abs(d.x)*5.2),exp(-abs(d.x)*150.)*exp(-abs(d.y)*5.2))*.07*he*vRayStrength,rays=cross*ra+diag;
 float shape=clamp(needle*1.25+core*.92+inner*.24+micro*.025+rays,0.,1.),band=smoothstep(.035,.13,r)*(1.-smoothstep(.26,.52,r));vec3 col=mix(vec3(1),vColor,band*(.88+he*.08));float lu=dot(col,vec3(.2126,.7152,.0722));col=mix(col,vec3(lu),smoothstep(.42,.95,r)*.62);vec3 rayCol=mix(vec3(1),vColor,.16);
 vec3 en=col*(needle*1.85+core*1.10+inner*.36+colorCorona*.24+micro*.018)+rayCol*rays*.92;float al=vOpacity*shape;if(al<=.0005)discard;
 if(uBloomOnly>.5){float bc=needle*1.65+core*.82+inner*.16+rays*.10;o=vec4(mix(vec3(1),vColor,.24)*vBrightness*bc,vOpacity*clamp(bc,0.,1.));return;}o=vec4(en*vBrightness,al);
}`;
const QV=`#version 300 es
precision highp float;out vec2 v;void main(){vec2 p=gl_VertexID==0?vec2(-1,-1):(gl_VertexID==1?vec2(3,-1):vec2(-1,3));v=p*.5+.5;gl_Position=vec4(p,0,1);}`;
const BF=`#version 300 es
precision highp float;in vec2 v;uniform sampler2D s;uniform vec2 t,d;uniform float th,ex;out vec4 o;vec3 S(vec2 u){vec3 c=texture(s,clamp(u,vec2(.001),vec2(.999))).rgb;if(ex>.5){float l=max(c.r,max(c.g,c.b));c*=smoothstep(th,th+.11,l);}return c;}void main(){vec2 x=t*d;vec3 c=S(v)*.36;c+=(S(v+x*.85)+S(v-x*.85))*.25;c+=(S(v+x*1.75)+S(v-x*1.75))*.07;o=vec4(c,1);}`;
const CF=`#version 300 es
precision highp float;in vec2 v;uniform sampler2D sc,b0,b1,b2;uniform float bi;out vec4 o;vec3 A(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}void main(){vec3 s=texture(sc,v).rgb,b=texture(b0,v).rgb*.72+texture(b1,v).rgb*.22+texture(b2,v).rgb*.06;vec3 m=A(s+b*bi);o=vec4(pow(m,vec3(1./2.2))+vec3(.003,.005,.009),1);}`;
function sh(t,s){const x=g.createShader(t);g.shaderSource(x,s);g.compileShader(x);if(!g.getShaderParameter(x,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(x));return x}
function pr(v,f){const p=g.createProgram();g.attachShader(p,sh(g.VERTEX_SHADER,v));g.attachShader(p,sh(g.FRAGMENT_SHADER,f));g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));return p}
const sp=pr(VS,FS),bp=pr(QV,BF),cp=pr(QV,CF),ev=g.createVertexArray(),STR=11;
function rng(s){return()=>{s=(s+0x6D2B79F5)|0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
const R=rng(0x51A7F19D);function ga(){let u=Math.max(R(),1e-7),v=Math.max(R(),1e-7);return Math.sqrt(-2*Math.log(u))*Math.cos(Math.PI*2*v)}
const P=[{l:.15,c:[.427,.796,.957]},{l:.33,c:[.478,.694,.996]},{l:.40,c:[.973,.475,.082]},{l:.48,c:[.980,.600,.298]},{l:1,c:[.961,.965,.984]}];
function pc(k=1){let q=R(),e=P.find(x=>q<=x.l)||P[4],n=.965+R()*.07;return e.c.map(x=>Math.min(1.15,x*n*k))}
const A=[[-.46,-1.30],[-.16,-.98],[.16,-.70],[.43,-.43],[.67,-.12],[.82,.19],[.98,.47],[1.22,.78],[1.53,1.19]],B=[[-.08,-1.30],[.18,-1.01],[.38,-.69],[.58,-.40],[.83,-.13],[1.04,.19],[1.20,.54],[1.39,.90],[1.69,1.24]];
function cr(a,t){let n=a.length-1,s=Math.max(0,Math.min(.999999,t))*n,i=Math.floor(s),u=s-i,p0=a[Math.max(0,i-1)],p1=a[i],p2=a[Math.min(n,i+1)],p3=a[Math.min(n,i+2)],u2=u*u,u3=u2*u;return[.5*((2*p1[0])+(-p0[0]+p2[0])*u+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*u2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*u3),.5*((2*p1[1])+(-p0[1]+p2[1])*u+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*u2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*u3)]}
function pf(a,t){let p=cr(a,t),b=cr(a,Math.max(0,t-.0025)),d=cr(a,Math.min(.9999,t+.0025)),x=d[0]-b[0],y=d[1]-b[1],l=Math.max(Math.hypot(x,y),1e-6);x/=l;y/=l;return{x:p[0],y:p[1],tx:x,ty:y,nx:-y,ny:x}}
const S=[];function ps(x,y,z,c,s,a,p,r,k){S.push(x,y,z,c[0],c[1],c[2],s,a,p,r,k)}
function bg(n){for(let i=0;i<n;i++){let q=R(),s=q>.985?1.65+R()*1.2:.46+R()*.82,a=q>.985?.26+R()*.24:.045+R()*.15;ps(-2.22+R()*4.44,-1.2+R()*2.4,-.94+R()*1.88,pc(.86),s,a,R()*39,.45+R()*.9,0)}}
function sw(t,s=false){let p=.5+.5*Math.sin(t*Math.PI*4.6+.9);return(s?.082:.125)+p*(s?.080:.155)}function dl(t){return-.026+Math.sin(t*8.4+.6)*.038}function dw(t){return.032+(.5+.5*Math.sin(t*5.8+2.1))*.024}
function stream(n,path,sec=false){let z=0,k=0;while(z<n&&k<n*12){k++;let t=Math.pow(R(),sec?1.03:.96),f=pf(path,t),w=sw(t,sec),o=ga()*w;if(!sec&&Math.abs(o-dl(t))<dw(t)&&R()<.86)continue;let al=ga()*.012,x=f.x+f.nx*o+f.tx*al,y=f.y+f.ny*o+f.ty*al,zz=Math.max(-.88,Math.min(.92,ga()*(sec?.26:.34)+(R()-.5)*.15)),dc=Math.exp(-Math.pow((t-.52)/.34,2));ps(x,y,zz,pc(sec?.88:.98),.58+R()*(1.12+dc*.42),(.075+R()*.27)*(.78+dc*.28)*(sec?.8:1),R()*57,.55+R()*1.25,1);z++}}
function mid(n){for(let i=0;i<n;i++){let t=.04+R()*.92,f=pf(A,t),o=ga()*sw(t)*.92;ps(f.x+f.nx*o,f.y+f.ny*o,-.35+R()*1.1,pc(1.06),1.35+Math.pow(R(),2.1)*1.75,.3+R()*.46,R()*73,.58+R()*1.15,1)}}
function bright(n){for(let i=0;i<n;i++){let t=.05+R()*.9,f=pf(R()<.78?A:B,t),o=ga()*sw(t)*.82;ps(f.x+f.nx*o,f.y+f.ny*o,-.12+R(),pc(1.14),2.8+Math.pow(R(),1.6)*3.2,.68+R()*.3,R()*91,.48+R()*.95,2)}}
const H=[{t:.18,o:-.072,s:7.6,c:[.47,.77,1]},{t:.31,o:.098,s:5.8,c:[1,.63,.28]},{t:.42,o:-.115,s:8.8,c:[.40,.70,1]},{t:.53,o:.055,s:6.5,c:[.97,.98,1]},{t:.61,o:-.083,s:9.4,c:[1,.57,.20]},{t:.70,o:.092,s:6.9,c:[.45,.74,1]},{t:.79,o:-.048,s:7.9,c:[.95,.97,1]},{t:.88,o:.061,s:5.9,c:[1,.68,.34]}];
function hero(){H.forEach((h,i)=>{let f=pf(A,h.t);ps(f.x+f.nx*h.o,f.y+f.ny*h.o,.58+(i%3)*.09,h.c,h.s,.96,17+i*8.31,.42+(i%4)*.11,3)})}
bg(5000);stream(4300,A);stream(1450,B,true);mid(650);bright(52);hero();
const data=new Float32Array(S),count=data.length/STR,buf=g.createBuffer(),vao=g.createVertexArray();g.bindVertexArray(vao);g.bindBuffer(g.ARRAY_BUFFER,buf);g.bufferData(g.ARRAY_BUFFER,data,g.STATIC_DRAW);
function at(n,s,o){let l=g.getAttribLocation(sp,n);g.enableVertexAttribArray(l);g.vertexAttribPointer(l,s,g.FLOAT,false,STR*4,o*4)}at('aPosition',3,0);at('aColor',3,3);at('aSize',1,6);at('aAlpha',1,7);at('aPhase',1,8);at('aRate',1,9);at('aKind',1,10);g.bindVertexArray(null);
const U={as:g.getUniformLocation(sp,'uAspect'),ti:g.getUniformLocation(sp,'uTime'),dp:g.getUniformLocation(sp,'uDpr'),ex:g.getUniformLocation(sp,'uExposure'),pa:g.getUniformLocation(sp,'uPointerActive'),po:g.getUniformLocation(sp,'uPointer'),bo:g.getUniformLocation(sp,'uBloomOnly')},BU={s:g.getUniformLocation(bp,'s'),t:g.getUniformLocation(bp,'t'),d:g.getUniformLocation(bp,'d'),th:g.getUniformLocation(bp,'th'),ex:g.getUniformLocation(bp,'ex')},CU={s:g.getUniformLocation(cp,'sc'),b:[0,1,2].map(i=>g.getUniformLocation(cp,'b'+i)),i:g.getUniformLocation(cp,'bi')};
function rt(w,h){let x=g.createTexture();g.bindTexture(g.TEXTURE_2D,x);g.texImage2D(g.TEXTURE_2D,0,hdr?g.RGBA16F:g.RGBA8,w,h,0,g.RGBA,hdr?g.HALF_FLOAT:g.UNSIGNED_BYTE,null);let f=hdr&&!fl?g.NEAREST:g.LINEAR;g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,f);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,f);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);let q=g.createFramebuffer();g.bindFramebuffer(g.FRAMEBUFFER,q);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,x,0);return{x,q,w,h}}
function del(t){if(t){g.deleteTexture(t.x);g.deleteFramebuffer(t.q)}}let scene,opt,bl=[];const st={d:1,w:1,h:1,a:1,pt:[0,0],p:[0,0],pat:0,pa:0,start:performance.now(),last:0};
function rebuild(){del(scene);del(opt);bl.forEach(z=>{del(z.a);del(z.b)});scene=rt(st.w,st.h);opt=rt(st.w,st.h);bl=[.5,.25,.125].map(s=>{let w=Math.max(1,Math.floor(st.w*s)),h=Math.max(1,Math.floor(st.h*s));return{a:rt(w,h),b:rt(w,h)}})}
function resize(){let d=Math.min(devicePixelRatio||1,1.85),w=Math.max(1,Math.round(innerWidth*d)),h=Math.max(1,Math.round(innerHeight*d)),ch=w!=st.w||h!=st.h||d!=st.d;st.d=d;st.w=w;st.h=h;st.a=innerWidth/Math.max(innerHeight,1);if(ch){c.width=w;c.height=h;rebuild()}}
onpointermove=e=>{st.pt[0]=e.clientX/Math.max(innerWidth,1)*2-1;st.pt[1]=-(e.clientY/Math.max(innerHeight,1)*2-1);st.pat=1};onpointerout=()=>st.pat=0;onblur=()=>st.pat=0;onresize=resize;c.addEventListener('webglcontextlost',e=>e.preventDefault());
function damp(a,b,s,d){return a+(b-a)*(1-Math.exp(-s*d))}function tex(i,x){g.activeTexture(g.TEXTURE0+i);g.bindTexture(g.TEXTURE_2D,x)}
function draw(t,b,time,ex){g.bindFramebuffer(g.FRAMEBUFFER,t.q);g.viewport(0,0,st.w,st.h);g.clearColor(.0015,.003,.006,b?0:1);g.clear(g.COLOR_BUFFER_BIT);g.enable(g.BLEND);g.blendFuncSeparate(g.SRC_ALPHA,g.ONE,g.ONE,g.ONE_MINUS_SRC_ALPHA);g.useProgram(sp);g.bindVertexArray(vao);g.uniform1f(U.as,st.a);g.uniform1f(U.ti,rm?0:time);g.uniform1f(U.dp,st.d);g.uniform1f(U.ex,ex);g.uniform1f(U.pa,st.pa);g.uniform2f(U.po,st.p[0],st.p[1]);g.uniform1f(U.bo,b?1:0);g.drawArrays(g.POINTS,0,count);g.disable(g.BLEND)}
function blur(src,dst,dir,extract){g.bindFramebuffer(g.FRAMEBUFFER,dst.q);g.viewport(0,0,dst.w,dst.h);g.useProgram(bp);g.bindVertexArray(ev);tex(0,src.x);g.uniform1i(BU.s,0);g.uniform2f(BU.t,1/src.w,1/src.h);g.uniform2f(BU.d,dir[0],dir[1]);g.uniform1f(BU.th,hdr?.24:.19);g.uniform1f(BU.ex,extract?1:0);g.drawArrays(g.TRIANGLES,0,3)}
function bloom(){let s=opt;bl.forEach((l,i)=>{blur(s,l.a,[1,0],i==0);blur(l.a,l.b,[0,1],false);s=l.b})}
function comp(){g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,st.w,st.h);g.useProgram(cp);g.bindVertexArray(ev);tex(0,scene.x);g.uniform1i(CU.s,0);bl.forEach((l,i)=>{tex(i+1,l.b.x);g.uniform1i(CU.b[i],i+1)});g.uniform1f(CU.i,.46);g.drawArrays(g.TRIANGLES,0,3)}
function ease(v){v=Math.max(0,Math.min(1,v));return v*v*(3-2*v)}
function frame(n){resize();let t=(n-st.start)/1000,d=Math.min(.05,Math.max(.001,st.last?(n-st.last)/1000:.016));st.last=n;if(rm){st.p=[0,0];st.pa=0}else{st.p[0]=damp(st.p[0],st.pt[0],5.2,d);st.p[1]=damp(st.p[1],st.pt[1],5.2,d);st.pa=damp(st.pa,st.pat,4.4,d)}let ex=rm?1:ease((t-.1)/2.45);draw(scene,0,t,ex);draw(opt,1,t,ex);bloom();comp();requestAnimationFrame(frame)}
resize();g.disable(g.DEPTH_TEST);requestAnimationFrame(frame);
