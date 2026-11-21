# Publishing v0.3.0-beta.1

1. Confirm the latest source is checked in, particularly the v0.3 migration, models, controllers, `extend.php` routes and JS tests.
2. Run checks from README. Create an actual *database backup* before upgrading any forum.
3. Push the commit to GitHub `main`, then create annotated tag `v0.3.0-beta.1` and push the tag. Do not overwrite existing v0.1 or v0.2 tags.
4. Verify https://packagist.org/packages/startpro/wiki-reader has indexed the new tag; use Manage > Update if automatic webhook did not refresh.
5. Install the exact beta via `extension require 'startpro/wiki-reader:0.3.0-beta.1'` only after validating Packagist, then enable and migrate.
6. Complete the acceptance list in `UPGRADE-zh-CN.md` (MySQL migration, desktop/mobile, personal permissions, UI, old bookmarks).

**Avoid claiming production-readiness based on PHP/JS syntax and simulated browser tests.** Keep the older release tag and database backup as recovery points.
