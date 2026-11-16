import type Phaser from 'phaser';

// These full-resolution sheets are only sampled by Canvas2D when assembling
// plot/terrain textures. Keeping a second, unused GPU copy doubles their cost.
const CPU_ONLY = new Set(['park-parts','park-benches','foundation-stone','market-stalls','market-produce','meadow','slate','bridge-wood','bridge-woodland','bridge-alpine','bridge-iron','construction-props','construction-earth','planter-plants','fence-pickets']);
const sources = new WeakMap<Phaser.Scene,Map<string,HTMLImageElement>>();
export function retainSourceImages(scene:Phaser.Scene){
 const images=new Map<string,HTMLImageElement>();sources.set(scene,images);
 const retain=(key:string,type:string)=>{
  if(type!=='image'||(!key.startsWith('building-')&&!CPU_ONLY.has(key)))return;
  images.set(key,scene.textures.get(key).getSourceImage() as HTMLImageElement);
  scene.textures.remove(key);
 };
 scene.load.on('filecomplete',retain);
 scene.events.once('shutdown',()=>{scene.load.off('filecomplete',retain);images.clear();});
}
export function sourceImage(scene:Phaser.Scene,key:string):HTMLImageElement{
 return sources.get(scene)?.get(key)??scene.textures.get(key).getSourceImage() as HTMLImageElement;
}
