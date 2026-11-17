import {DECORATIONS} from './catalog.js';
import type {Decoration} from './decorations.js';
import type {World} from './simulation.js';
import {terrainCell} from './terrain.js';

export const TREE_KINDS=['oak','pine','birch','blossom','maple','willow'] as const;
export type TreeKind=typeof TREE_KINDS[number];
export const isTree=(kind:string):kind is TreeKind=>(TREE_KINDS as readonly string[]).includes(kind);
/** -1 retains the original garden atlas; other frames use tree-variants-v1. */
export const TREE_FRAMES:Record<TreeKind,readonly number[]>={oak:[-1,0,1],pine:[-1,2,3],birch:[-1,4,5],blossom:[-1,6,7],maple:[8,9,10,11],willow:[12,13,14,15]};
export interface TreePlanting {count:number;last:Partial<Record<TreeKind,number>>}
function hash(n:number){n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return (n^(n>>>16))>>>0;}
export function treeVariant(d:Pick<Decoration,'kind'|'id'|'natural'|'variant'>){
  return isTree(d.kind)?d.variant??(d.natural?hash(d.id)%TREE_FRAMES[d.kind].length:0):0;
}
export function decorationArt(d:Pick<Decoration,'kind'|'id'|'natural'|'variant'>){
  const def=DECORATIONS[d.kind];
  if(d.kind==='berry')return {...def,frame:d.id%3};
  if(!isTree(d.kind))return def;
  const frame=TREE_FRAMES[d.kind][treeVariant(d)];
  return frame<0?def:{...def,texture:'tree-variants',frame};
}
/** A saved pseudo-random sequence makes preview and authoritative placement agree.
 * It advances only on successful plantings, not frames, ticks or failed clicks. */
export function nextTreeVariant(world:Pick<World,'treePlanting'|'decorations'>,kind:TreeKind){
  let last=world.treePlanting?.last[kind];
  if(last===undefined)for(let i=world.decorations.length-1;i>=0;i--){const d=world.decorations[i];if(d.kind===kind&&!d.natural){last=treeVariant(d);break;}}
  const count=TREE_FRAMES[kind].length;
  const choice=hash((world.treePlanting?.count??0)+TREE_KINDS.indexOf(kind)*7919+17)%(count-(last===undefined?0:1));
  return last!==undefined&&choice>=last?choice+1:choice;
}
export function plantTreeVariant(world:Pick<World,'treePlanting'|'decorations'>,kind:TreeKind){
  const variant=nextTreeVariant(world,kind);
  world.treePlanting??={count:0,last:{}};world.treePlanting.count++;world.treePlanting.last[kind]=variant;
  return variant;
}
export function validTreeVariant(kind:string,variant:unknown){return isTree(kind)&&Number.isInteger(variant)&&Number(variant)>=0&&Number(variant)<TREE_FRAMES[kind].length;}
export function validateTreePlanting(value:TreePlanting|undefined){
  if(value!==undefined&&(!value||!Number.isSafeInteger(value.count)||value.count<0||!value.last||typeof value.last!=='object'||Array.isArray(value.last)||Object.entries(value.last).some(([kind,variant])=>!validTreeVariant(kind,variant))))throw new Error('Invalid tree planting history.');
}
/** Refresh wild species once, in place. Player-planted trees, stumps, IDs and
 * growth deadlines remain intact; saved towns never receive a new layout. */
export function diversifyWoodland(world:World){
 if(world.woodlandVersion===1)return;
 for(const d of world.decorations){
  if(!d.natural||!isTree(d.kind)||d.kind==='blossom'||d.kind==='maple'||d.kind==='willow')continue;
  const n=hash(d.x*7919+d.y*104729)%100;
  const waterside=[[-1,0],[1,0],[0,1],[0,-1],[-2,0],[2,0],[0,2],[0,-2]].some(([dx,dy])=>terrainCell(d.x+dx,d.y+dy,world.terrain).kind==='water');
  if(waterside&&n<65)d.kind='willow';
  else if(n<24)d.kind='maple';
  else if(n<37)d.kind='birch';
  // Pick only the new views for refreshed natural trees so the update is visible.
  d.variant=d.kind==='maple'||d.kind==='willow'?hash(d.id)%4:1+hash(d.id)%2;
 }
 world.woodlandVersion=1;
}
