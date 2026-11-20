# StartPro Wiki Reader

An independent Flarum **2.x** extension adding per-user reading progress, resume-reading, and bookmarks to [LR Wiki](https://github.com/linkrobins/flarum-wiki).

**Status:** Experimental beta; source and lightweight static checks only. This has **not** passed Flarum+LR Wiki integration testing. Do not deploy to a production forum without testing on a backup clone.

## v0.1.0-beta.5 cross-device resume fix

The prior build always preferred document-wide scroll percentage to an anchor,
so mobile reflow could lead to the wrong place. New bookmarks encode a stable
article-block index and position within that paragraph into the existing
`anchor_id` column (no database migration); resume prioritizes this location,
then old heading anchors, then percentage fallback. Opening an article with a
saved reading position now resumes on a second device even without an explicit
`sr_resume=1` URL, and same-article bookmark links are observed when query
parameters change in Flarum's SPA router.

**Existing beta.4 bookmarks remain valid**, but old progress recorded only as
page percentage cannot be retroactively made pixel-perfect across different
screen sizes. Create a new bookmark with beta.5 for precise paragraph-level
cross-device positioning. A manual bookmark and the auto-saved latest progress
are separate: tap a specific bookmark under **My Reading** to revisit it.

**Status:** smoke tests only; not real-device integration-tested. Before using
on your only production forum, back up your database and keep
`php flarum extension:disable startpro-wiki-reader` ready.

## v0.1.0-beta.4 hotfix

Fixed the missing bookmark controls for signed-in readers. Flarum 2.0.2 runs
extension initializers **before** assigning `app.session`; earlier builds
stored a permanent `false` login flag and started article API requests too
early. This version checks authentication dynamically and starts its UI after
the synchronous Flarum boot. Added a lifecycle smoke test that simulates a
signed-in user being available only after initializers run.

Still a **beta**: these automated checks are not a full Flarum+LR Wiki
integration test. Test carefully and disable the extension on errors.

## v0.1.0-beta.3 hotfix

Fixed Flarum 2.x frontend bootstrap crash: Flarum expects `module.exports`
for each JavaScript extension, but the earlier beta shipped only an IIFE.
The missing export caused `Cannot read properties of undefined (reading 'extend')`
in `Application.bootExtensions()`. Added a simulated boot-contract CI smoke test.
This is **not** an end-to-end Flarum/LR Wiki test. Keep the plugin disabled
until you can verify the forum homepage and Wiki workflow after updating.

## v0.1.0-beta.2 hotfix

Fixed Flarum Less compilation failure caused by CSS `min()` with incompatible `vw`/`px` units, which caused forum HTTP 500 on enabling beta.1. The update has been statically checked but is **not** a full integration-test pass.

## Features

- Save the last reading location (scroll percentage + heading anchor) for a signed-in user.
- Resume reading an LR Wiki article.
- Add and remove multiple bookmarks, view recently read articles.
- Per-user access restrictions; drafts and deleted articles are excluded.
- Reading data in independent database tables.

## Requirements

- PHP `^8.3`, Flarum `^2.0`, LR Wiki `^1.11`.
- MySQL-compatible Flarum database.

## Install (after Packagist has indexed the beta tag)

In the `crazymax/flarum` Docker container:

```bash
extension require 'startpro/wiki-reader:^0.1@beta'
php flarum migrate
php flarum cache:clear
```

Enable **StartPro Wiki 阅读助手** in the Flarum administration dashboard. On a normal non-Docker Flarum installation, run `composer require 'startpro/wiki-reader:^0.1@beta'` instead.

The `crazymax/flarum` image uses `/data/extensions/list` to persist the package declaration across container rebuilds. Verify the package appears there before recreating your container.

## Notes

- This extension does not alter LR Wiki tables.
- Only signed-in users can save progress; guest visitors can still read wiki pages.
- Disable the extension to stop usage without deleting stored data. Avoid **Purge** unless you intend to remove stored reading history/bookmarks.
- For diagnostics, check Flarum `storage/logs`, the browser console, and `php flarum info`.

## Publishing and tagging

Release versions are inferred from Git tags, not from a hard-coded `version` in `composer.json`. Begin with `v0.1.0-beta.5` after reviewing this code and establishing baseline tests. Submit the public GitHub repository URL to https://packagist.org/packages/submit. Verify that Packagist displays the beta tag before installing.

## License

MIT (Copyright StartPro).
