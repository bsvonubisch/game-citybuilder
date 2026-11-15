import type {BuildingKind} from './catalog.js';

type AudioSettings={music:number;effects:number;muted:boolean};
const STORAGE_KEY='little-works.audio.v1';
const clamp=(n:number)=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;
const hz=(midi:number)=>440*2**((midi-69)/12);
// An original, unhurried D-major tune. Eight eighth-notes per bar at 72 BPM.
const CHORDS=[[50,57,61,66],[47,54,57,62],[43,50,54,59],[45,52,57,62],
  [50,57,61,66],[47,54,57,62],[40,47,50,55],[45,52,57,61],
  [43,50,54,59],[50,57,61,66],[47,54,57,62],[45,52,57,61],
  [43,50,54,59],[40,47,50,55],[45,52,57,61],[50,57,61,66]];
const MELODY=[[74,0,73,71,69,0,66,0],[71,0,69,66,62,0,0,0],[67,0,69,71,74,0,71,0],[69,0,0,0,73,0,0,0],
  [74,0,78,0,76,74,73,0],[71,0,69,0,66,0,0,0],[67,0,66,64,62,0,64,0],[69,0,73,0,71,69,0,0],
  [71,0,74,0,78,0,76,0],[74,0,73,71,69,0,66,0],[71,0,69,66,62,0,66,0],[64,0,69,0,73,0,0,0],
  [71,0,69,67,66,0,67,0],[64,0,66,0,67,0,71,0],[69,0,73,0,76,0,73,0],[74,0,0,0,0,0,0,0]];

/** Small, self-contained soundscape. No downloads, speech services or audio files. */
export class TownAudio {
  settings:AudioSettings={music:.28,effects:.6,muted:false};
  private context?:AudioContext;
  private master?:GainNode;
  private musicBus?:GainNode;
  private effectsBus?:GainNode;
  private pluck?:PeriodicWave;
  private noiseBuffer?:AudioBuffer;
  private timer?:ReturnType<typeof setInterval>;
  private nextNote=0;
  private noteIndex=0;
  private lastEffect=-Infinity;
  private voices=0;
  constructor(){
    try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)??'null');if(saved)this.settings={music:typeof saved.music==='number'?clamp(saved.music):.28,effects:typeof saved.effects==='number'?clamp(saved.effects):.6,muted:saved.muted===true};}catch{/* Private browsing can deny preferences. */}
    const activate=()=>{void this.unlock();};
    document.addEventListener('pointerdown',activate,{passive:true});
    document.addEventListener('keydown',activate);
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){this.stopClock();void this.context?.suspend().catch(()=>{});}
      else if(this.context)void this.unlock();
    });
    window.addEventListener('pagehide',()=>{this.stopClock();void this.context?.suspend().catch(()=>{});});
    window.addEventListener('pageshow',()=>{if(this.context)void this.unlock();});
  }
  private createContext(){
    const ctx=this.context=new AudioContext({latencyHint:'interactive'});
    this.master=ctx.createGain();this.musicBus=ctx.createGain();this.effectsBus=ctx.createGain();
    const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-12;limiter.ratio.value=5;limiter.attack.value=.004;limiter.release.value=.2;
    this.master.connect(limiter).connect(ctx.destination);
    this.musicBus.connect(this.master);this.effectsBus.connect(this.master);
    const reverb=ctx.createConvolver(),impulse=ctx.createBuffer(2,Math.floor(ctx.sampleRate*1.3),ctx.sampleRate);
    for(let c=0;c<2;c++){const data=impulse.getChannelData(c);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-6*i/data.length)*.23;}
    reverb.buffer=impulse;const wet=ctx.createGain();wet.gain.value=.16;
    this.musicBus.connect(reverb);this.effectsBus.connect(reverb);reverb.connect(wet).connect(this.master);
    this.pluck=ctx.createPeriodicWave(new Float32Array(6),new Float32Array([0,1,.22,.09,.04,.015]));
    this.noiseBuffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const noise=this.noiseBuffer.getChannelData(0);
    for(let i=0;i<noise.length;i++)noise[i]=Math.random()*2-1;
    this.applySettings();this.nextNote=ctx.currentTime+.12;
  }
  async unlock(){
    if(document.hidden)return;
    try{
      if(!this.context||this.context.state==='closed')this.createContext();
      if(this.context!.state!=='running')await this.context!.resume();
      if(this.context!.state==='running'&&!this.timer){this.nextNote=this.context!.currentTime+.1;this.timer=setInterval(()=>this.scheduleMusic(),100);this.scheduleMusic();}
    }catch{/* Sound must never stop the game when a browser denies audio. */}
  }
  private stopClock(){if(this.timer)clearInterval(this.timer);this.timer=undefined;}
  setSettings(values:Partial<AudioSettings>){
    this.settings={music:clamp(values.music??this.settings.music),effects:clamp(values.effects??this.settings.effects),muted:values.muted??this.settings.muted};
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(this.settings));}catch{}
    this.applySettings();
  }
  private applySettings(){
    if(!this.context)return;const t=this.context.currentTime;
    this.master!.gain.setTargetAtTime(this.settings.muted?0:.8,t,.025);
    this.musicBus!.gain.cancelScheduledValues(t);
    this.musicBus!.gain.setTargetAtTime(this.settings.music,t,.04);
    this.effectsBus!.gain.setTargetAtTime(this.settings.effects,t,.025);
  }
  private tone(frequency:number,time:number,duration:number,volume:number,bus:GainNode,shape:'pluck'|OscillatorType='sine',endFrequency?:number){
    const ctx=this.context;if(!ctx||this.voices>=72)return;
    const oscillator=ctx.createOscillator(),gain=ctx.createGain();this.voices++;
    if(shape==='pluck')oscillator.setPeriodicWave(this.pluck!);else oscillator.type=shape;
    oscillator.frequency.setValueAtTime(frequency,time);
    if(endFrequency)oscillator.frequency.exponentialRampToValueAtTime(endFrequency,time+duration);
    gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(volume,time+.012);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
    oscillator.connect(gain).connect(bus);oscillator.start(time);oscillator.stop(time+duration+.015);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices--;};
  }
  private noise(time:number,duration:number,volume:number,frequency:number,type:BiquadFilterType='lowpass'){
    const ctx=this.context;if(!ctx||this.voices>=72)return;
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();this.voices++;
    source.buffer=this.noiseBuffer!;source.loop=true;filter.type=type;filter.frequency.value=frequency;filter.Q.value=.65;
    gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(volume,time+.02);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
    source.connect(filter).connect(gain).connect(this.effectsBus!);source.start(time);source.stop(time+duration+.02);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();this.voices--;};
  }
  private scheduleMusic(){
    const ctx=this.context;if(!ctx||ctx.state!=='running'||document.hidden)return;
    if(this.nextNote<ctx.currentTime)this.nextNote=ctx.currentTime+.05;
    while(this.nextNote<ctx.currentTime+.35){
      const beat=this.noteIndex%8,bar=Math.floor(this.noteIndex/8)%16,cycle=Math.floor(this.noteIndex/128),chord=CHORDS[bar],t=this.nextNote;
      if(!this.settings.muted&&this.settings.music>0){
        // Alternating finger-picked chords, a soft bass and a spacious melody.
        const arpeggio=[0,2,1,3,2,1,3,2][beat];
        this.tone(hz(chord[arpeggio]+12),t,1.4,.085,this.musicBus!,'pluck');
        if(beat===0||beat===4)this.tone(hz(chord[0]-(beat===4?0:12)),t,2.1,.095,this.musicBus!);
        const melody=MELODY[(bar+(cycle%3===2?4:0))%16][beat];
        // The quiet middle pass leaves space for the town's own sounds.
        if(melody&&!(cycle%3===1&&bar%2))this.tone(hz(melody),t+.025,1.8,.095,this.musicBus!,'pluck');
      }
      this.noteIndex++;this.nextNote+=60/72/2;
    }
  }
  private effect(){
    const ctx=this.context;if(!ctx||ctx.state!=='running'||this.settings.muted||this.settings.effects===0||document.hidden)return;
    const t=ctx.currentTime;if(t-this.lastEffect<.15)return;this.lastEffect=t;
    this.musicBus!.gain.cancelScheduledValues(t);this.musicBus!.gain.setTargetAtTime(this.settings.music*.6,t,.06);this.musicBus!.gain.setTargetAtTime(this.settings.music,t+1.1,.3);
    return t+.015;
  }
  private knock(t:number,f=150,volume=.2){this.tone(f,t,.16,volume,this.effectsBus!,'sine',f*.5);this.noise(t,.08,.1,1400);}
  private bell(t:number,f=660,volume=.12){for(const [ratio,amp] of [[1,1],[2.01,.28],[2.76,.12],[4.1,.05]])this.tone(f*ratio,t,ratio===1?1.8:.8,volume*amp,this.effectsBus!);}
  private bird(t:number){this.tone(1700,t,.13,.045,this.effectsBus!,'sine',2300);this.tone(2100,t+.16,.16,.035,this.effectsBus!,'sine',1450);}
  private water(t:number){this.noise(t,1.1,.15,1700);for(let i=0;i<5;i++)this.tone(430+i*93,t+i*.14,.12,.055,this.effectsBus!,'sine',170+i*37);}
  /** Short formant-shaped syllables: playful chatter, with no speech service. */
  private chatter(t:number,identity:number,volume=.09){
    const ctx=this.context!;const vowels=[[700,1200],[350,1900],[450,850],[500,1500]];
    for(let i=0;i<4;i++){
      if(this.voices>=68)break;
      const at=t+i*.14,pitch=145+(identity%5)*25+(i%2)*35,source=ctx.createOscillator(),gain=ctx.createGain(),filters=vowels[(identity+i)%4].map(f=>{const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=f;filter.Q.value=4;return filter;});
      this.voices++;source.type='sawtooth';source.frequency.setValueAtTime(pitch,at);source.frequency.linearRampToValueAtTime(pitch*(i===3?.78:1.12),at+.12);
      gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(volume,at+.025);gain.gain.exponentialRampToValueAtTime(.0001,at+.13);
      for(const filter of filters)source.connect(filter).connect(gain);gain.connect(this.effectsBus!);source.start(at);source.stop(at+.14);
      source.onended=()=>{source.disconnect();for(const f of filters)f.disconnect();gain.disconnect();this.voices--;};
    }
  }
  person(identity:number){const t=this.effect();if(t!==undefined)this.chatter(t,identity);}
  vehicle(){const t=this.effect();if(t===undefined)return;for(let i=0;i<6;i++)this.knock(t+i*.07,65+i*2,.08);}
  place(){const t=this.effect();if(t===undefined)return;this.knock(t,170);this.knock(t+.12,230,.12);this.tone(660,t+.19,.38,.065,this.effectsBus!,'pluck');}
  building(kind:BuildingKind,construction=false){
    const t=this.effect();if(t===undefined)return;
    if(construction){for(let i=0;i<3;i++)this.knock(t+i*.19,200+i*30);return;}
    switch(kind){
      case 'house':case 'cottage':this.knock(t,130,.13);this.tone(240,t+.1,.3,.07,this.effectsBus!,'triangle',155);this.noise(t+.25,.5,.045,900);break;
      case 'farm':this.noise(t,.8,.09,2100);this.bird(t+.18);break;
      case 'fishery':this.water(t);this.tone(300,t+.1,.45,.045,this.effectsBus!,'triangle',190);break;
      case 'park':case 'garden':this.water(t);this.bird(t+.55);break;
      case 'church':this.bell(t,294,.16);this.bell(t+.65,440,.09);break;
      case 'mill':this.noise(t,.9,.1,450);for(let i=0;i<3;i++)this.tone(145,t+i*.26,.18,.07,this.effectsBus!,'triangle',110);break;
      case 'bakery':this.noise(t,.7,.1,650);this.bell(t+.25,880,.055);break;
      case 'forester':this.knock(t,150);this.knock(t+.38,130);this.bird(t+.55);break;
      case 'sawmill':this.noise(t,.28,.19,1500,'bandpass');this.noise(t+.35,.3,.17,1200,'bandpass');this.knock(t+.7,140);break;
      case 'workshop':this.knock(t,380);this.bell(t,1100,.08);this.knock(t+.34,430);this.bell(t+.34,1320,.065);break;
      case 'quarry':this.knock(t,490);this.noise(t+.04,.18,.12,2400);this.knock(t+.42,360);break;
      case 'mine':this.knock(t,320);this.bell(t+.03,740,.065);this.noise(t+.35,.4,.07,500);break;
      case 'warehouse':this.knock(t,100,.25);this.noise(t+.12,.3,.11,720);this.knock(t+.5,170,.13);break;
      case 'tavern':this.chatter(t,3,.055);this.bell(t+.3,1400,.07);this.bell(t+.48,1650,.05);break;
      case 'market':this.chatter(t,1,.065);this.bell(t+.45,1800,.05);this.noise(t+.1,.6,.05,2000);break;
      case 'brickworks':this.noise(t,.9,.14,400);this.knock(t+.25,280);this.knock(t+.48,340,.12);break;
      case 'hunter':this.bird(t);this.tone(230,t+.3,.24,.075,this.effectsBus!,'pluck',170);this.noise(t+.4,.4,.05,1500);break;
      case 'butcher':this.knock(t,180,.17);this.knock(t+.22,200,.14);this.noise(t+.48,.22,.08,2400,'bandpass');break;
    }
  }
}
