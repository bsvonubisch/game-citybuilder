import {
  Simulation,
  type Command,
  type Result,
  type World,
} from "./simulation.js";
/** UI depends on this boundary. A future Firebase transport submits commands to a server authority. */
export interface WorldGateway {
  readonly simulation: Simulation;
  command(command: Command): Promise<Result>;
  snapshot(): World;
}
export class LocalGateway implements WorldGateway {
  constructor(public simulation: Simulation) {}
  async command(command: Command) {
    return this.simulation.execute({
      id: crypto.randomUUID(),
      actorId: "local",
      expectedRevision: this.simulation.state.revision,
      command,
    });
  }
  snapshot() {
    return this.simulation.snapshot();
  }
}
