import Phaser from "phaser";

export type ArtworkMode = "auto" | "smooth" | "crisp";
const PREFERENCE = "little-works.artwork-scaling";
let mode: ArtworkMode = "auto";
let smooth = true;
try {
  const saved = localStorage.getItem(PREFERENCE);
  if (saved === "auto" || saved === "smooth" || saved === "crisp") mode = saved;
} catch {
  /* Rendering still works when device storage is unavailable. */
}

export const artworkMode = () => mode;
const filter = () =>
  smooth
    ? Phaser.Textures.FilterMode.LINEAR
    : Phaser.Textures.FilterMode.NEAREST;
const filterTexture = (_key: string, texture: Phaser.Textures.Texture) =>
  texture.setFilter(filter());

function apply(game: Phaser.Game) {
  document.documentElement.dataset.artworkMode = mode;
  document.documentElement.dataset.artwork = smooth ? "smooth" : "crisp";
  game.canvas.style.imageRendering = smooth ? "auto" : "pixelated";
  // Also controls newly created and refreshed terrain/foundation canvases.
  (game.renderer.config as { antialias: boolean }).antialias = smooth;
  if (game.renderer instanceof Phaser.Renderer.Canvas.CanvasRenderer)
    game.renderer.antialias = smooth;
  for (const key of game.textures.getTextureKeys())
    game.textures.get(key).setFilter(filter());
}

export function setupArtworkScaling(game: Phaser.Game) {
  smooth = mode !== "crisp";
  apply(game);
  game.textures.on(Phaser.Textures.Events.ADD, filterTexture);
  game.events.once(Phaser.Core.Events.DESTROY, () =>
    game.textures.off(Phaser.Textures.Events.ADD, filterTexture),
  );
}

export function updateArtworkScaling(
  game: Phaser.Game,
  zoom: number,
  force = false,
) {
  // Separate entry/exit thresholds prevent filter flicker during a pinch gesture.
  const next =
    mode === "smooth"
      ? true
      : mode === "crisp"
        ? false
        : smooth
          ? zoom < 2
          : zoom <= 1.85;
  if (next === smooth && !force) return;
  smooth = next;
  apply(game);
}

export function setArtworkMode(
  game: Phaser.Game,
  value: ArtworkMode,
  zoom: number,
) {
  mode = value;
  updateArtworkScaling(game, zoom, true);
  try {
    localStorage.setItem(PREFERENCE, mode);
  } catch {
    /* Keep this session's choice. */
  }
}
