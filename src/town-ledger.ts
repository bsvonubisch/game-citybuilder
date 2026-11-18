import { icon } from './icons.js';
import { RESOURCES, RESOURCE_NAMES } from './catalog.js';
import type { Need } from './needs.js';
import type { Simulation } from './simulation.js';

const ledgerContent=new WeakMap<HTMLElement,string>();
export function setLedgerContent(element:HTMLElement,html:string) {
  if(ledgerContent.get(element)===html)return;
  element.innerHTML=html;
  ledgerContent.set(element,html);
}

export function needCards(needs: Need[]) {
  const ordered = [...needs].sort((a,b)=>Number(b.have<b.need)-Number(a.have<a.need));
  return ordered.map(n=>{
    const short=n.have<n.need;
    const gap=n.need-n.have;
    const missing=n.id==='parks'||n.id==='religion' ? `${gap} resident${gap===1?'':'s'} outside coverage` :
      n.id==='workers'||n.id==='builders' ? `${gap} position${gap===1?'':'s'} open` :
      `Short by ${gap} ${n.unit}`;
    const days=n.need ? Math.floor(n.have/n.need) : 0;
    const status=short ? missing :
      n.id==='food'&&n.need ? `${days} day${days===1?'':'s'} in reserve` :
      n.id==='builders'&&!n.need ? 'No active work' : 'Covered';
    const action=short&&n.action ? `<button class="quiet" data-need="${n.id}">${n.action.label} ${icon('arrow')}</button>` : '';
    return `<article class="town-need ${short?'short':'met'}"><div><b>${n.label}</b><small>${status}</small></div><strong aria-label="${n.have} of ${n.need}">${n.have.toLocaleString()} <span>/ ${n.need.toLocaleString()}</span></strong>${action}</article>`;
  }).join('');
}

export function stockRows(sim: Simulation, selected?:string) {
  const totals=sim.totals();
  const ordered=[...RESOURCES].sort((a,b)=>Number(b===selected)-Number(a===selected));
  return ordered.map(resource=>{
    const stored=sim.stored(resource);
    return `<div class="inventory-row${resource===selected?' selected':''}">${icon(resource)}<span>${RESOURCE_NAMES[resource]}</span><b>${stored.toLocaleString()}</b><b>${(totals[resource]-stored).toLocaleString()}</b></div>`;
  }).join('');
}

export function ledgerLayout(stock: boolean) {
  return `<div class="ledger">
    <header class="drawer-heading"><h2>Town ledger</h2><div class="ledger-switch" role="group" aria-label="Ledger pages">
    <button data-ledger="needs" aria-pressed="${!stock}">Town needs</button><button data-ledger="stock" aria-pressed="${stock}">Inventory</button></div></header>
    <p id="ledger-detail" hidden></p>
    <section id="ledger-needs" ${stock?'hidden':''}><div id="town-stats" class="ledger-totals"></div><div id="town-needs"></div></section>
    <section id="ledger-stock" ${stock?'':'hidden'}><div class="stock-heading"><span>Goods</span><b>Warehouse</b><b>Elsewhere</b></div><div id="inventory"></div><small>Elsewhere includes homes, workplaces and goods in transit.</small></section>
    </div>`;
}
