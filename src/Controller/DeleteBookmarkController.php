<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReadingBookmark;

final class DeleteBookmarkController extends ReaderController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $userId = $this->actorId($request);
        if ($userId === null) {
            return $this->error('Sign in to remove bookmarks', 401);
        }

        $id = (int) ($request->getQueryParams()['id'] ?? 0);
        $bookmark = ReadingBookmark::query()->where('user_id', $userId)->find($id);
        if (!$bookmark) {
            return $this->error('Bookmark not found', 404);
        }

        $bookmark->delete();

        return $this->reply(['deleted' => true]);
    }
}
