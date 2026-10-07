export function glassOffset(px,py,w,h,snap=0,pressure=0,channel=0){
 const r=Math.min(w,h)/2,x=px-w/2,y=py-h/2,qx=Math.abs(x)-w/2+r,qy=Math.abs(y)-h/2+r;
 const ox=Math.max(qx,0),oy=Math.max(qy,0),l=Math.hypot(ox,oy),d=l+Math.min(Math.max(qx,qy),0)-r;
 let nx=0,ny=0;if(l>1e-6){nx=ox/l*Math.sign(x);ny=oy/l*Math.sign(y);}else if(qx>qy)nx=Math.sign(x);else ny=Math.sign(y);
 const depth=Math.max(0,Math.min(1,1+d/r)),p=Math.max(0,Math.min(1,pressure)),zoom=1+.015*snap+.01*p;
 const bend=Math.pow(depth,Math.max(.12,(7.7-.35*snap-.85*p)*r/100))*(.95+.19*snap+.62*p)*Math.min(18,r*.2);
 const chroma=(.10+.03*Math.max(snap,p))*.02*420*depth*channel;
 return {x:(x-nx*bend)/zoom-x+nx*chroma,y:(y-ny*bend)/zoom-y+ny*chroma,distance:d};
}
