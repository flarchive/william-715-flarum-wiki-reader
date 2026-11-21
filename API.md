# Reader REST API (v0.3 Beta)

All endpoints are under `/api/startpro/wiki-reader` and use the current Flarum session and CSRF protection. Personal objects are scoped by the current account. Unauthenticated requests receive HTTP 401.

Existing v0.2 endpoints remain unchanged (`GET /`, `GET /article?address=`, `/progress/{id}`, `/bookmarks`, `/bookmarks/{id}` etc.). New v0.3 endpoints:

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/highlights?page=1&perPage=20&search=` | user | Paginated personal highlights including article metadata |
| POST | `/highlights` | user | `{articleId, quote, positionContext, note}`; same-article block text, ≤500 characters |
| GET | `/highlights/{id}` | owner | Deep link to owned highlight |
| PATCH | `/highlights/{id}` | owner | `{note}` ≤1000 characters |
| DELETE | `/highlights/{id}` | owner | Permanently remove personal highlight |
| GET | `/shelf` | user | Explicit books with ordered chapters and personal completion, plus recently read standalone articles |
| POST | `/books` | **admin** | `{title, description}` create book |
| PATCH | `/books/{id}` | **admin** | Update title/description |
| POST | `/books/{id}/chapters` | **admin** | `{articleId, position}` attach/reorder one Wiki article |
| DELETE | `/books/{id}/chapters/{articleId}` | **admin** | Remove association only; original Wiki article is preserved |
| POST | `/completions/{id}` | user | Mark a published Wiki article complete |
| DELETE | `/completions/{id}` | user | Remove personal completion marker |
| POST | `/activity/{id}` | user | `{sessionKey, activeSeconds}` cumulative reading-time estimate, idempotent per session |
| GET | `/stats` | user | Estimated active time, visit, completion, bookmark and highlight counts |

New `GET /article?address=...` fields: `highlights` (up to 200), `completed` boolean, `bookId` nullable.

**Limits:** up to 200 books, up to 300 Wiki articles per book, one book per article, up to 5000 highlights per user, 500 characters per highlight, 1000 characters per note, 0–14400 cumulative seconds per activity session. Highlight selection currently supports **one block only**, regardless of text length. No anonymous personal records, no cross-user note access.

**Conflict semantics:** existing v0.2 progress API returns HTTP 409 for version conflicts; book chapter association returns HTTP 409 if a Wiki article already belongs to another book. Admins should detach it from the previous book before reassignment.

**Activity semantics:** `activeSeconds` is a nondecreasing cumulative counter for a single browser session key. The server stores the maximum value and does not sum repeated copies of the same session. This is approximate reading engagement, not proof that each word was read.
