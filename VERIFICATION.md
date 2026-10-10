# Verification

## Search-to-grid spacing

Added 30px margin below the search/sort row on desktop and 24px on mobile. Verified actual rendered distance from search-row bottom to first anime card top: 30px at 1440px and 24px at 375px. TypeScript passed. Only CSS and verification documentation changed.

## Control glass and rating filter removal

Removed the collection rating-range picker and its server-side query filtering/validation; displayed entry ratings remain unchanged. Search and sort are still available. Search and sort controls now use a translucent lavender-white glass fill (`rgba(233, 224, 241, 0.15)`), blurred background, and soft border instead of dark-purple fills.

After these edits, typecheck passed, all 29 unit tests passed, and all 7 browser/API acceptance tests passed. Browser computed styles confirmed 15% glass fill and `blur(18px) saturate(1.25)`; zero min/max rating controls; responsive 375/1440 px without overflow. No known limitations.

## Softer background scrim

The dimming over the personal artwork was reduced from a near-uniform 0.60/0.72/0.88 alpha to 0.65→0.35→clear across the header band, almost no tint behind the upper artwork, and 0.18/0.55 toward the bottom; the edge vignette dropped from 0.40 to 0.20. Legibility is preserved with text shadows on wordmark/nav/labels and a subtle chip background on owner nav links.

Measured on the running app (mean band luminance, 0–255): header band went from 66 before to **96** after at 1440px, and 91 at 375px — the artwork is no longer flattened. Text shadows confirmed applied; no horizontal overflow at 375/1440. A first mobile measurement read 23 (flat background) because the screenshot was taken during a viewport switch before the mobile asset painted; re-measured with fresh page loads the artwork paints correctly at both widths (computed style resolves to `night-background-small.webp` at 375). No application code or tests changed; only `src/app/globals.css`.

## Owner actions and personal background

Owner cards now show explicit **Edit** and **Delete** buttons (Delete opens a confirmation dialog); delete also remains inside the editor. Replaced the generated SVG scene with the owner's `background/image.png`, optimized to 284 KB WebP at 1920 px plus a 96 KB variant at 1024 px for mobile, with a dark scrim guaranteeing readable text over the bright artwork (source means R137/G108/B198). The unused SVG was removed.

Verified after these changes: TypeScript and 29 unit tests passed; 7 browser/API tests passed with the card-level delete flow (the isolation copy was refreshed first); production build passed with its exit status captured. On the running app: both background assets return 200 and the artwork is applied, no horizontal overflow at 375/1440 px, `/owner` shows 2 cards each with Edit and Delete, the delete dialog names the entry, and Cancel preserved both entries—no data was changed during verification.

## Database-free JSON storage revision

Replaced PostgreSQL/Supabase with one JSON document (`collection.json`) plus a poster folder (`posters/`). Development stores them in `data/`; production uses Vercel Blob with ETag conditional writes. Reads no longer rewrite the document. Sessions, login limits and metadata cache live in the same JSON. Removed the migration command; `scripts/migrate-from-postgres.ts` imports prior local PostgreSQL data. Also fixed the search focus ring so the outline wraps the search pill instead of overflowing it, and the production build now runs Webpack to match the watcher exclusion.

The user's one existing entry (`Weathering with You`, 10/10) was migrated from the old PostgreSQL into `data/collection.json` with its cover copied to `data/posters/`; a live request to the running app returned it with a 200 `image/webp` cover. A stale cover mapping pointing at a deleted file was removed, and imports now self-heal by re-downloading when a mapped file is missing. The old database was left untouched.

Checks after this revision: TypeScript passed; 29 unit tests passed (document store round-trip, 20 concurrent serialized writes, poster folder ops, path-traversal rejection, cover import reuse/re-download/failure paths); 7 browser/API tests passed (including the search focus area, automatic cover import, and the JSON-backed sessions/limits); production build passed in an isolated copy of the project. Tests ran against `.local/e2e-data` while the user's dev server stayed up on port 3000; no services were started or stopped by these checks. A production `next start` without `BLOB_READ_WRITE_TOKEN` was also exercised: `/api/anime` returned 503 with a generic error and no `data` folder was created, confirming the app refuses to write to an ephemeral deployment filesystem rather than silently using it. Cloud Blob storage has not been exercised—no Vercel project or Blob store was configured.

## Night-garden UI refinement

Added locally served `public/night-garden.svg` (5,474 bytes): original decorative pastel aurora, crescent moon, distant hills, sakura branches and edge flowers. Removed orbital geometry and hard poster framing; softened controls and dialogs. Aurora motion uses a finite opacity animation, no canvas/timers/remote assets. Reduced-motion disables it.

After this refinement: TypeScript and 23 unit tests passed. Chromium checks on the already-running app confirmed the SVG loads, CSS uses it, no horizontal overflow at 375/768/1440px, reduced-motion disables aurora animation, and keyboard hidden login/Escape work without page errors. Screenshots: `.local/night-garden-*.png`. No services were started or restarted. Production build was not rerun for this visual refinement.

## Automatic cover revision

Selecting a Kitsu candidate now calls a protected same-origin POST to import its cover into persistent storage before preview/save. Stored imports are reused by provider ID. The `POSTER_IMPORT_ALLOWED` gate was removed. Migration `003_poster_imports.sql` must be applied before testing this workflow.

After these edits, TypeScript passed and 23 unit tests passed (including automatic import, cached reuse, invalid-ID rejection, download failures, and storage failures). A live Kitsu cover for ID 46474 was fetched and decoded/optimized successfully to a 550×780 WebP (84,542 bytes). That network/decoder smoke check did not exercise database storage or the editor. The full updated acceptance suite was not run. During the final check, the app/database had already been restarted separately: migration 003 was applied, actual authenticated import and stored same-origin WebP retrieval passed, and a second import reused the same stored key. Chromium then searched Frieren, selected its real candidate and verified that the editor image fully loaded with nonzero dimensions. The dialog was cancelled; no collection entry was created. No services were started or restarted by these checks. No cloud storage verification has been performed. Artwork redistribution rights are not certified by these technical checks.

## Resource and visual revision

The app server and project-local PostgreSQL were stopped at the user's request and were not restarted for this revision. Development logs showed repeated recompiles. Development now explicitly uses Webpack and excludes `.local` (database, logs and posters), test artifacts and dependencies from watching. Focus-triggered session requests and redundant logout refresh were removed; collection detail prefetch is disabled. The suspected generated-file refresh feedback loop has not been reproduced under a restarted server, so the live refresh fix is not claimed as verified.

The revised celestial styling uses static atmosphere, framed posters, restrained entrances and four small finite opacity animations, with reduced-motion support. No timers, canvas, animation libraries, copied game assets, slogans or sample content were added.

After these edits: TypeScript passed, all 18 unit tests passed, and offline Chromium CSS checks passed at 375/768/1440px with no horizontal overflow and reduced-motion disabling animations. Watcher configuration was exercised directly and includes local generated-file exclusions. Screenshots are saved locally in `.local/mystical-*.png`. These CSS checks are not a full running-app acceptance test. Build and database/browser integration tests were not rerun for this revision to honor the shutdown/resource request; earlier results below apply to the prior revision.

Local checks completed on October 10, 2026:

- `npm run typecheck`: passed.
- `npm test`: 18 tests passed.
- `npm run test:e2e`: 7 browser/API acceptance tests passed against isolated PostgreSQL.
- `npm run build`: production build passed.
- `npm audit`: no reported vulnerabilities.
- Migrations applied successfully and rerunning them is idempotent.
- Live `/api/metadata?q=Frieren` returned HTTP 200 and real Kitsu candidates, including English title and season matches.
- Production `next start` tested through Chromium: public browsing, owner dashboard, login and logout passed; cookies included Secure, HttpOnly and SameSite=Strict.
- Eight fetched production browser JavaScript bundles were checked for the configured password hash and session secret; neither was present.
- Collection database contains zero entries; test fixtures were created only in the separate `_test` database.
- Mobile 375 px and desktop 1440 px browser overflow checks passed. Missing and failed poster fallback was exercised.
- Browser upload, saved same-origin image fetch, page refresh, rating edit, exact thoughts, preview and confirmed deletion passed using development filesystem storage.

Security acceptance includes anonymous POST/PUT/DELETE rejection, wrong-password rejection, exact-origin CSRF checks, expired session rejection, logout cookie replay rejection, integer rating validation, duplicate provider IDs, stale-edit conflicts, and global login throttling.

Not verified / requires configuration:

- No public cloud deployment, DNS change or HTTPS certificate issuance was performed.
- Supabase credentials were not provided; actual managed Storage upload/download and cloud PostgreSQL integration have not been exercised.
- Cloud storage/database persistence across redeployments must be checked using the production checklist in README.md. Local page-refresh persistence is verified, not a substitute for a cloud redeploy check.
- Blanket rights to redistribute Kitsu poster artwork were not established. Automatic importing is now enabled as requested; the live image fetch/optimization passed, and the actual local import/storage/editor preview checks passed; cloud deployment remains unverified.
- No UCF Wi-Fi or other institutional network was tested.
- Local production browser smoke used localhost, which browsers specially permit for secure cookies; it is not a deployed HTTPS test.

Local development setup generated private, ignored credentials in `.env.local` and `.local/test-password`. These are not production owner credentials. Set your own password using `npm run owner:password` before deployment. No sample anime or ratings were inserted into the main collection.
