# Security and privacy maintenance

## Data boundaries

Image decoding, editing, AI/OCR, projects, and exports run in the browser. Models and runtimes are bundled or served from the application origin. Never add remote image processing, telemetry containing user files, or a third-party proxy to these paths.

Session recovery is opt-in and uses browser-local IndexedDB. Explicit `.iip` projects contain the original files with whatever metadata they still have (GPS included unless *Remove hidden data* was applied). Treat projects as sensitive originals. Project checksums detect corruption; they do not authenticate authors.

There is no network exception: the CSP allows connections only to the app's own origin. Do not add one.

Exports are re-encoded and carry no EXIF. The *Remove hidden data* action (`src/image/metadata.js`) is the supported way to strip metadata from the stored originals; changes to it need a unit test with a synthetic file containing the removed structure.

## Hosting

Deploy the static production output over HTTPS. Keep the same-origin CSP. Build-time CSP metadata cannot provide response-only directives such as `frame-ancestors`; see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Do not expose Vite, preview, or Vitest servers as public production services.

## Dependency maintenance

Use `npm ci` with the committed lockfile. Run:

```sh
npm audit
npm audit --omit=dev
npm run check
npm run test:e2e
```

The `minimatch` override selects the fixed 11.x line for development tooling. The upstream advisory fixes glob-pattern amplification in 11.0.1: [GHSA-g3hv-75wg-m249](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249). Recheck ESLint compatibility with `npm run lint` whenever changing or removing that override. Avoid automatic forced dependency downgrades merely to change an audit total.

Browser regressions use synthetic data and verified public fixtures. Generated evidence belongs in ignored `artifacts/browser/`, never in the shipped `public/` directory. Keep third-party notices and model checksums intact.

## Reporting scope

Record reproducible steps, affected versions, the local/production distinction, and the smallest synthetic fixture needed to demonstrate an issue. Do not include student images, project contents, credentials, or personal OCR text in a public issue. A clean package audit is not proof that application code, hosting, or all browser decoders are secure.
