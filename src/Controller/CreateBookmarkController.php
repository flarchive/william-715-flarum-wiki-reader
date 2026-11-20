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
        if ($userId === null) {
            return $this->error('Sign in to add bookmarks', 401);
        }

        $body = $this->payload($request);
        $rawId = $body['articleId'] ?? null;
        $articleId = (is_string($rawId) || is_int($rawId))
            ? filter_var($rawId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]])
            : false;
        $article = $articleId === false ? null : $this->publicArticleById((int) $articleId);
        if (!$article) {
            return $this->error('Article not found', 404);
        }

        $percent = $this->percentage($body['scrollPercent'] ?? null);
        if ($percent === null) {
            return $this->error('scrollPercent must be between 0 and 100', 422);
        }

        $rawLabel = $body['label'] ?? '';
        $label = is_string($rawLabel) ? trim($rawLabel) : '';
        $label = mb_substr($label !== '' ? $label : (string) $article->title, 0, 120);

        if (ReadingBookmark::query()->where('user_id', $userId)->count() >= 200) {
            return $this->error('Bookmark limit reached (200)', 422);
        }

        $bookmark = ReadingBookmark::query()->create([
            'user_id' => $userId,
            'article_id' => (int) $article->id,
            'scroll_percent' => $percent,
            'anchor_id' => $this->anchor($body['anchorId'] ?? null),
            'label' => $label,
        ]);

        return $this->reply(['bookmark' => $this->bookmarkData($bookmark)], 201);
    }
}
