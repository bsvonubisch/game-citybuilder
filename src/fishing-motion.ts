/** Sub-pixel buoyancy, without rotating or stretching the directional artwork. */
export function boatFloat(time:number,id:number,sailing:boolean,moored:boolean){
 const phase=id*.71,amplitude=moored?.45:sailing?.72:1;
 return{height:(Math.sin(time*1.65+phase)*.58+Math.sin(time*.79+phase*2)*.24)*amplitude,
   drift:Math.sin(time*.93+phase)*.012*amplitude};
}
const smooth=(t:number)=>{const v=Math.max(0,Math.min(1,t));return v*v*(3-2*v);};
/** One cast, soak, haul and stow per production cycle. Uses job progress so
 * pausing the fishery holds its gear and upgrades speed up the same action. */
export function fishingNet(progress:number,duration:number){
 const phase=Math.max(0,Math.min(1,progress/duration));
 const casting=phase<.18,soaking=phase>=.18&&phase<.67,hauling=phase>=.67&&phase<.94;
 const extension=casting?smooth(phase/.18):soaking?1:1-smooth((phase-.67)/.27);
 return{phase,casting,soaking,hauling,extension,
   visibility:phase>=.94?1-smooth((phase-.94)/.06):soaking?.12:1,
   catchVisible:hauling&&extension<.82,dripping:hauling&&extension<.8&&extension>.12};
}
