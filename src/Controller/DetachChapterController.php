<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReaderBookChapter;

final class DetachChapterController extends ReaderController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (!$this->admin($request)) return $this->error('Admin access required', 403);
        $params = $request->getQueryParams();
        $bookId = (int) ($params['id'] ?? 0);
        $articleId = (int) ($params['articleId'] ?? 0);
        if ($bookId < 1 || $articleId < 1) return $this->error('Invalid chapter', 422);
        $chapter = ReaderBookChapter::query()->where('book_id', $bookId)->where('article_id', $articleId)->first();
        if (!$chapter) return $this->error('Chapter not found', 404);
        $chapter->delete();
        return $this->reply(['deleted' => true]);
    }
}
