# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [6.3.0] - 2022-05-06
### Added
- **getIdStruct** method to validate id type

## [6.2.0] - 2022-04-21
### Added
- Support for `aggregate` method

## [6.1.0] - 2022-03-02
### Added
- Support multiple data in `update` method

## [6.0.0] - 2021-11-01
### Fixed
- When use `changeKeys` param and cannot get any items, it will return an empty object (before returns an empty array)

## [5.6.3] - 2021-08-09
### Fixed
- Fixed DB connections cache for configs from AWS Secrets Manager

## [5.6.2] - 2021-08-05
### Fixed
- Making static the databasesCache to fix the DB connections cache

## [5.6.1] - 2021-07-22
### Fixed
- Fix _adminAccess_ methods using write config but admin credentials

## [5.6.0] - 2021-06-02
### Added
- Now you can set custom message or data to the log of a write operation using the `setLogData()` chainable method

## [5.5.0] - 2021-04-13
### Changed
- `update` Method now supports optional parameters for the query.

## [5.4.1] - 2021-03-26
### Fixed
- Credentials used from `databases` field in Secret value fetched

## [5.4.0] - 2021-03-23
### Added
- Fetched credentials in **AWS Secrets Manager** using `@janiscommerce/aws-secrets-manager`.

### Changed
- Now the `core` databases configured in Settings File can use the `read` type.

## [5.3.1] - 2021-01-27
### Added
- Typings build from JSDoc

## [5.3.0] - 2020-12-01
### Added
- `mapIdBy` new method

## [5.2.0] - 2020-11-27
### Added
- `mapIdByReferenceId` now accepts params to use in `get` method

## [5.1.0] - 2020-11-10
### Added
- Added `dropDatabase` method

## [5.0.0] - 2020-08-26
### Added
- `hasReadDB` method
- `database-dispatcher` as a helper instead a package dependency

### Changed
- Database connection settings structure for core and client models

### Removed
- `database-dispatcher` package dependency

## [4.1.0] - 2020-05-19
### Removed
- `package-lock.json` file

## [4.0.0] - 2020-05-15
### Changed
- Updated @janiscommerce/log@3.x as peer dependecy

## [3.7.0] - 2020-04-24
### Added
- Multi log support for multiInsert and multiSave operations

### Fixed
- Array (OR) filters in `getBy` method

### Changed
- `getDb()` as public method

## [3.6.3] - 2020-04-16
### Fixed
- Logs for write methods not awaited causing some logs not to be successfully sent

## [3.6.2] - 2020-04-03
### Changed
- Dependencies updated

## [3.6.1] - 2020-02-18
### Changed
- Dependencies updated

## [3.6.0] - 2020-01-14
### Added
- `statuses` getter with default statuses
- `setOnInsert` parameter in `save` and `multiSave` methods
- `mapIdByReferenceId` method

## [3.5.0] - 2020-01-13
### Added
- `getBy()` alias added
- `increment` method
- `getIndexes`, `createIndex`, `createIndexes`, `dropIndex`, `dropIndexes` method

## [3.4.0] - 2019-12-31
## Added
- `getById()` alias added

## [3.3.3] - 2019-11-28
## Added
- `excludeFieldsInLog` getter documented on readme

## [3.3.2] - 2019-11-22
### Fixed
- `getPaged` method is now guaranteed to process every page

## [3.3.1] - 2019-11-21
### Added
- `userCreated` and `userModified` fields auto generated for write methods.
- `userCreated` field in logs

## [3.3.0] - 2019-11-06
### Added
- Logs for write methods:
	- insert
	- multiInsert
	- update
	- save
	- multiSave
	- remove
	- multiRemove
- `@janiscommerce/log` package
- `lib/utils.js` module

## [3.2.0] - 2019-11-06
### Added
- Distinct method implemented with driver support check

## [3.1.0] - 2019-10-09
### Fixed
- Tests typo fix
- Readme example

### Removed
- useless index.js

## [3.0.0] - 2019-09-12
### Changed
- Client injection replaced by Session injection (**BREAKING CHANGE**)

## [2.1.0] - 2019-09-12
### Removed
- `ENV` vars config documentation

### Deprecated
- `ENV` vars config

## [2.0.0] - 2019-09-11
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