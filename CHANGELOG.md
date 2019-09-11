# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Removed
- `client-fields.js` module
- `@janiscommerce/settings` dependency
- `clientDBConfig` getter

### Changed
- `db()` method passes client config to `database-dispatcher` due client configs are not built anymore.
- `database-dispatcher` updated to `2.0.0`

## [1.2.0] - 2019-07-31
### Added
- Added protocol field

## [1.1.1] - 2019-07-15
### Fixed
- Dependencies updated to get settings properly

### Removed
- Unused dependencies

## [1.1.0] - 2019-07-15
### Added
- `type` field in Client Fields for `DBDriver`

## [1.0.0] - 2019-07-11
### Added
- `Model` package
- `tests`
- `README.md`