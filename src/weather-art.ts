import type Phaser from "phaser";
import { cameraViewport } from "./rendering.js";
import { daylight } from "./daylight.js";
import { weather, worldRain, mistPatch, paintMist } from "./weather.js";

/** World-anchored weather, culled to the camera; no per-drop game objects or full-map rain texture. */
export class WeatherArt {
  private rain: Phaser.GameObjects.Graphics;
  private shade: Phaser.GameObjects.Graphics;
  private fog: Phaser.GameObjects.Image[] = [];
  constructor(private scene:Phaser.Scene) {
    this.shade=scene.add.graphics().setDepth(4988);
    this.rain=scene.add.graphics().setDepth(4990);
    const texture=scene.textures.exists("weather-mist")?scene.textures.get("weather-mist"):scene.textures.createCanvas("weather-mist",128,128)!;
    if("context" in texture){
      const ctx=(texture as Phaser.Textures.CanvasTexture).context;
      paintMist(ctx);(texture as Phaser.Textures.CanvasTexture).refresh();
    }
    for(let i=0;i<64;i++)this.fog.push(scene.add.image(0,0,"weather-mist").setDepth(4990));
  }
  update(tick:number) {
    const c=this.scene.cameras.main,v=cameraViewport(c),w=weather(tick),time=tick*.25;
    this.shade.clear().fillStyle(0x526b78,w.cloud*.14).fillRect(v.x,v.y,v.width,v.height);
    this.rain.clear();
    const night=daylight(tick).darkness;
    if(w.rain>.01)for(const drop of worldRain(v,time,w.rain,c.zoom)){
      this.rain.lineStyle(Math.max(.5,.8/c.zoom),0xd2e7ed,drop.alpha*(1-night*.4));
      this.rain.lineBetween(drop.x,drop.y,drop.x+drop.length*.23,drop.y+drop.length);
    }
    this.fog.forEach((fog,i)=>{
      const p=mistPatch(i,time);
      fog.setPosition(p.x,p.y).setDisplaySize(p.width,p.height)
        .setAlpha(w.mist*.3*(1-night*.55)).setVisible(w.mist>.001&&p.x+p.width/2>v.x&&p.x-p.width/2<v.x+v.width&&p.y+p.height/2>v.y&&p.y-p.height/2<v.y+v.height);
    });
  }
  clear(){this.shade.destroy();this.rain.destroy();this.fog.forEach(f=>f.destroy());}
}
