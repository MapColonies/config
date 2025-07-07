# Changelog

## [2.3.0](https://github.com/MapColonies/config/compare/v2.2.1...v2.3.0) (2025-07-07)


### Features

* added a check for valid server version for the package ([#78](https://github.com/MapColonies/config/issues/78)) ([a51d6ae](https://github.com/MapColonies/config/commit/a51d6ae03f8aa88226badb64c16ed74e16279cdc))

## [2.2.1](https://github.com/MapColonies/config/compare/v2.2.0...v2.2.1) (2025-06-15)


### Bug Fixes

* resolved handling of empty objects with x-env-value and enum without type string [MAPCO-7951] ([#76](https://github.com/MapColonies/config/issues/76)) ([678a2d1](https://github.com/MapColonies/config/commit/678a2d10f68f343f6d0925c5486b7237a550d78a))

## [2.2.0](https://github.com/MapColonies/config/compare/v2.1.0...v2.2.0) (2025-06-04)


### Features

* **validator:** enrich error handling for unevaluatedProperties by adding the property ([#63](https://github.com/MapColonies/config/issues/63)) ([2aa2bb5](https://github.com/MapColonies/config/commit/2aa2bb5092f880a96b418aa123b5bb9dac8613eb))


### Bug Fixes

* added missing export declaration ([#74](https://github.com/MapColonies/config/issues/74)) ([11da6c7](https://github.com/MapColonies/config/commit/11da6c7700d8ce8ca064aff5ec3943afba6db479))
* use path.sep for schema base path resolution ([#73](https://github.com/MapColonies/config/issues/73)) ([c466f8a](https://github.com/MapColonies/config/commit/c466f8a9fc5d629b7eb3eae902959ab479ef1633))

## [2.1.0](https://github.com/MapColonies/config/compare/v2.0.0...v2.1.0) (2025-04-05)


### Features

* added support for json env format ([#59](https://github.com/MapColonies/config/issues/59)) ([1b082e6](https://github.com/MapColonies/config/commit/1b082e6c39c0143967f06ca829db515c748de3f2))

## [2.0.0](https://github.com/MapColonies/config/compare/v1.3.2...v2.0.0) (2025-02-03)


### ⚠ BREAKING CHANGES

* update node engine requirement to >=20.18.1 in package.json
* added engine setting to package.json ([#24](https://github.com/MapColonies/config/issues/24))

### Features

* moved to common tsconfig package ([#26](https://github.com/MapColonies/config/issues/26)) ([f26ea3a](https://github.com/MapColonies/config/commit/f26ea3a2d2c7c64a2b32870b54295be7ba88d6a1))


### Dependency Updates

* add typedoc as a dependency in package.json and package-lock.json ([47a1b8a](https://github.com/MapColonies/config/commit/47a1b8ab9edf32cff84915b2f9ba782fa74681f5))
* bump the patch group across 1 directory with 3 updates ([#38](https://github.com/MapColonies/config/issues/38)) ([805a967](https://github.com/MapColonies/config/commit/805a967148f51526d1a6f4745fe124ae917517d0))
* bump undici from 6.18.2 to 7.3.0 ([#29](https://github.com/MapColonies/config/issues/29)) ([ab407fb](https://github.com/MapColonies/config/commit/ab407fbf900dde1d301f998a3350f5670c12f07d))
* update node engine requirement to &gt;=20.18.1 in package.json ([40289a0](https://github.com/MapColonies/config/commit/40289a0b0fbf6fba4522b3571059e61da78ed7d1))


### Build System

* added engine setting to package.json ([#24](https://github.com/MapColonies/config/issues/24)) ([521ebb4](https://github.com/MapColonies/config/commit/521ebb4df4ae5c91c5c5789f4fa8fa38567e93ff))

## [1.3.2](https://github.com/MapColonies/config/compare/v1.3.1...v1.3.2) (2024-12-11)


### Bug Fixes

* support null valued config attributes ([a8fabad](https://github.com/MapColonies/config/commit/a8fabad30160e542dfc3c25862fb40db54c9cde6))

## [1.3.1](https://github.com/MapColonies/config/compare/v1.3.0...v1.3.1) (2024-12-05)


### Bug Fixes

* changed so the gauge is not registered on the default metrics ([#20](https://github.com/MapColonies/config/issues/20)) ([3e86838](https://github.com/MapColonies/config/commit/3e86838999aca5b366de4f997862df8da4734890))
* support sub configuration to be immutable to ([#19](https://github.com/MapColonies/config/issues/19)) ([7609fa3](https://github.com/MapColonies/config/commit/7609fa3b1394bac06ad59fdc698ce83c26083814))

## [1.3.0](https://github.com/MapColonies/config/compare/v1.2.0...v1.3.0) (2024-11-13)


### Features

* added metrics ([#15](https://github.com/MapColonies/config/issues/15)) ([94286d3](https://github.com/MapColonies/config/commit/94286d31ab62545ca6cda36ff8d57f8164454dd3))

## [1.2.0](https://github.com/MapColonies/config/compare/v1.1.0...v1.2.0) (2024-10-13)


### Features

* changed all options except schema to be optional ([#10](https://github.com/MapColonies/config/issues/10)) ([26a47e2](https://github.com/MapColonies/config/commit/26a47e265854db8d7b61e6e6602ef3224b50122a))

## [1.1.0](https://github.com/MapColonies/config/compare/v1.0.0...v1.1.0) (2024-10-03)


### Features

* upgraded json schema version to 2019-09 ([#6](https://github.com/MapColonies/config/issues/6)) ([289a3aa](https://github.com/MapColonies/config/commit/289a3aa30c0d1492ecd957df284e045710305d16))

## 1.0.0 (2024-09-08)


### Features

* initial api ([#2](https://github.com/MapColonies/config/issues/2)) ([3d04ca0](https://github.com/MapColonies/config/commit/3d04ca0c01560219a1c00d6a41168446e3bf3809))


### Bug Fixes

* removed id from loaded schema to resolve the ref more than once error ([#5](https://github.com/MapColonies/config/issues/5)) ([6fa4373](https://github.com/MapColonies/config/commit/6fa43732ce98e908d7676125c311d71554e2b9d9))
