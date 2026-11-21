# Changelog

## v0.3.0-beta.1 (2026-11-21)

### Added

- Private text highlighting and notes attached to LR Wiki articles. Selection must be within **one content block**; highlights and notes are scoped to the signed-in account.
- Notes listing, search, pagination, edit, delete, and deep links into a specific highlighted article passage.
- Progressive inline highlighting through the browser CSS Highlight API; notes remain available in the panel if the browser does not support the API.
- Explicit book collections managed by Flarum administrators, with chapter order and one book per Wiki article. **Wiki categories are not automatically treated as books**.
- Personal bookshelf for books and standalone long articles; user-controlled chapter completion (not inferred from scroll percentage).
- Estimated active reading duration, active-day count, completed chapters, saved bookmarks and highlights.
- Idempotent cumulative reading-time API; repeated posts from the same browsing session do not double-count.

### Compatibility and boundaries

- Adds **five new tables**. Existing Beta 5 and v0.2 bookmarks, completion-free reading progress, and notes are not overwritten.
- Preserves Flarum 2 extension `module.exports` contract and avoids problematic LESS `min()` / `max()` functions.
- All new user records are scoped to the current authenticated account. Book and chapter editing requires admin permission.
- For long books contained in one Wiki article, it is treated as a standalone article or one book chapter. Per-heading completion is not implemented in this release.
- Reading duration counts visible, recently interacted browsing sessions starting in v0.3; it is **an estimate**, not verified time spent reading.
- Automated simulation tests are **not** a full Docker+MySQL+mobile integration test.

### Earlier releases

- v0.2.0-beta.1: better anchor matching, progress concurrency, bookmark editing/notes, paginated search, mobile dock.
- v0.1.0-beta.5: cross-device reading location restoration.
