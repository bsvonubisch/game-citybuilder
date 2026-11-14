# Multiplayer with Firebase

The current app is single-player, with optional authenticated private cloud saves. It is not an authoritative multiplayer game yet.

## Existing seams

The simulation has no browser dependency and advances in fixed 250 ms ticks. Commands describe intent (`place`, `demolish`, `toggle`) rather than supplying balances or inventory. Envelopes carry an actor, command ID, and expected topology revision. The local authority validates placement and resource spending. The interface invokes `WorldGateway`; its current implementation is `LocalGateway`.

State is JSON-serializable and versioned. Assets and rendering do not affect the economic simulation. Pathfinding and production ordering are deterministic for the same state and ordered inputs. Random command IDs belong to transport, not to simulation decisions.

## Authoritative shared worlds

1. Firebase Authentication provides a user ID. The backend verifies the Firebase ID token; it must not trust `actorId` sent by the browser.
2. A server authorizes world membership and writes membership records. Firestore stores world metadata, membership, ordered commands, periodic snapshots, and small presence records.
3. A callable function or authenticated endpoint validates command shape, permissions, idempotency, revision, material availability, and occupancy, then accepts the command into the world's ordered stream.
4. A server-owned simulation advances each active world. Use one leased authority per world with fencing tokens and transactional lease changes. For continuous ticks, a long-running service such as Cloud Run is a better starting point than a scheduled function per simulation tick.
5. Clients subscribe to coarse world updates and interpolate local sprite positions. Do not write every person or vehicle every animation frame to Firestore. Start with compact snapshot/delta updates roughly every 1–2 seconds, then measure bandwidth and document size.
6. Persist command deduplication and revisions at the authority. The in-memory local cache is only a prototype mechanism and is insufficient across server restarts.

The server must be the only writer of shared gold, inventories, routes, production, and occupancy. Browser Firestore rules will permit member reads and tightly scoped commands/presence only after that implementation exists. Current rules deny all shared-world access.

## Before enabling multiplayer

- Implement the backend authority, verified identity, world membership, command schema validation, and shared gateway.
- Add server-side rate limiting, duplicate-command protection, crash recovery, deterministic replay, and concurrent construction tests.
- Test Firestore rules with the emulator: unauthenticated access, cross-user access, membership changes, malformed commands, direct state mutation, and replay attempts.
- Decide host pause policy, inactive-world simulation, world capacity, costs, and reconnect/resync behavior.
- Replace single JSON snapshots with bounded/chunked world state before approaching Firestore's document size limit.

Client-authored single-player saves are intentionally separate from trusted shared worlds.
