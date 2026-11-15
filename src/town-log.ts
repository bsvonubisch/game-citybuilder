import {daylight} from './daylight.js';
import {icon} from './icons.js';
import type {TownEvent,TownEventKind} from './town-events.js';
import type {World} from './simulation.js';

const ICONS:Record<TownEventKind,string>={notice:'flag',arrival:'people',departure:'arrow',construction:'hammer',upgrade:'home',demolition:'demolition',building:'home',road:'road',landscape:'leaf',farm:'leaf'};
const time=(event:TownEvent)=>{
  if(event.tick===undefined)return 'Earlier';
  const day=daylight(event.tick),minutes=Math.floor(day.hour*60+1e-7);
  return `Day ${day.day} · ${Math.floor(minutes/60).toString().padStart(2,'0')}:${(minutes%60).toString().padStart(2,'0')}`;
};
export class TownLog {
  private list:HTMLElement;
  private count:HTMLElement;
  private announcement:HTMLElement;
  private world?:World;
  private entries?:TownEvent[];
  private newest=0;
  private unread=0;
  constructor(private panel:HTMLDetailsElement,select:(event:TownEvent)=>void){
    panel.open=!matchMedia('(max-width:700px)').matches;
    panel.innerHTML=`<summary>${icon('log')}<span>Town log</span><span class="town-log-count" hidden></span><span class="town-log-chevron">${icon('arrow')}</span></summary><div class="town-log-list" role="list" aria-label="Recent town events"></div><span class="town-log-announcement" aria-live="polite" aria-atomic="true"></span>`;
    this.list=panel.querySelector('.town-log-list')!;this.count=panel.querySelector('.town-log-count')!;this.announcement=panel.querySelector('.town-log-announcement')!;
    panel.addEventListener('toggle',()=>{if(panel.open){this.unread=0;this.updateCount();}});
    this.list.addEventListener('click',event=>{const button=(event.target as Element).closest<HTMLButtonElement>('[data-event]');const entry=this.entries?.find(e=>e.id===Number(button?.dataset.event));if(entry)select(entry);});
    // Scrolling history must not zoom or pan the game underneath it.
    panel.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
    panel.addEventListener('pointerdown',event=>event.stopPropagation());
  }
  private updateCount(){this.count.hidden=this.unread===0;this.count.textContent=String(this.unread);this.count.setAttribute('aria-label',`${this.unread} new events`);}
  update(world:World){
    if(this.world===world&&this.entries===world.events)return;
    const sameTown=this.world===world,events=world.events??[],fresh=sameTown?events.filter(e=>e.id>this.newest):[];
    this.world=world;this.entries=events;this.newest=events[0]?.id??0;
    if(!sameTown)this.unread=0;else if(!this.panel.open)this.unread+=fresh.length;
    this.updateCount();if(fresh.length)this.announcement.textContent=fresh[0].message;
    const scroll=this.list.scrollTop,fragment=document.createDocumentFragment();
    for(const event of events){
      const item=document.createElement('div');item.className='town-log-item';item.dataset.kind=event.kind;item.setAttribute('role','listitem');
      const row=document.createElement(event.tile||event.buildingId?'button':'div');row.className='town-log-entry';
      if(row instanceof HTMLButtonElement){row.type='button';row.dataset.event=String(event.id);row.title='Show on map';row.setAttribute('aria-label',`${event.message} ${time(event)}. Show on map.`);}
      const symbol=document.createElement('span');symbol.className='town-log-symbol';symbol.innerHTML=icon(ICONS[event.kind]);
      const copy=document.createElement('span'),stamp=document.createElement('small'),message=document.createElement('span');copy.className='town-log-copy';stamp.textContent=time(event);message.textContent=event.message;
      copy.append(stamp,message);row.append(symbol,copy);item.append(row);fragment.append(item);
    }
    if(!events.length){const empty=document.createElement('p');empty.className='town-log-empty';empty.textContent='Your town’s story will appear here.';fragment.append(empty);}
    this.list.replaceChildren(fragment);
    if(scroll>0)this.list.scrollTop=scroll;
  }
}
