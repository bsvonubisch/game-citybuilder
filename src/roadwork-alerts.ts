import type Phaser from 'phaser';
import {icon} from './icons.js';
import {iso,cameraViewport} from './rendering.js';
import {roadHeight} from './bridges.js';
import {roadVisualState} from './roadworks.js';
import {roadWorkSites,roadWorkCrew,type RoadWorkSite} from './roadwork-sites.js';
import type {Simulation} from './simulation.js';

export class RoadWorkAlerts {
  private badges=new Map<number,HTMLButtonElement>();
  private sites:RoadWorkSite[]=[];
  private state?:Simulation['state'];
  private revision=-1;
  private tick=-1;
  private outline:Phaser.GameObjects.Graphics;
  constructor(private scene:Phaser.Scene,private container:HTMLElement,private select:(site:RoadWorkSite)=>void){
    this.outline=scene.add.graphics().setDepth(9900);
  }
  update(sim:Simulation,inspect:boolean){
    const changed=this.state!==sim.state||this.revision!==sim.state.revision;
    if(changed){
      this.state=sim.state;this.revision=sim.state.revision;this.sites=roadWorkSites(sim.state);
      const live=new Set(this.sites.map(s=>s.id));
      for(const [id,badge]of this.badges)if(!live.has(id)){badge.remove();this.badges.delete(id);}
      this.drawOutline(sim);
    }
    const camera=this.scene.cameras.main,v=cameraViewport(camera),visual=roadVisualState(sim);
    this.container.classList.add('interactive');
    for(const site of this.sites){
      let badge=this.badges.get(site.id);
      if(!badge){
        badge=document.createElement('button');badge.type='button';badge.className='building-alert roadwork-alert';badge.dataset.roadwork=String(site.id);
        badge.dataset.operation=site.works[0].operation==='remove'?'demolition':'construction';
        badge.innerHTML=`${icon(site.works[0].operation==='remove'?'demolition':'hammer')}<b></b><span class="building-alert-tip" role="tooltip"><strong></strong><span></span></span>`;
        badge.onclick=()=>{const current=this.sites.find(s=>s.id===site.id);if(current)this.select(current);};
        badge.addEventListener('pointerdown',e=>e.stopPropagation());
        this.container.append(badge);this.badges.set(site.id,badge);
      }
      if(changed||this.tick!==sim.state.tick){
        const operation=site.works[0].operation==='remove'?'demolition':'construction';
        if(badge.dataset.operation!==operation){badge.dataset.operation=operation;badge.querySelector(':scope > .icon')!.outerHTML=icon(operation==='demolition'?'demolition':'hammer');}
        const count=roadWorkCrew(sim.state,site.works.map(w=>w.id)).length;
        badge.querySelector('b')!.textContent=String(count);
        const label=`${site.label}: ${count} ${count===1?'worker':'workers'} assigned`;
        badge.setAttribute('aria-label',label);badge.querySelector('strong')!.textContent=site.label;
        badge.querySelector('.building-alert-tip > span')!.textContent=`${site.works.length} tiles remaining · ${count} workers. Select to see progress and locate the crew.`;
      }
      const p=iso(site.anchor.x,site.anchor.y),height=roadHeight(visual.roads,site.anchor.x,site.anchor.y,sim.state.buildings,sim.state.terrain);
      const x=(p.x-v.x)*camera.zoom,y=(p.y-height-v.y)*camera.zoom-12;
      badge.hidden=x<28||x>camera.width-28||y<48||y>camera.height;
      badge.tabIndex=0;
      badge.style.transform=`translate(${x}px,${y}px) translate(-50%,-100%)`;
      badge.dataset.edge=x<130?'left':x>camera.width-130?'right':'center';
    }
    this.tick=sim.state.tick;
  }
  private drawOutline(sim:Simulation){
    this.outline.clear();const visual=roadVisualState(sim),tiles=new Set((sim.state.roadWorks??[]).map(w=>`${w.x},${w.y}`));
    const edges=[[[.5,-.5],[.5,.5],[1,0]],[[.5,.5],[-.5,.5],[0,1]],[[-.5,.5],[-.5,-.5],[-1,0]],[[-.5,-.5],[.5,-.5],[0,-1]]];
    this.outline.lineStyle(.8,0xe1af58,.9);
    for(const w of sim.state.roadWorks??[])for(const [a,b,d]of edges){
      if(tiles.has(`${w.x+d[0]},${w.y+d[1]}`))continue;
      const p=iso(w.x+a[0],w.y+a[1]),q=iso(w.x+b[0],w.y+b[1]);
      p.y-=roadHeight(visual.roads,w.x+a[0],w.y+a[1],sim.state.buildings,sim.state.terrain);
      q.y-=roadHeight(visual.roads,w.x+b[0],w.y+b[1],sim.state.buildings,sim.state.terrain);
      for(let i=0;i<4;i++){const from=i/4,to=from+.14;this.outline.lineBetween(p.x+(q.x-p.x)*from,p.y+(q.y-p.y)*from,p.x+(q.x-p.x)*to,p.y+(q.y-p.y)*to);}
    }
  }
  clear(){for(const badge of this.badges.values())badge.remove();this.badges.clear();this.outline.clear();this.sites=[];this.state=undefined;this.revision=-1;this.tick=-1;}
}
