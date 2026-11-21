<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReadingCompletion;

final class UncompleteChapterController extends ReaderController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $userId = $this->actorId($request);
        if ($userId === null) return $this->error('Sign in to track completion', 401);
        $id = (int) ($request->getQueryParams()['id'] ?? 0);
        if (!$this->publicArticleById($id)) return $this->error('Article not found', 404);
        ReadingCompletion::query()->where('user_id', $userId)->where('article_id', $id)->delete();
        return $this->reply(['articleId' => $id, 'completed' => false]);
    }
}
