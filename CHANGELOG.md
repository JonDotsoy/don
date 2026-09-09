# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- CI workflow (`.github/workflows/publish.yml`) that publishes to npm via OIDC
  trusted publishing on push to `develop` when `package.json` changes.
- `NPM_PUBLISH_MODE` repository variable to toggle the publish workflow
  between staged publishing (`stage`, default — queues the version for
  manual 2FA approval on npmjs.com) and direct publishing (`publish`).
- Installation, usage, and syntax examples in `README.md`.

### Changed

- Renamed the `README.md` title to **donly**, describing it as the reference
  implementation of the DON format.
- Fixed `package.json`'s `repository.url` casing (`JonDotsoy/don`) to match
  the GitHub Actions source repository, required for npm provenance
  verification.
- Bumped version to `0.0.12`.
