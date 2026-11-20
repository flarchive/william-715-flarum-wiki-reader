<?php

declare(strict_types=1);

use Flarum\Extend;
use StartPro\WikiReader\Controller\ArticleStateController;
use StartPro\WikiReader\Controller\LibraryController;
use StartPro\WikiReader\Controller\SaveProgressController;
use StartPro\WikiReader\Controller\CreateBookmarkController;
use StartPro\WikiReader\Controller\DeleteBookmarkController;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        ->css(__DIR__.'/less/forum.css'),

    (new Extend\Routes('api'))
        ->get('/startpro/wiki-reader', 'startpro-wiki-reader.library', LibraryController::class)
        ->get('/startpro/wiki-reader/article', 'startpro-wiki-reader.article', ArticleStateController::class)
        ->post('/startpro/wiki-reader/progress/{id}', 'startpro-wiki-reader.progress', SaveProgressController::class)
        ->post('/startpro/wiki-reader/bookmarks', 'startpro-wiki-reader.bookmarks.create', CreateBookmarkController::class)
        ->delete('/startpro/wiki-reader/bookmarks/{id}', 'startpro-wiki-reader.bookmarks.delete', DeleteBookmarkController::class),
];
