import test from 'node:test';
import assert from 'node:assert/strict';
import {glassOffset} from './liquid-glass-math.mjs';
test('rounded glass keeps its center and symmetric sampling with RGB separation',()=>{
 for(const [w,h] of [[80,54],[360,68],[900,180]]){
  const center=glassOffset(w/2,h/2,w,h,1,0);assert.equal(center.x,0);assert.equal(center.y,0);
  const left=glassOffset(1,h/2,w,h,1,0),right=glassOffset(w-1,h/2,w,h,1,0);assert.ok(Math.abs(left.x+right.x)<1e-8);assert.ok(left.x>5);
  assert.notEqual(glassOffset(1,h/2,w,h,1,0,1).x,glassOffset(1,h/2,w,h,1,0,-1).x);
  for(let y=0;y<h;y+=5)for(let x=0;x<w;x+=5){const v=glassOffset(x,y,w,h,1,1);assert.ok(Number.isFinite(v.x)&&Number.isFinite(v.y));}
 }
});
