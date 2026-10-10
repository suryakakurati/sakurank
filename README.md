# sakurank

## Stack

Next.js 16, React, TypeScript, CSS, Sharp, **no database**. All application data lives in one JSON document (`collection.json`) plus a poster folder (`posters/`):

- **Development/tests:** `data/collection.json` and `data/posters/` in the project folder.
- **Production on Vercel:** the same two items in **Vercel Blob** storage connected to the project.

No PostgreSQL, no Supabase, no connection strings. Owner authentication uses scrypt and random, document-backed revocable sessions. Every mutation endpoint requires the owner session and the configured request Origin.

## Install and run

Use Node.js 22 LTS or newer and npm.

```bash
npm ci
cp .env.example .env.local
npm run owner:password
# Paste the generated hash into OWNER_PASSWORD_HASH in .env.local.
# Generate SESSION_SECRET with: openssl rand -hex 32
npm run dev
```

Open http://localhost:3000. Set `APP_ORIGIN` to that exact origin. The password tool requires an interactive terminal, hides the password, and requires at least 16 characters. Never put the password or privileged credentials in `NEXT_PUBLIC_*` variables. The generated hash is also sensitive. Keep `.env.local` private.

```bash
npm run typecheck
npm test
npm run build
npm start
```

Development uses Webpack with `.local`, `data`, test artifacts, and dependency files excluded from watching, so saving an entry never triggers Fast Refresh churn. There is no background polling or focus-triggered session refresh. The background is the owner's own artwork (`background/image.png`), optimized to `public/night-background.webp` (1920 px) and `public/night-background-small.webp` (1024 px) with a readability scrim over it. Regenerate both with Sharp if the source changes. Cards fade in once; reduced-motion disables that. Stop the app with Ctrl+C when finished.

`npm run build` also runs Webpack (the watcher exclusion is a webpack setting). Build does not need storage; the first request creates the JSON document automatically. `npm start` in production requires `BLOB_READ_WRITE_TOKEN`; the app refuses to use a deployment's ephemeral filesystem for production data.

## Storage model

`collection.json` holds the collection, cover-import mappings, owner session hashes, login rate limits, and a short-lived metadata cache. Poster bytes live in `posters/<sha256>.webp`. Images are validated, decoded, resized without distortion, stripped of metadata, and converted to WebP; identical images are stored once. Browsers request `/api/posters/<hash>.webp`, never the storage provider directly.

Writes are read-modify-write with two protections: in-process serialization and, on Vercel Blob, ETag conditional writes with retries. For a single owner this is safe; two people editing at the exact same instant is outside the design.

Backups: development is just the `data` folder; production means exporting the Blob store. Back up both the JSON document and the poster objects. Deleting an entry keeps its poster objects because identical artwork can be shared; remove stale cover mappings before deleting objects.

**Vercel Blob setup:** in the Vercel dashboard open **Storage → Blob → Create store**, connect it to the sakurank project, and Vercel injects `BLOB_READ_WRITE_TOKEN`. No separate account or database is needed. Check Vercel's current Blob pricing and free-tier limits before storing a large collection. The store is private; the app only serves posters through its own routes.

**If you previously used the PostgreSQL build**, copy existing local data once:

```bash
npx tsx scripts/migrate-from-postgres.ts
```

It reads the old `DATABASE_URL` and `LOCAL_POSTER_DIR`, writes `data/collection.json`, and copies poster files. The old database is left untouched.

## Owner access

Activate the small footer flower **five times within three seconds**. Keyboard: focus the footer flower and press Enter five times. It has an accessible owner-access label but no visible hint. Login contains only password, submit, close, and errors. The owner dashboard is `/owner`; unauthenticated access redirects home. The obscure entry point is not authorization.

On `/owner`, every card has **Edit** and **Delete** buttons: Edit opens the full editor (title, cover, rating, thoughts), Delete asks for confirmation first. Search for an anime, select the right candidate, and its cover is imported automatically. Correct title/year if needed, select a whole-number rating, enter optional thoughts, preview, then save. Manual entry and manual poster replacement are supported. Delete requires confirmation. Concurrent edits are rejected rather than overwritten. Duplicate provider IDs are rejected. Notes remain plain text with exact whitespace and line breaks; no HTML/Markdown execution.

Sessions last seven days and are stored as HMAC-hashed tokens in the JSON document; log out deletes the stored session, not just the cookie. Changing the password hash invalidates nothing on its own—log out or clear the document's sessions. HTTPS production cookies are HTTP-only, Secure, and SameSite=Strict. Login has a global cap of 20 attempts per 15 minutes; this deliberately avoids trusting spoofable forwarding headers. No IP addresses are retained. If a visitor exhausts that limit, login is briefly blocked; add a hosting WAF rule if that becomes a concern.

## Metadata and artwork rights

**AniList is not used:** its current API terms prohibit use in competing list/tracker services, including media data. A personal ratings catalog is close enough that permission cannot be assumed. See https://docs.anilist.co/guide/terms-of-use.

Kitsu's documented public JSON:API provides title search, English/original titles, provider IDs, release dates and poster candidates. Official documentation: https://github.com/hummingbird-me/api-docs and https://kitsu.docs.apiary.io. Search was checked against the live API. Only necessary metadata is stored; no synopses, public community scores or fabricated personal content. Kitsu may lack an English title; fallback is romanized/canonical metadata, editable before save.

**Cover art loads automatically after selecting an anime.** The owner-only, same-origin POST `/api/metadata/<provider-id>/poster` retrieves the selected cover, optimizes it and imports it into persistent storage. The editor previews `/api/posters/<hash>.webp`; saving attaches that stored image to the entry. A provider-ID-to-cover mapping in the JSON document avoids repeat downloads; a missing file is re-fetched automatically. Artwork rights remain with their respective owners—automatic retrieval is a technical feature, not a redistribution license. Review applicable provider terms before public deployment and honor removal requests.

Metadata calls have a 12-second timeout, a six-hour document-backed cache, and owner-only access. Saved browsing has no dependency on Kitsu. Search errors preserve editing and allow manual entry. Stored covers remove browser reliance on external image hosts but **UCF or other university Wi-Fi compatibility has not been tested or guaranteed**.

## Vercel deployment

1. Push the repository to your own Git host (not done automatically) and import it into Vercel as a Next.js project. Use `npm ci`, `npm run build`, and Node 22 or newer.
2. Create and connect a Vercel Blob store so `BLOB_READ_WRITE_TOKEN` is injected. Set `APP_ORIGIN`, `OWNER_PASSWORD_HASH`, and `SESSION_SECRET` as environment variables. Do not set `DATA_DIR` in production.
3. Deploy. Vercel provides HTTPS for its assigned domain. For a custom domain, add it under Project Settings → Domains, follow the displayed DNS records, wait for certificate issuance, then update `APP_ORIGIN` and redeploy. Redirect alternate domains to the canonical origin.
4. Verify the checklist below **on the deployed URL**. No cloud deployment has been performed by local tests.

### Production verification checklist

- HTTPS certificate valid; canonical domain redirects work.
- Add an anime, confirm its cover imports, then refresh and reopen it.
- Log out on one device; the other session can be used or revoked by editing the document's `sessions` array.
- Direct unauthenticated POST/PUT/DELETE and cross-origin mutation requests return 401/403.
- Wrong password rejected; cookie shows HTTP-only, Secure, SameSite=Strict.
- Redeploy and confirm the same entry and cover still load from Blob storage.
- Block Kitsu requests; existing collection and covers still load.
- Inspect public responses/bundles for secrets. Do not publish local credentials.

## Tests

Unit tests need no external services. Browser tests need Chromium:

```bash
npx playwright install chromium
npm run test:e2e
```

If your development server is already running, tests run against an isolated copy without stopping it:

```bash
rm -rf .local/e2e-app && mkdir -p .local/e2e-app && cp -R src public package.json next.config.ts tsconfig.json .local/e2e-app/ && ln -s "$PWD/node_modules" .local/e2e-app/node_modules
E2E_APP_DIR=.local/e2e-app npm run test:e2e
```

Tests use a disposable `.local/e2e-data` folder and test-only credentials; they never touch `data/`. Tests cover hidden keyboard login, wrong credentials, anonymous mutation rejection, CSRF, expired sessions, logout replay, integer rating validation, duplicate provider IDs, edit conflicts, confirmed deletion, exact thoughts, poster upload and persistence, automatic cover import, search and sorting controls, mobile overflow, broken-image fallback, and login throttling. Live provider and deployed-cloud persistence require separate checks; fixtures are not a live API guarantee.
