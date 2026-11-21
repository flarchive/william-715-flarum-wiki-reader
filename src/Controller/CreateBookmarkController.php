<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReadingBookmark;

final class CreateBookmarkController extends ReaderController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $userId = $this->actorId($request);
        if ($userId === null) return $this->error('Sign in to add bookmarks', 401);

        $body = $this->payload($request);
        $articleId = filter_var($body['articleId'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $article = $articleId === false ? null : $this->publicArticleById((int) $articleId);
        if (!$article) return $this->error('Article not found', 404);

        $percent = $this->percentage($body['scrollPercent'] ?? null);
        if ($percent === null) return $this->error('scrollPercent must be between 0 and 100', 422);
        $label = $this->label($body['label'] ?? '', (string) $article->title);
        if ($label === null) return $this->error('Invalid label', 422);
        $note = $this->note($body['note'] ?? '');
        if ($note === null) return $this->error('Note must be at most 1000 characters', 422);

        if (ReadingBookmark::query()->where('user_id', $userId)->count() >= 2000) {
            return $this->error('Bookmark limit reached (2000)', 422);
        }
        $bookmark = ReadingBookmark::query()->create([
            'user_id' => $userId, 'article_id' => (int) $article->id,
            'scroll_percent' => $percent,
            'anchor_id' => $this->anchor($body['anchorId'] ?? null),
            'position_context' => $this->positionContext($body['positionContext'] ?? null),
            'label' => $label,
            'note' => $note,
        ]);
        return $this->reply(['bookmark' => $this->bookmarkData($bookmark)], 201);
    }
}
