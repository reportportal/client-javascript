### Changed
- The client now expects reporting the time for launches, test items and logs with microsecond precision in the ISO string format.
Thus, the `helpers.now` function is adjusted accordingly. Details about [supported](./README.md#time-format) formats.
For logs, microsecond precision is available on the UI from ReportPortal version 24.2.
### Security
- Updated versions of vulnerable packages (micromatch).

## [5.2.0] - 2024-09-17
### Changed
- **Breaking change** Drop support of Node.js 12. The version [5.1.4](https://github.com/reportportal/client-javascript/releases/tag/v5.1.4) is the latest that supports it.
- The client now creates an instance of the `axios` HTTP client in the constructor.
- The `HOST` HTTP header is added to all requests as it was skipped by the HTTP client.
### Fixed
- Allow using `restClientConfig` in `checkConnect()` method. Thanks to [stevez](https://github.com/stevez).
### Security
- Updated versions of vulnerable packages (braces).

## [5.1.4] - 2024-05-22
### Fixed
- Use correct launch search URL based on config mode while merging launches. Resolves [#200](https://github.com/reportportal/client-javascript/issues/200). Thanks to [hoangthanhtri](https://github.com/hoangthanhtri).
- Print launch UUID after merging launches. Resolves [#202](https://github.com/reportportal/client-javascript/issues/202). Thanks to [hoangthanhtri](https://github.com/hoangthanhtri).

## [5.1.3] - 2024-04-11
### Added
- Output launch UUID to file and ENV variable, thanks to [artsiomBandarenka](https://github.com/artsiomBandarenka). Addressed [#195](https://github.com/reportportal/client-javascript/issues/195), [#50](https://github.com/reportportal/agent-js-webdriverio/issues/50).
### Security
- Updated versions of vulnerable packages (follow-redirects).

## [5.1.2] - 2024-02-20
### Fixed
- Execution sequence for retried tests [#134](https://github.com/reportportal/agent-js-playwright/issues/134).

## [5.1.1] - 2024-01-23
### Added
- Debug logs for RestClient.

## [5.1.0] - 2024-01-19
### Changed
- **Breaking change** Drop support of Node.js 10. The version [5.0.15](https://github.com/reportportal/client-javascript/releases/tag/v5.0.15) is the latest that supports it.
### Security
- Updated versions of vulnerable packages (axios, follow-redirects).
### Deprecated
- Node.js 12 usage. This minor version is the latest that supports Node.js 12.

## [5.0.15] - 2023-11-20
### Added
- Logging link to the launch on its finish.
### Deprecated
- Node.js 10 usage. This version is the latest that supports Node.js 10.

## [5.0.14] - 2023-10-05
### Added
- `Promise.allSettled` polyfill to support NodeJS 10.
### Fixed
- Reporting is down on error with collect request on reporting start.
- Can not read property `realId` of undefined during reporting, resolves [#99](https://github.com/reportportal/agent-js-playwright/issues/99).

## [5.0.13] - 2023-08-28
### Added
- `launchUuidPrint` and `launchUuidPrintOutput` configuration options to ease integration with CI tools, by @HardNorth.

## [5.0.12] - 2023-06-19
### Changed
- `token` configuration option was renamed to `apiKey` to maintain common convention.

## [5.0.11] - 2023-06-01
### Fixed
- Request body logging has been removed by default for the HTTP client.

## [5.0.10] - 2023-04-30
### Fixed
- Node.js old versions support (client still supports Node.js >=10).

## [5.0.9] - 2023-04-29
### Changed
- A lot of package dependencies have been updated.
- Statistics engine updated on new contract.

## [5.0.8] - 2023-01-24
### Added
- `mergeOptions` parameter to `mergeLaunches` method.
- Dynamic page size for launch merge based on launches count, resolves [#86](https://github.com/reportportal/client-javascript/issues/86).
### Security
- Updated versions of vulnerable packages (json5, minimist).

## [5.0.7] - 2022-12-26
### Added
- The ability to see verbose logs in debug mode. To enable the debug mode, the `debug: true` flag should be specified in `params`.
### Security
- Updated versions of vulnerable packages (ajv, qs, follow-redirects, minimatch).

## [5.0.6] - 2022-01-13
### Fixed
- Security vulnerabilities (axios, path-parse, minimist)
### Changed
- Package size reduced

## [5.0.5] - 2021-05-25
### Added
- Possibility to change Axios Requests timeout (closes [#115](https://github.com/reportportal/client-javascript/issues/115))
### Changed
- Default timeout on Axios Requests increased to 30000ms
### Fixed
- [Issue](https://github.com/reportportal/client-javascript/issues/102) with self-signed certificate
- Security vulnerabilities (lodash, handlebars, hosted-git-info)

## [5.0.4] - 2021-04-29
### Added
- Timeout (default is 5000ms) on Axios Requests
### Fixed
- Security vulnerabilities ([axios](https://github.com/reportportal/client-javascript/issues/109))
- [Issue](https://github.com/reportportal/client-javascript/issues/94) with the finish of a non-existent test item

## [5.0.3] - 2020-11-09
### Added
- Environment variable

## [5.0.2] - 2020-08-27
### Fixed
- [Issue](https://github.com/reportportal/client-javascript/pull/91) with request headers
- Default status for suite/test items without children

## [5.0.1] - 2020-08-14
### Changed
- Packages publishing workflow improved
### Added
- The ability to disable google analytics

## [5.0.0] - 2020-06-09
### Added
- Full compatibility with ReportPortal version 5.* (see [reportportal releases](https://github.com/reportportal/reportportal/releases))
### Deprecated
- Previous package version (`reportportal-client`) will no longer supported by reportportal.io
