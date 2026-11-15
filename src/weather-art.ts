import type Phaser from "phaser";
import { cameraViewport } from "./rendering.js";
import { daylight } from "./daylight.js";
import { weather, rainStrokes } from "./weather.js";

/** Bounded screen effects; no per-drop game objects or full-map rain texture. */
export class WeatherArt {
  private rain: Phaser.GameObjects.Graphics;
  private shade: Phaser.GameObjects.Graphics;
  private fog: Phaser.GameObjects.Image[] = [];
  constructor(private scene:Phaser.Scene) {
    this.shade=scene.add.graphics().setDepth(4988);
    this.rain=scene.add.graphics().setDepth(4990);
    const texture=scene.textures.exists("weather-mist")?scene.textures.get("weather-mist"):scene.textures.createCanvas("weather-mist",128,64)!;
    if("context" in texture){
      const ctx=(texture as Phaser.Textures.CanvasTexture).context;
      const glow=ctx.createRadialGradient(64,32,0,64,32,64);
      glow.addColorStop(0,"rgba(210,225,220,.65)");glow.addColorStop(1,"rgba(210,225,220,0)");
      ctx.fillStyle=glow;ctx.fillRect(0,0,128,64);(texture as Phaser.Textures.CanvasTexture).refresh();
    }
    for(let i=0;i<5;i++)this.fog.push(scene.add.image(0,0,"weather-mist").setDepth(4990));
  }
  update(tick:number) {
    const c=this.scene.cameras.main,v=cameraViewport(c),w=weather(tick),time=tick*.25;
    this.shade.clear().fillStyle(0x526b78,w.cloud*.14).fillRect(v.x,v.y,v.width,v.height);
    this.rain.clear().setPosition(v.x,v.y).setScale(1/c.zoom);
    const night=daylight(tick).darkness;
    if(w.rain>.01)for(const drop of rainStrokes(c.width,c.height,time,w.rain)){
      this.rain.lineStyle(1,0xd2e7ed,drop.alpha*(1-night*.4));
      this.rain.lineBetween(drop.x,drop.y,drop.x+drop.length*.23,drop.y+drop.length);
    }
    this.fog.forEach((fog,i)=>{
      const x=((i*.31+time*.003)%1)*1.4-.2,y=.2+(i%3)*.27;
      fog.setPosition(v.x+x*v.width,v.y+y*v.height).setDisplaySize(v.width*.9,v.height*.4)
        .setAlpha(w.mist*.22*(1-night*.55)).setVisible(w.mist>.001);
    });
  }
  clear(){this.shade.destroy();this.rain.destroy();this.fog.forEach(f=>f.destroy());}
}
