import test from 'node:test';
import assert from 'node:assert/strict';
import {groundedArt,resolvedBuildingArt} from '../.test-dist/sprite-ground.js';
import {buildingArt} from '../.test-dist/building-art.js';
import {fitGround,groundCoordinates} from '../.test-dist/rendering.js';
import {foundationGeometry} from '../.test-dist/foundation.js';
import {planterGeometry,planterMask,planterEdges,planterFlowers} from '../.test-dist/planter-art.js';
import {turnPoint} from '../.test-dist/view-space.js';
import {sawmillMotion} from '../.test-dist/sawmill-motion.js';

test('sawmill motion stays on the exposed blade above the sloping workbench',()=>{
 const measured=[{center:[223,400],slope:-.5,height:24},{center:[402,412],slope:.5,height:27}];
 for(let r=0;r<2;r++){
  const {center:[x,y],slope,height}=measured[r];
  assert.deepEqual(buildingArt('sawmill',r).mechanism,[x,y]);
  for(let phase=0;phase<8;phase+=.07)for(const line of sawmillMotion(r,phase).strokes)for(const p of line){
   const dx=p.x-x,dy=p.y-y-dx*slope;
   assert.ok(dy<0,'the workbench occludes the lower half');
   assert.ok((dx/22)**2+(dy/height)**2<.7,'highlights stay inside the painted blade teeth');
  }
 }
 assert.equal(sawmillMotion(2,1),null);assert.equal(sawmillMotion(3,1),null);
});

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
test('explicit uneven atlas crops are measured exactly as drawn, without stretching their aspect',()=>{
 const crops=canvasFixture(),art={...buildingArt('church',2),sourceRect:[0,610,630,637]},source={width:1261,height:1247};
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
 for(const kind of ['hunter','church','chapel','cottage','warehouse','forester','sawmill','workshop','brickworks'])for(let r=0;r<4;r++){
  const art=buildingArt(kind,r);assert.equal(art.frame,r);assert.deepEqual(art.size,kind==='forester'?[887,443]:[627,627]);assert.equal(art.sourceRect,undefined);
 }
 const park=buildingArt('park',0);assert.strictEqual(groundedArt(park,{width:1024,height:1024}),park);
});

test('flower-bed borders match foundations and joined sides have no inset seam',()=>{
 const tile={x:0,y:0},adjacent=[{kind:'planter',x:1,y:0}],hasBase=p=>p.x===0&&p.y===-1;
 const mask=planterMask(tile,adjacent,()=>0,hasBase),bed=planterGeometry(mask),base=foundationGeometry(1,1);
 assert.equal(bed.height,base.height);assert.deepEqual(bed.outer,base.base);
 assert.deepEqual(planterEdges(mask),[[2,3],[3,0]],'no wood beside the other bed or stone foundation');
 assert.equal(groundCoordinates(bed.inner[1].x,bed.inner[1].y).x,.5,'flowers reach the adjoining tile');
 assert.equal(groundCoordinates(bed.inner[0].x,bed.inner[0].y).y,-.5,'no extra rim beside the foundation');
 assert.equal(planterMask(tile,adjacent,p=>p.x===1?8:0),0,'different terrain heights keep their border');
 for(let m=0;m<16;m++)for(const p of planterGeometry(m).inner){const g=groundCoordinates(p.x,p.y);assert.ok(Math.abs(g.x)<=.5&&Math.abs(g.y)<=.5,'all border caps stay inside the footprint');}
});

test('neighbouring flower-bed tiles share the same blossoms and paint order across their seam',()=>{
 for(let turn=0;turn<4;turn++)for(const next of [{x:11,y:10},{x:10,y:11}]){
  const a=planterFlowers(turnPoint({x:10,y:10},turn),turn),b=planterFlowers(turnPoint(next,turn),turn),ids=new Set(b.map(p=>p.id));
  const common=a.filter(p=>ids.has(p.id)),shared=new Set(common.map(p=>p.id));
  assert.ok(common.length>50,'both tiles include the overlapping flower canopy');
  assert.deepEqual(common,b.filter(p=>shared.has(p.id)),'joined pieces cannot restart or reorder their texture');
 }
});

test('turning the town preserves flower species, sizes and physical positions',()=>{
 const tile={x:10,y:12},original=planterFlowers(tile);
 for(let turn=1;turn<4;turn++){
  const rotated=new Map(planterFlowers(turnPoint(tile,turn),turn).map(p=>[p.id,p]));
  assert.equal(rotated.size,original.length);
  for(const flower of original){
   const actual=rotated.get(flower.id),point=turnPoint(flower.point,turn);
   assert.ok(actual);assert.equal(actual.crop,flower.crop);assert.equal(actual.size,flower.size);
   assert.ok(Math.abs(actual.point.x-point.x)<1e-9&&Math.abs(actual.point.y-point.y)<1e-9);
  }
 }
});
