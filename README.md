# StartPro Wiki Reader

An independent Flarum **2.x** extension adding per-user reading progress, resume-reading, and bookmarks to [LR Wiki](https://github.com/linkrobins/flarum-wiki).

**Status:** Experimental beta; source and lightweight static checks only. This has **not** passed Flarum+LR Wiki integration testing. Do not deploy to a production forum without testing on a backup clone.

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

Release versions are inferred from Git tags, not from a hard-coded `version` in `composer.json`. Begin with `v0.1.0-beta.2` after reviewing this code and establishing baseline tests. Submit the public GitHub repository URL to https://packagist.org/packages/submit. Verify that Packagist displays the beta tag before installing.

## License

MIT (Copyright StartPro).
