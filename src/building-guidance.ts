import {isHome} from "./catalog.js";
import { BUILDINGS, type BuildingKind } from "./catalog.js";
import type { Building, Simulation } from "./simulation.js";
import type { ProductionConnections } from "./logistics.js";
import { isLeisure, serviceCoverage } from "./proximity.js";

export type GuidanceAction =
  | { type: "build"; kind: BuildingKind | "road" }
  | { type: "inspect"; id: number }
  | { type: "agent"; id: number }
  | { type: "toggle" | "move" | "water" | "workforce" | "deepen" };
export interface BuildingGuidance {
  message: string;
  label: string;
  action: GuidanceAction;
}

/** Advice reflects existing suppliers, routes and deliveries before proposing
 * new construction. Read-only: selecting the suggested tool never builds it. */
export function buildingGuidance(
  sim: Simulation,
  b: Building,
  view?: ProductionConnections | null,
): BuildingGuidance | null {
  const alert = sim.alert(b);
  if (!alert) return null;
  const build = (
    kind: BuildingKind | "road",
    message: string,
  ): BuildingGuidance => ({
    message,
    label:
      kind === "road"
        ? "Connect road"
        : `Build ${BUILDINGS[kind].name.toLowerCase()}`,
    action: { type: "build", kind },
  });
  const inspect = (other: Building, message: string): BuildingGuidance => ({
    message,
    label: `Check ${BUILDINGS[other.kind].name.toLowerCase()}`,
    action: { type: "inspect", id: other.id },
  });
  if ((b.construction && !b.enabled) || alert.kind === "paused")
    return {
      message:
        "Resume work to assign residents and continue from the saved progress.",
      label: b.construction ? "Resume construction" : "Resume production",
      action: { type: "toggle" },
    };
  if (!b.connected) {
    const warehouse = sim.state.buildings.find(
      (other) =>
        other.kind === "warehouse" &&
        (!other.construction || !!other.construction.upgradeLevel),
    );
    if (!warehouse && b.kind !== "warehouse") {
      const site = sim.state.buildings.find(
        (other) => other.kind === "warehouse",
      );
      if (site)
        return inspect(
          site,
          "A warehouse is already under construction. Check its builders and road access before adding another.",
        );
      return build(
        "warehouse",
        "Build a warehouse and join its front entrance to this building with roads. Buildings need that connection for workers and deliveries.",
      );
    }
    return build(
      "road",
      b.kind === "park"
        ? "Connect any of the four sides to the warehouse road network. The square's rotation does not affect access."
        : "Draw a continuous road from the highlighted front entrance to a warehouse's front road. The entrance arrow turns green when it reaches the road.",
    );
  }
  if (alert.kind === "workers" || (b.construction && !b.workers)) {
    const idle = sim.state.residents.filter((r) => r.job === null).length;
    if (idle) {
      const disconnected = sim.state.buildings.find(
        (home) =>
          isHome(home.kind) && !home.connected && !home.construction,
      );
      if (disconnected)
        return inspect(
          disconnected,
          "Some residents have no job but their home is disconnected. Connect that home's front road to this town's warehouse network.",
        );
    }
    if (b.construction) {
      const workplace = sim.state.buildings.find(
        (other) =>
          other.id !== b.id &&
          other.enabled &&
          !other.construction &&
          other.workers > 0 &&
          BUILDINGS[other.kind].recipe,
      );
      if (workplace)
        return inspect(
          workplace,
          "All available builders are occupied. Temporarily pause this workplace from More actions to free residents for construction, then resume it afterward.",
        );
      return {
        message:
          "Check available residents and connected homes. Builders are assigned automatically when a resident and a road route are available.",
        label: "View workforce",
        action: { type: "workforce" },
      };
    }
    return build(
      "house",
      "Build and connect more homes to provide workers. If everyone already has a job, temporarily pause a workplace from More actions to free builders.",
    );
  }
  if (alert.kind === "construction") {
    const builder = sim.state.agents.find(
      (a) =>
        a.onsite === b.id ||
        (a.resident !== null &&
          sim.state.residents.some(
            (r) => r.id === a.resident && r.job === b.id,
          )),
    );
    return builder
      ? {
          message:
            "Builders travel to the site and contribute labor after arriving. Follow a builder to check the journey; construction finishes automatically.",
          label: "Follow a builder",
          action: { type: "agent", id: builder.id },
        }
      : {
          message:
            "Builders will walk here automatically. Check your available workforce while they prepare to leave.",
          label: "View workforce",
          action: { type: "workforce" },
        };
  }
  if(alert.kind==="road")return build("road","Connect this entrance to a warehouse with dirt, stone or brick roads. Pedestrian pavements carry people only; keep a vehicle route for deliveries.");
  if (alert.kind === "depleted")
    return {
      message:
        "Keep this site. Dig deeper to unlock another large layer at the same deposit. Check the materials below; builders do the excavation and your inventory is retained.",
      label: "Dig deeper",
      action: { type: "deepen" },
    };
  if (alert.kind === "leisure" && alert.title === "Needs nearby religion") {
    const church=sim.state.buildings.find(s=>s.kind==="church"&&serviceCoverage(sim,s).homes.some(h=>h.home.id===b.id));
    return church?inspect(church,"Check this church’s two staff, road connection and capacity. Visits run from 08:00 to 20:00; upgrade to serve more residents."):build("church","Build a church within 20 road tiles of this home. The placement preview highlights homes in reach; residents improve religion after arriving.");
  }
  if (alert.kind === "leisure") {
    const nearby = sim.state.buildings.find(
      (s) =>
        isLeisure(s.kind) &&
        serviceCoverage(sim, s).homes.some((h) => h.home.id === b.id),
    );
    return nearby
      ? inspect(
          nearby,
          "A leisure building is close enough. Check its opening hours, staff and capacity; upgrading serves more neighbours.",
        )
      : build(
          "tavern",
          "Place an evening tavern within 14 road tiles of this home. Its preview highlights the homes it can serve; visits improve leisure after residents arrive.",
        );
  }
  if (b.kind === "forester" && alert.kind === "input")
    return {message:"Stumps regrow into mature trees after two minutes. Keep a clear land route to natural oak, pine or birch trees within the highlighted area, or move the lodge closer to woodland. Planted garden trees stay protected.",label:"Move near woodland",action:{type:"move"}};
  if (["quarry","mine"].includes(b.kind) && alert.kind==="input")return{message:"Workers need a clear land route from this workplace's entrance to an exposed rock face within 8 tiles. Clear obstacles or move closer to the matching deposit; roads must reach the workplace but do not need to cover the rocks.",label:"Move beside deposit",action:{type:"move"}};
  if (b.kind === "fishery" && alert.kind === "input")
    return {
      message:
        "The boat needs at least three connected open-water tiles beyond its pier, clear of bridge decks and other piers. Adjust the shore or move the fishery; another boat may temporarily be using the route.",
      label: "Adjust shoreline",
      action: { type: "water" },
    };
  if (alert.kind === "input" || alert.kind === "output") {
    const input = alert.kind === "input",
      recipe = BUILDINGS[b.kind].recipe!;
    const delivery = sim.state.agents.find(
      (a) =>
        a.amount > 0 &&
        a.cargo === (input ? recipe.input : recipe.output) &&
        (input ? a.target === b.id : a.source === b.id),
    );
    if (delivery)
      return {
        message: `A delivery is already ${input ? "bringing supplies" : "collecting goods"}. Follow the truck to check its route and any traffic delay.`,
        label: "Follow delivery",
        action: { type: "agent", id: delivery.id },
      };
    const links = input ? view?.inputs : view?.outputs;
    const linked = links?.find((link) => link.path) ?? links?.[0];
    if (linked) {
      const other = sim.building(input ? linked.source : linked.target)!;
      return inspect(
        other,
        !linked.path
          ? "This partner exists, but no road joins the two entrances. Check its road access and connect both to the same warehouse network."
          : !other.enabled
            ? "This partner is paused. Open it and resume work so the supply chain can continue."
            : `A ${input ? "supplier" : "destination"} already exists. Check its workers, stock and production; the highlighted route shows how goods travel.`,
      );
    }
    const next =
      (Object.keys(BUILDINGS) as BuildingKind[]).find((kind) =>
        input
          ? BUILDINGS[kind].recipe?.output === recipe.input
          : BUILDINGS[kind].recipe?.input === recipe.output,
      ) ?? "warehouse";
    const site = sim.state.buildings.find(
      (other) => other.kind === next && other.construction,
    );
    return site
      ? inspect(
          site,
          "The required building is already under construction. Check its progress instead of building another.",
        )
      : build(
          next,
          `Add a ${BUILDINGS[next].name.toLowerCase()} and connect its front entrance to the same road network to ${input ? "supply this building" : "collect this output"}.`,
        );
  }
  return null;
}
