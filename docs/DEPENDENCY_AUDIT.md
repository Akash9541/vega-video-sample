# Dependency audit notes

## Current audit

On 2026-10-18, `npm audit --omit=dev --json` completed against the npm registry for the current lockfile and reported 85 findings after the `shell-quote` override: 2 low, 29 moderate, 50 high, and 4 critical. Before that override, the same production audit reported 86 findings including critical `shell-quote`. This is an npm advisory count, not a finding count for exploitable paths in this particular app.

The four critical package records in the current audit are:

| Package | Dependency path / scope | Shipped or reachable assessment |
| --- | --- | --- |
| `@react-native-community/cli` | Transitive through `react-native-tscodegen-types@0.66.0` → nested `react-native@0.60.6` → CLI 2.10.0; that codegen-types package is required by `@amazon-devices/security-manager-lib`. | CLI is build/code-generation tooling. No CLI executable or `node_modules` tree appears in the VPKG. The exact advisory path is not part of app playback. |
| `@react-native-community/cli-platform-android` | Same legacy nested React Native toolchain. | Android CLI tooling, not an app playback module; no CLI executable appears in the VPKG. |
| `logkitty` | Transitive through the legacy React Native CLI tree. | CLI logging utility; no evidence it runs in the app or is included as a package asset. |
| `react-native` | Direct app dependency at 0.83.0; npm's report points to an advisory record. | React Native application/runtime code is used by the app. The report does not identify a demonstrated vulnerable call site in Flinch, so exploitability for this app remains unverified. |

The audit also reported 50 high records. They include direct Vega SDK packages attributed through `@amazon-devices/keplerscript-turbomodule-api`, React Native and Metro tooling, Jest packages, `lodash`, and legacy `react-native-tscodegen-types`. The audit's `via`/`effects` fields show dependency attribution; they do not prove each affected function is imported or reachable in this app. Some proposed remediations require major upgrades (`react-native@0.86.3`, Vega Kepler package `2.1.0`, or newer async storage), so no broad upgrade was made. Several Vega SDK findings have no fix available in the current report. Package inspection shows the built VPKG contains application/runtime assets and a bundled JS file, but no `node_modules` tree. This excludes development command files as separate package assets, not necessarily vulnerable behavior in code bundled into the app.

## Fixed parser issue

Before the parser change, the production audit also reported critical `xmldom@0.6.0`. `src/w3cmedia/polyfills/DOMParserPolyfill.ts` imported it as the Shaka DOM parser fallback, so it was a real app code path. The implementation now imports `@xmldom/xmldom@0.8.15`, and `xmldom`/`@types/xmldom` were removed. The current production audit no longer reports the unscoped package. Separately, the pre-override audit identified critical `shell-quote@1.6.1` under the legacy code-generation tree. An override now resolves every consumer to `1.12.0`, already used by the other consumers; `npm ls shell-quote --all` and the follow-up audit confirmed the fix. The upstream [xmldom security policy](https://github.com/xmldom/xmldom/security) states that unscoped `xmldom` is end-of-life and vulnerable.

## Verification limits

- `npm audit --omit=dev --json` is the current production-only audit. A full development-dependency audit was captured before the parser migration and reported 91 total findings (2 low, 29 moderate, 54 high, 6 critical); those figures are historical and should not be presented as the current audit.
- `npm audit --omit=dev` includes packages marked production by npm even where their role is build-time or code generation. It is not a scan of the final VPKG binary.
- The VPKG was inspected, but this build was not installed or launched on a Vega device. No device-level exploitability test was performed.
- A dependency owner should review each applicable upstream advisory, confirm reachability against the Vega runtime, and coordinate compatible Vega SDK updates before release.
