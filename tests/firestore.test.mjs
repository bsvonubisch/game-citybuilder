import { test, before, after } from "node:test";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-citybuilder",
    firestore: {
      rules: await readFile(
        new URL("../firestore.rules", import.meta.url),
        "utf8",
      ),
    },
  });
});
after(async () => {
  await env?.cleanup();
});
const payload = (ownerId = "alice") => ({
  ownerId,
  name: "Pinehaven",
  schemaVersion: 1,
  snapshot: '{"version":2}',
  updatedAt: serverTimestamp(),
});
test("only the authenticated owner can save and read a private town", async () => {
  const alice = env.authenticatedContext("alice").firestore(),
    bob = env.authenticatedContext("bob").firestore(),
    guest = env.unauthenticatedContext().firestore();
  await assertSucceeds(
    setDoc(doc(alice, "privateSaves/alice/towns/own"), payload()),
  );
  await assertSucceeds(getDoc(doc(alice, "privateSaves/alice/towns/own")));
  await assertFails(getDoc(doc(bob, "privateSaves/alice/towns/own")));
  await assertFails(
    setDoc(doc(bob, "privateSaves/alice/towns/own"), payload("bob")),
  );
  await assertFails(getDoc(doc(guest, "privateSaves/alice/towns/own")));
});
test("save schema rejects forged owners, extra fields, and oversized payloads", async () => {
  const db = env.authenticatedContext("alice").firestore();
  await assertFails(
    setDoc(doc(db, "privateSaves/alice/towns/wrong-owner"), payload("bob")),
  );
  await assertFails(
    setDoc(doc(db, "privateSaves/alice/towns/extra"), {
      ...payload(),
      admin: true,
    }),
  );
  await assertFails(
    setDoc(doc(db, "privateSaves/alice/towns/large"), {
      ...payload(),
      snapshot: "x".repeat(800001),
    }),
  );
});
test("clients cannot write or read reserved multiplayer world state", async () => {
  const db = env.authenticatedContext("alice").firestore();
  await assertFails(
    setDoc(doc(db, "worlds/shared/state/current"), { gold: 99999 }),
  );
  await assertFails(getDoc(doc(db, "worlds/shared/state/current")));
});
