<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReadingBookmark;
use StartPro\WikiReader\Model\ReadingProgress;

final class LibraryController extends ReaderController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $userId = $this->actorId($request);
        if ($userId === null) {
            return $this->error('Sign in to view your reading history', 401);
        }

        // Relationship filters inherit WikiArticle's SoftDeletes scope.
        // Draft articles never appear in a reader's library.
        $visible = static fn ($query) => $query->where('is_draft', false);

        $positions = ReadingProgress::query()
            ->where('user_id', $userId)
            ->whereHas('article', $visible)
            ->with('article')
            ->orderByDesc('updated_at')
            ->limit(50)->get()
            ->map(fn (ReadingProgress $progress) => [
                'article' => $this->articleData($progress->article),
                'progress' => $this->positionData($progress),
            ])->all();

        $bookmarks = ReadingBookmark::query()
            ->where('user_id', $userId)
            ->whereHas('article', $visible)
            ->with('article')
            ->orderByDesc('created_at')
            ->limit(100)->get()
            ->map(fn (ReadingBookmark $bookmark) => [
                'article' => $this->articleData($bookmark->article),
                'bookmark' => $this->bookmarkData($bookmark),
            ])->all();

        return $this->reply(['recent' => $positions, 'bookmarks' => $bookmarks]);
    }
}
