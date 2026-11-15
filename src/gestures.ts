type Contact = { x: number; y: number };
export interface MapGesture {
  from: Contact;
  to: Contact;
  scale: number;
}
/** Touch state is independent of the current build tool. A drag or a multi-touch
 * session can never become a placement tap when the last finger is released. */
export class MapTouches {
  get count() { return this.contacts.size; }
  private contacts = new Map<number, Contact>();
  private previous: Contact[] = [];
  private travelled = false;
  start(id: number, p: Contact) {
    if (!this.contacts.size) this.travelled = false;
    this.contacts.set(id, p);
    this.previous = [...this.contacts.values()];
    if (this.contacts.size > 1) this.travelled = true;
  }
  move(id: number, p: Contact): MapGesture | null {
    if (!this.contacts.has(id)) return null;
    this.contacts.set(id, p);
    const current = [...this.contacts.values()];
    const center = (ps: Contact[]) =>
      ps.length > 1
        ? { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 }
        : ps[0];
    const from = center(this.previous),
      to = center(current);
    if (!this.travelled && Math.hypot(to.x - from.x, to.y - from.y) < 8)
      return null;
    this.travelled = true;
    const distance = (ps: Contact[]) =>
      Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
    const scale =
      current.length > 1 && this.previous.length > 1
        ? distance(current) / Math.max(1, distance(this.previous))
        : 1;
    this.previous = current;
    return { from, to, scale };
  }
  end(id: number) {
    const tap =
      this.contacts.has(id) && this.contacts.size === 1 && !this.travelled;
    this.contacts.delete(id);
    this.previous = [...this.contacts.values()];
    return tap;
  }
  cancel() {
    this.contacts.clear();
    this.previous = [];
    this.travelled = true;
  }
}
export function gestureCamera(
  c: {
    scrollX: number;
    scrollY: number;
    width: number;
    height: number;
    zoom: number;
  },
  g: MapGesture,
) {
  const zoom = Math.min(2.7, Math.max(0.55, c.zoom * g.scale));
  const wx = c.scrollX + c.width / 2 + (g.from.x - c.width / 2) / c.zoom;
  const wy = c.scrollY + c.height / 2 + (g.from.y - c.height / 2) / c.zoom;
  return {
    zoom,
    scrollX: wx - c.width / 2 - (g.to.x - c.width / 2) / zoom,
    scrollY: wy - c.height / 2 - (g.to.y - c.height / 2) / zoom,
  };
}
