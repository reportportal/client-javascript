
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
