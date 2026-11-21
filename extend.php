<?php

declare(strict_types=1);

use Flarum\Extend;
use StartPro\WikiReader\Controller\ArticleStateController;
use StartPro\WikiReader\Controller\LibraryController;
use StartPro\WikiReader\Controller\SaveProgressController;
use StartPro\WikiReader\Controller\CreateBookmarkController;
use StartPro\WikiReader\Controller\DeleteBookmarkController;
use StartPro\WikiReader\Controller\UpdateBookmarkController;
use StartPro\WikiReader\Controller\RestoreBookmarkController;
use StartPro\WikiReader\Controller\ShowBookmarkController;

use StartPro\WikiReader\Controller\HighlightsController;
use StartPro\WikiReader\Controller\CreateHighlightController;
use StartPro\WikiReader\Controller\ShowHighlightController;
use StartPro\WikiReader\Controller\UpdateHighlightController;
use StartPro\WikiReader\Controller\DeleteHighlightController;
use StartPro\WikiReader\Controller\ShelfController;
use StartPro\WikiReader\Controller\CreateBookController;
use StartPro\WikiReader\Controller\UpdateBookController;
use StartPro\WikiReader\Controller\AttachChapterController;
use StartPro\WikiReader\Controller\DetachChapterController;
use StartPro\WikiReader\Controller\CompleteChapterController;
use StartPro\WikiReader\Controller\UncompleteChapterController;
use StartPro\WikiReader\Controller\ActivityController;
use StartPro\WikiReader\Controller\ReadingStatsController;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        ->css(__DIR__.'/less/forum.css'),

    (new Extend\Routes('api'))
        ->get('/startpro/wiki-reader', 'startpro-wiki-reader.library', LibraryController::class)
        ->get('/startpro/wiki-reader/article', 'startpro-wiki-reader.article', ArticleStateController::class)
        ->post('/startpro/wiki-reader/progress/{id}', 'startpro-wiki-reader.progress', SaveProgressController::class)
        ->post('/startpro/wiki-reader/bookmarks', 'startpro-wiki-reader.bookmarks.create', CreateBookmarkController::class)
        ->get('/startpro/wiki-reader/bookmarks/{id}', 'startpro-wiki-reader.bookmarks.show', ShowBookmarkController::class)
        ->patch('/startpro/wiki-reader/bookmarks/{id}', 'startpro-wiki-reader.bookmarks.update', UpdateBookmarkController::class)
        ->delete('/startpro/wiki-reader/bookmarks/{id}', 'startpro-wiki-reader.bookmarks.delete', DeleteBookmarkController::class)
        ->post('/startpro/wiki-reader/bookmarks/{id}/restore', 'startpro-wiki-reader.bookmarks.restore', RestoreBookmarkController::class)
        ->get('/startpro/wiki-reader/highlights', 'startpro-wiki-reader.highlights.index', HighlightsController::class)
        ->post('/startpro/wiki-reader/highlights', 'startpro-wiki-reader.highlights.create', CreateHighlightController::class)
        ->get('/startpro/wiki-reader/highlights/{id}', 'startpro-wiki-reader.highlights.show', ShowHighlightController::class)
        ->patch('/startpro/wiki-reader/highlights/{id}', 'startpro-wiki-reader.highlights.update', UpdateHighlightController::class)
        ->delete('/startpro/wiki-reader/highlights/{id}', 'startpro-wiki-reader.highlights.delete', DeleteHighlightController::class)
        ->get('/startpro/wiki-reader/shelf', 'startpro-wiki-reader.shelf', ShelfController::class)
        ->post('/startpro/wiki-reader/books', 'startpro-wiki-reader.books.create', CreateBookController::class)
        ->patch('/startpro/wiki-reader/books/{id}', 'startpro-wiki-reader.books.update', UpdateBookController::class)
        ->post('/startpro/wiki-reader/books/{id}/chapters', 'startpro-wiki-reader.chapters.attach', AttachChapterController::class)
        ->delete('/startpro/wiki-reader/books/{id}/chapters/{articleId}', 'startpro-wiki-reader.chapters.detach', DetachChapterController::class)
        ->post('/startpro/wiki-reader/completions/{id}', 'startpro-wiki-reader.completions.create', CompleteChapterController::class)
        ->delete('/startpro/wiki-reader/completions/{id}', 'startpro-wiki-reader.completions.delete', UncompleteChapterController::class)
        ->post('/startpro/wiki-reader/activity/{id}', 'startpro-wiki-reader.activity', ActivityController::class)
        ->get('/startpro/wiki-reader/stats', 'startpro-wiki-reader.stats', ReadingStatsController::class),
];
