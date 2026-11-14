import { initializeApp, type FirebaseOptions } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { parseSave, type World } from "./simulation.js";
export class CloudSaves {
  auth: Auth | null = null;
  db: Firestore | null = null;
  error = "";
  constructor() {
    try {
      const raw = (import.meta as ImportMeta & { env: Record<string, string> })
        .env.VITE_FIREBASE_CONFIG;
      if (!raw) return;
      const config = JSON.parse(raw) as FirebaseOptions;
      if (!config.apiKey || !config.projectId || !config.appId)
        throw new Error("Firebase configuration is incomplete.");
      const app = initializeApp(config);
      this.auth = getAuth(app);
      this.db = getFirestore(app);
    } catch (e) {
      this.error =
        e instanceof Error ? e.message : "Firebase setup is unavailable.";
    }
  }
  get configured() {
    return !!this.auth && !!this.db;
  }
  get user() {
    return this.auth?.currentUser ?? null;
  }
  subscribe(callback: () => void) {
    return this.auth ? onAuthStateChanged(this.auth, callback) : () => {};
  }
  async signIn(guest = false) {
    if (!this.auth)
      throw new Error("Add FIREBASE_WEB_CONFIG to enable cloud saves.");
    if (guest) await signInAnonymously(this.auth);
    else await signInWithPopup(this.auth, new GoogleAuthProvider());
  }
  async signOut() {
    if (this.auth) await signOut(this.auth);
  }
  async save(world: World) {
    if (!this.user || !this.db)
      throw new Error("Sign in to save to the cloud.");
    await setDoc(
      doc(this.db, "privateSaves", this.user.uid, "towns", "pinehaven"),
      {
        ownerId: this.user.uid,
        name: "Pinehaven",
        schemaVersion: 1,
        snapshot: JSON.stringify(world),
        updatedAt: serverTimestamp(),
      },
    );
  }
  async load(): Promise<World> {
    if (!this.user || !this.db)
      throw new Error("Sign in to load from the cloud.");
    const snapshot = await getDoc(
      doc(this.db, "privateSaves", this.user.uid, "towns", "pinehaven"),
    );
    if (!snapshot.exists())
      throw new Error("No cloud save yet. Save this town first.");
    return parseSave(snapshot.data().snapshot);
  }
}
export function cloudError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "auth/operation-not-allowed")
    return "Enable this sign-in provider in Firebase Authentication first.";
  if (code === "auth/unauthorized-domain")
    return "Add this site’s domain to Firebase Authentication’s authorized domains.";
  if (code === "permission-denied")
    return "Cloud access was denied. Deploy the project’s Firestore rules.";
  if (code === "auth/popup-closed-by-user")
    return "Sign-in was closed. Your local town is safe.";
  return error instanceof Error
    ? error.message
    : "Could not connect. Your local town is safe.";
}
