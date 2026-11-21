<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Carbon\Carbon;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReadingBookmark;

final class RestoreBookmarkController extends ReaderController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $userId = $this->actorId($request);
        if ($userId === null) return $this->error('Sign in to restore bookmarks', 401);
        $id = (int) ($request->getQueryParams()['id'] ?? 0);
        $bookmark = ReadingBookmark::withTrashed()->where('user_id', $userId)->find($id);
        if (!$bookmark || !$bookmark->trashed()) return $this->error('Deleted bookmark not found', 404);
        if ($bookmark->deleted_at->lt(Carbon::now()->subMinutes(10))) {
            return $this->error('Undo window expired', 410);
        }
        if (ReadingBookmark::query()->where('user_id', $userId)->count() >= 2000) {
            return $this->error('Bookmark limit reached (2000)', 422);
        }
        $bookmark->restore();
        return $this->reply(['bookmark' => $this->bookmarkData($bookmark)]);
    }
}
