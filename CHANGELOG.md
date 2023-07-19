### Added
- `launchUuidPrint` and `launchUuidPrintOutput` configuration options to ease integration with CI tools, by @HardNorth

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
