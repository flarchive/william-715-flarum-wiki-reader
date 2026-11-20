<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReadingProgress;

final class SaveProgressController extends ReaderController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $userId = $this->actorId($request);
        if ($userId === null) {
            return $this->error('Sign in to save reading progress', 401);
        }

        $id = (int) ($request->getQueryParams()['id'] ?? 0);
        $article = $this->publicArticleById($id);
        if (!$article) {
            return $this->error('Article not found', 404);
        }

        $body = $this->payload($request);
        $percent = $this->percentage($body['scrollPercent'] ?? null);
        if ($percent === null) {
            return $this->error('scrollPercent must be between 0 and 100', 422);
        }

        $position = ReadingProgress::query()->updateOrCreate(
            ['user_id' => $userId, 'article_id' => (int) $article->id],
            ['scroll_percent' => $percent, 'anchor_id' => $this->anchor($body['anchorId'] ?? null)]
        );

        return $this->reply(['progress' => $this->positionData($position)]);
    }
}
