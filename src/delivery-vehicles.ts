import type {Resource} from './catalog.js';

/** Atlas columns follow travelFacing: SE, S, SW, W, NW, N, NE, E.
 * Appearance derives from the shipment, so old saves and recovered trips use
 * the same vehicle without adding persistent state or changing collision size. */
export const DELIVERY_VEHICLES={
  timber:{texture:'delivery-industrial',row:0,name:'Timber truck'},
  stone:{texture:'delivery-industrial',row:1,name:'Stone hauler'},
  ore:{texture:'delivery-industrial',row:2,name:'Ore hauler'},
  bricks:{texture:'delivery-industrial',row:3,name:'Brick truck'},
  produce:{texture:'delivery-town',row:0,name:'Farm produce truck'},
  food:{texture:'delivery-town',row:1,name:'Food delivery van'},
  dairy:{texture:'delivery-town',row:2,name:'Dairy delivery truck'},
  tools:{texture:'delivery-town',row:3,name:'Tools truck'},
} as const;
const CARGO_VEHICLE:Record<Resource,keyof typeof DELIVERY_VEHICLES>={
  wood:'timber',planks:'timber',stone:'stone',metal:'ore',bricks:'bricks',
  grain:'produce',flour:'produce',potatoes:'produce',carrots:'produce',
  bread:'food',fish:'food',meat:'food',sausages:'food',steaks:'food',roasts:'food',
  milk:'dairy',eggs:'dairy',tools:'tools',
};
export const deliveryVehicle=(cargo:Resource|null)=>DELIVERY_VEHICLES[cargo?CARGO_VEHICLE[cargo]:'food'];
