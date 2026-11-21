# StartPro Wiki Reader

An independent **Flarum 2.x** extension adding personal reading continuity to [LR Wiki](https://github.com/linkrobins/flarum-wiki).

> **Release:** `v0.3.0-beta.1` — experimental. The previous Beta 5 was manually confirmed on desktop and mobile by the project owner. This v0.3 revision has static and simulated interaction tests, **not** real production integration acceptance.

## What v0.3 adds

- **划线与个人笔记**: select a passage inside a single paragraph/list item, click `✍ 划线`, then add/edit a private note from the `划线笔记` tab. Notes are stored in MySQL for cross-device access. Browsers supporting CSS Highlight API display non-destructive in-place highlights. A notes list remains accessible on other browsers.
- **我的书架**: administrators define explicit books and associate Wiki articles as ordered chapters. Personal chapter-completion toggles and unfinished/finished counts; recent standalone articles remain visible if not assigned to a book. Wiki categories are *not* assumed to represent entire books.
- **阅读统计**: approximate engaged reading time since v0.3, active days, visited articles, personally marked completed chapters, bookmarks and highlights.
- **Preserved v0.2 features**: durable text quote positioning, cross-device conflict detection, bookmark name/note editing, search, pagination, undo deletion, compact mobile panel.

## Installation

Requires PHP `^8.3`, Flarum `^2.0`, LR Wiki `^1.11`, MySQL-compatible database.

In the `crazymax/flarum` Docker container, after Packagist has indexed the new tag and database backup has been verified:

```bash
extension require 'startpro/wiki-reader:0.3.0-beta.1'
php flarum extension:enable startpro-wiki-reader
php flarum migrate
php flarum cache:clear
```

**Do not apply these commands directly to an unbacked production forum**. See `UPGRADE-zh-CN.md` for upgrade and rollback sequence. The `extension require` mechanism persists the package declaration in `/data/extensions/list` for the crazymax image.

## Reader workflows

1. Log in, open an LR Wiki article, and select up to **500 characters inside a single content block**. Click `✍ 划线`. Notes can be edited from `📖 我的阅读 → 划线笔记`.
2. `我的书架` displays explicitly assigned multi-article books with manually marked completed chapters. It also lists recently read independent long articles.
3. Administrators can create a book and attach the **currently open Wiki article** as a chapter from the `我的书架` admin section. Use the numeric order field to sort chapters. An article can only belong to one managed book at a time.
4. `阅读统计` displays approximate active time and personally owned data. Idle and hidden tabs are not counted.

## Data & privacy

- User-specific progress, bookmarks, highlights, note bodies, completion markers and reading sessions are stored in separate `startpro_*` database tables.
- APIs scope personal data by the signed-in user's ID. Only published, non-deleted Wiki articles appear in lists. Administrators may manage the explicit book structure but cannot read other users' private notes through this extension.
- Highlight text is limited to 500 characters, notes to 1000, book titles to 160, descriptions to 500.
- **Do not use Purge** to troubleshoot: it can delete the extension's data. Disable the extension instead.

## Known limitations / next acceptance gates

- No exact reading-time guarantee; no backfill for older reading sessions.
- CSS Highlight API is progressive: if unsupported, notes remain in the panel but inline yellow marks might not appear.
- Selecting across multiple paragraphs is intentionally unsupported in this beta.
- A single giant Markdown article is one chapter for completion purposes; its internal headings are not treated as separate LR Wiki articles.
- No PDF/ePub import, annotation sharing, export, or automatic book-cover generation.
- Author edits which delete the quoted text can invalidate inline highlighting; older location fields still provide fallback.
- Chrome/Safari on desktop and iOS/Android browser checks, real Flarum/MySQL migrations and real book-management authorization checks are still needed before calling the release stable.

## Development checks

```bash
find . -type f -name '*.php' -not -path './vendor/*' -print0 | xargs -0 -n1 php -l
php tests/reader-validation.php
php tests/v03-validation.php
node --check js/dist/forum.js
for f in js/tests/*.test.cjs; do node "$f"; done
```

## License

MIT. See `LICENSE`.
