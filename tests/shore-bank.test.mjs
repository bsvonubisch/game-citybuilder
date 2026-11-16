import test from 'node:test';
import assert from 'node:assert/strict';
import {shoreBanks,shorePlant} from '../.test-dist/shore-bank.js';
import {turnPoint} from '../.test-dist/view-space.js';
import {WATER_DROP} from '../.test-dist/water-level.js';
const key=p=>`${p.x},${p.y}`;
test('road embankments follow the same physical shoreline through all four views',()=>{
 const land={x:8,y:8},water={x:9,y:8};
 for(let turn=0;turn<4;turn++){
  const l=turnPoint(land,turn),w=turnPoint(water,turn),map={};
  for(const d of [{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}])map[key({x:l.x+d.x,y:l.y+d.y})]={kind:'land',height:0};
  map[key(l)]={kind:'land',height:0};map[key(w)]={kind:'water',height:0};
  const banks=shoreBanks(l,new Set([key(l)]),map);assert.equal(banks.length,1);const b=banks[0];
  assert.equal(b.stone,true);assert.equal(b.drop,WATER_DROP);
  assert.deepEqual(b.water,w);
  const expected=[{x:8.5,y:7.5},{x:8.5,y:8.5}].map(p=>key(turnPoint(p,turn))).sort();
  assert.deepEqual([key(b.a),key(b.b)].sort(),expected);
  assert.equal(shoreBanks(l,new Set([key(l),key(w)]),map).length,0,'bridge entrance stays open');
  assert.equal(shoreBanks(l,new Set(),map)[0].stone,false,'removing road restores natural bank');
 }
});
test('a one-tile island has four exact joined edges, including after raising land',()=>{
 const map={'8,8':{kind:'land',height:2}};
 for(const k of ['9,8','8,9','7,8','8,7'])map[k]={kind:'water',height:0};
 const banks=shoreBanks({x:8,y:8},new Set(),map);assert.equal(banks.length,4);
 for(let i=0;i<4;i++){assert.deepEqual(banks[i].b,banks[(i+1)%4].a);assert.equal(banks[i].drop,16+WATER_DROP);}
 assert.deepEqual(shoreBanks({x:9,y:8},new Set(),map),[],'water never owns a duplicate bank');
});

test('shore vegetation roots stay inside dry land, follow its elevation and use all plant variants',()=>{
 const map={},roads=new Set(),plants=[];
 for(let y=1;y<60;y++)for(let x=7;x<=9;x++)map[`${x},${y}`]={kind:x===9?'water':'land',height:0};
 for(let y=2;y<59;y++){
  const tile={x:8,y},plant=shorePlant(tile,roads,map);if(!plant)continue;
  plants.push(plant);
  assert.equal(Math.round(plant.point.x),tile.x,'roots belong to the land tile');
  assert.equal(Math.round(plant.point.y),tile.y);
  assert.ok(plant.point.x<8.5,'roots stay inside the turf edge');
  assert.equal(plant.ground,0,'use the land surface, not the water datum');
  map[key(tile)].height=2;
  assert.deepEqual(shorePlant(tile,roads,map),{...plant,ground:16},'raising land carries its vegetation');
  assert.equal(shorePlant(tile,new Set([key(tile)]),map),undefined,'road coping has no natural plants');
  assert.equal(shorePlant(tile,new Set([`9,${y}`]),map),undefined,'bridge entrances stay clear');
  map[key(tile)].height=-2;
  assert.equal(shorePlant(tile,roads,map),undefined,'no vegetation below the water level');
 }
 assert.ok(plants.length>10&&plants.length<40,'clumps remain sparse');
 assert.deepEqual([...new Set(plants.map(p=>p.frame))].sort(),[4,5,6,7],
  'the spawn threshold must not force every clump to use the same reed sprite');
});
