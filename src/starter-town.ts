import {STARTER_LAYOUT} from './starter-layout.js';
import type {BuildingKind,Resource} from './catalog.js';
import type {World} from './simulation.js';

const SUPPLIES:Partial<Record<BuildingKind,Partial<Record<Resource,number>>>>={
  market:{bread:24,fish:20,potatoes:20,carrots:20,sausages:16,tools:6},
  bakery:{flour:10},mill:{grain:15},cattle:{grain:8},pigs:{grain:8},chickens:{grain:8},
  butcher:{meat:12},workshop:{metal:10},brickworks:{stone:12},sawmill:{wood:15},
};

/** The player's town layout, with fresh supplies and simulation state. Never a save migration. */
export function seedStarterTown(world:World) {
  const layout=structuredClone(STARTER_LAYOUT);
  world.tick=960;world.money=5000;world.bridgeVersion=1;
  world.roads=layout.roads;world.roadTypes=layout.roadTypes;world.terrain=layout.terrain;
  world.clearedDeposits=layout.clearedDeposits;
  let warehouse=0;
  world.buildings=layout.buildings.map(plan=>{
    const inventory={...SUPPLIES[plan.kind]};
    if(plan.kind==='warehouse')Object.assign(inventory,warehouse++===0
      ?{bread:140,fish:80,potatoes:60,carrots:60,sausages:40,meat:35,grain:60,flour:35,wood:200,planks:100,stone:160,metal:100,bricks:80,tools:20}
      :{wood:60,stone:30,planks:30});
    return {...plan,id:world.nextId++,inventory,progress:0,workers:0,connected:false,enabled:true,produced:0};
  });
  world.decorations=layout.decorations.map(d=>({...d,id:world.nextId++}));
  for(const b of world.buildings.filter(b=>b.kind==='farm'&&b.crop)){
    const [w,h]=b.plot!;
    b.field={cells:Array.from({length:w*h*4},(_,i)=>({sownAt:world.tick-480-(Math.floor(i/(w*2))%4)*140})),tasks:[],phase:'harvesting'};
  }
  world.history=['Welcome to Pinehaven. Explore the market square, riverside and woodland workshops.'];
}
