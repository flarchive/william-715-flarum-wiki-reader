<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReadingBookmark;

final class ShowBookmarkController extends ReaderController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $userId = $this->actorId($request);
        if ($userId === null) return $this->error('Sign in to view bookmarks', 401);
        $id = (int) ($request->getQueryParams()['id'] ?? 0);
        if ($id < 1) return $this->error('Invalid bookmark ID', 422);
        $bookmark = ReadingBookmark::query()
            ->where('user_id', $userId)
            ->whereHas('article', static fn ($q) => $q->where('is_draft', false))
            ->with('article')->find($id);
        if (!$bookmark) return $this->error('Bookmark not found', 404);
        return $this->reply(['article' => $this->articleData($bookmark->article),
            'bookmark' => $this->bookmarkData($bookmark)]);
    }
}
