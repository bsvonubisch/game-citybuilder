import type {Point} from './simulation.js';

/** Bounded route memoization. Callers own their returned paths, including points. */
export class RoadPathCache {
  private entries=new Map<string,Point[]|null>();
  private points=0;
  clear(){this.entries.clear();this.points=0;}
  find(key:string,search:()=>Point[]|null):Point[]|null {
    if(this.entries.has(key)){
      const path=this.entries.get(key)!;
      this.entries.delete(key);this.entries.set(key,path);
      return path?.map(p=>({...p}))??null;
    }
    const path=search();
    // Bound both routes and their total geometry, including unreachable pairs.
    if((path?.length??0)<=20000){
      while(this.entries.size>=1024||this.points+(path?.length??0)>20000){
        const oldest=this.entries.keys().next().value!;
        this.points-=this.entries.get(oldest)?.length??0;this.entries.delete(oldest);
      }
      this.entries.set(key,path?.map(p=>({...p}))??null);this.points+=path?.length??0;
    }
    return path;
  }
}
