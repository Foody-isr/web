# Foody's picomatch dependencies

The build tools use two major versions of picomatch. Each directory contains the upstream npm runtime and its MIT license. Only `lib/parse.js` and the private package manifest differ from the corresponding distribution. Foody keeps both module interfaces, including the v4 POSIX entry point.

| Directory | npm source | Reviewed parser change |
| --- | --- | --- |
| `picomatch-v2` | [2.3.2](https://registry.npmjs.org/picomatch/-/picomatch-2.3.2.tgz) | [v2 patch at e2e3342](https://github.com/micromatch/picomatch/commit/e2e3342c62828b2e37a1cfbdc7e0e30355a30c9e) |
| `picomatch-v4` | [4.0.7](https://registry.npmjs.org/picomatch/-/picomatch-4.0.7.tgz) | [v4 patch at d9a3f12](https://github.com/micromatch/picomatch/commit/d9a3f12faf186860cfc86c2834c41f38701152f2) |

The patch flattens single-branch repeated wildcards where the same filenames can be matched in one pass. Complex ambiguous branches use the parser’s literal fallback. Foody applies this check even when a caller turns off the separate recursion-depth limit. The reviewed upstream changes are pending release. [GitHub advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)

When the affected major versions have a fixed upstream release, replace the local overrides, run `npm ci`, `npm audit --audit-level=high` and the dependency and build checks.
