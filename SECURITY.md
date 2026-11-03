# Security and privacy maintenance

## Data boundaries

Image decoding, editing, AI/OCR, projects, and exports run in the browser. Models and runtimes are bundled or served from the application origin. Never add remote image processing, telemetry containing user files, or a third-party proxy to these paths.

Session recovery is opt-in and uses browser-local IndexedDB. Explicit `.iip` projects contain original files and metadata, including any original GPS data. Treat projects as sensitive originals. Project checksums detect corruption; they do not authenticate authors.

The public-page analyzer is the explicit network exception. Its opaque-origin iframe has `sandbox="allow-scripts"`, no parent/storage access, and credential-free HTTPS requests. HTML remains inert. Local, numeric, credentialed, and nonstandard-port destinations are rejected, including local hostnames with a trailing DNS dot. Browser-only hostname checks cannot prevent DNS rebinding or prove that a public-looking hostname resolves to a public address. Opening the analyzer requires a network connection because its opaque sandbox cannot use the parent application’s offline cache. Offline users receive an explanation; image editing remains available offline. Saved HTML can be inventoried after opening the analyzer online; image metadata still depends on network access and CORS permission.

## Hosting

Deploy the static production output over HTTPS. Keep the editor's same-origin CSP and configure only `/page-audit.html` for the documented external-read exception. Build-time CSP metadata cannot provide response-only directives such as `frame-ancestors`; follow the deployment section in [README.md](README.md). Do not expose Vite, preview, or Vitest servers as public production services.

## Dependency maintenance

Use `npm ci` with the committed lockfile. Run:

```sh
npm audit
npm audit --omit=dev
npm run check
npm run test:e2e
npm run test:advanced
```

The `minimatch` override selects the fixed 11.x line for development tooling. The upstream advisory fixes glob-pattern amplification in 11.0.1: [GHSA-g3hv-75wg-m249](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249). Recheck ESLint compatibility with `npm run lint` whenever changing or removing that override. Avoid automatic forced dependency downgrades merely to change an audit total.

Browser regressions use synthetic data and verified public fixtures. Generated evidence belongs in ignored `artifacts/browser/`, never in the shipped `public/` directory. Keep third-party notices and model checksums intact.

## Reporting scope

Record reproducible steps, affected versions, the local/production distinction, and the smallest synthetic fixture needed to demonstrate an issue. Do not include student images, project contents, credentials, or personal OCR text in a public issue. A clean package audit is not proof that application code, hosting, or all browser decoders are secure.
