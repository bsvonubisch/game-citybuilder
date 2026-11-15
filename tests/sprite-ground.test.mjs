import test from 'node:test';
import assert from 'node:assert/strict';
import {groundedArt,resolvedBuildingArt} from '../.test-dist/sprite-ground.js';
import {buildingArt} from '../.test-dist/building-art.js';
import {fitGround,groundCoordinates} from '../.test-dist/rendering.js';

function canvasFixture(){
 const crops=[];
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({drawImage:(_source,...crop)=>crops.push(crop),getImageData:(_x,_y,w,h)=>{
  const data=new Uint8ClampedArray(w*h*4);
  // A roof reaching high above a diamond floor, and a projecting doorstep.
  for(let x=Math.floor(w*.2);x<w*.8;x++){
   const bottom=Math.floor(h*.8-Math.abs(x-w*.5)*.5);
   for(let y=Math.floor(h*.15);y<=bottom;y++)data[(y*w+x)*4+3]=255;
  }
  for(let x=Math.floor(w*.34);x<w*.44;x++)for(let y=Math.floor(h*.68);y<h*.85;y++)data[(y*w+x)*4+3]=255;
  return {data};
 }})})};return crops;
}
test('uneven church atlas crops are measured exactly as drawn, without stretching their aspect',()=>{
 const crops=canvasFixture(),art=buildingArt('church',2),source={width:1261,height:1247};
 const measured=groundedArt(art,source);
 assert.deepEqual(crops[0].slice(0,4),art.sourceRect);
 assert.deepEqual(measured.size,art.sourceRect.slice(2));
 assert.ok(measured.contacts.length>0);
 assert.strictEqual(groundedArt(art,source),measured);assert.equal(crops.length,1);
});
test('all four orientations keep one scale and include the projecting doorstep inside the lot',()=>{
 canvasFixture();const source={width:1254,height:1254},scales=[];
 for(let r=0;r<4;r++){
  const art=resolvedBuildingArt('warehouse',r,1,source),fit=fitGround(art.contacts,2,2,.06,art.scaleLimit);scales.push(fit.scale);
  assert.ok(Math.max(...art.contacts.map(p=>p[1]))>627*.83,'the doorstep is part of the measured footprint');
  for(const [x,y] of art.contacts){const p=groundCoordinates(fit.x+x*fit.scale,fit.y+y*fit.scale);assert.ok(p.x>=-.44-1e-9&&p.y>=-.44-1e-9&&p.x<=1.44+1e-9&&p.y<=1.44+1e-9);}
 }
 assert.ok(scales.every(s=>s===scales[0]));
});
test('hunter frontage maps to the entrance views and modular parks retain their own geometry',()=>{
 assert.equal(buildingArt('hunter',0).frame,1);assert.equal(buildingArt('hunter',1).frame,0);
 const park=buildingArt('park',0);assert.strictEqual(groundedArt(park,{width:1024,height:1024}),park);
});
