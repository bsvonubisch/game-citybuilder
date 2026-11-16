import test from 'node:test';
import assert from 'node:assert/strict';
import {shoreBanks} from '../.test-dist/shore-bank.js';
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
