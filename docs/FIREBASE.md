# Firebase setup

Project: `vu-citybuilder`. Products: Authentication, Firestore, Hosting.

## GitHub configuration

In **Repository → Settings → Secrets and variables → Actions**, keep:

| Name | Value | Purpose |
|---|---|---|
| `FIREBASE_WEB_CONFIG` | The complete web app configuration JSON supplied for this project | Included in the browser build as `VITE_FIREBASE_CONFIG` |

As with Spyfall, GitHub runs tests and builds. Deployment uses the Firebase CLI with the project owner's existing authenticated account. This does not require a service-account secret in GitHub. Automatic GitHub deployment is not enabled. The browser configuration is not an admin credential.

CI runs on main pushes, pull requests, or manually from **Actions → Check game → Run workflow**. It does not deploy or configure Authentication providers. Use the manual deployment commands below with the existing Firebase login.

## Authentication

1. Open Firebase Console → Authentication → Sign-in method.
2. Enable Google, including a project support email.
3. Optionally enable Anonymous for the Guest button.
4. Under Authentication settings, allow the actual Hosting domain and local development domains you use. New projects may not include localhost by default. Add `127.0.0.1` when using the provided local preview.

Google sign-in supports returning from another device. An anonymous account is tied to its browser session and is intended only for guest saves. Account linking/upgrading is future work. Analytics is intentionally not initialized.

## Firestore

Create the default Firestore database in production mode. Deploy the checked-in rules and index configuration from an authenticated Firebase CLI:

```sh
firebase deploy --only firestore:rules,firestore:indexes --project vu-citybuilder
```

Or paste `firestore.rules` into Firebase Console → Firestore → Rules and publish them. Do not use test-mode public access.

Private saves live at `privateSaves/{uid}/towns/pinehaven`. Only the matching signed-in UID can read/write/delete the save. The schema requires the matching owner, a bounded JSON snapshot, and a server timestamp. Loading validates the game data before replacing the running town.

Shared-world paths are denied to browser clients until the authoritative multiplayer service is implemented. Private saves must never be promoted directly to trusted multiplayer state.

## Deploy manually

With the web configuration supplied as `VITE_FIREBASE_CONFIG`:

```sh
npm ci
npm test
npm run build
firebase deploy --only hosting,firestore:rules,firestore:indexes --project vu-citybuilder
```

## References

- [Firebase Hosting GitHub integration](https://firebase.google.com/docs/hosting/github-integration)
- [Firebase API keys and application security](https://firebase.google.com/docs/projects/api-keys)
- [Firestore ownership rules](https://firebase.google.com/docs/firestore/security/rules-conditions)

Live authentication, cloud-save access, and production hosting must be verified after the project configuration and secrets are complete. No successful production deployment is implied by checking in this configuration.
