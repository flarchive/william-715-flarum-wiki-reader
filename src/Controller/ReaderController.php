<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Flarum\Http\RequestUtil;
use Laminas\Diactoros\Response\JsonResponse;
use LinkRobins\Wiki\WikiArticle;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use StartPro\WikiReader\Model\ReadingBookmark;
use StartPro\WikiReader\Model\ReadingProgress;

abstract class ReaderController
{
    protected function actorId(ServerRequestInterface $request): ?int
    {
        $actor = RequestUtil::getActor($request);

        return $actor->isGuest() ? null : (int) $actor->id;
    }

    protected function reply(array $payload, int $status = 200): ResponseInterface
    {
        return new JsonResponse($payload, $status, [
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    protected function error(string $message, int $status): ResponseInterface
    {
        return $this->reply(['error' => $message], $status);
    }

    protected function publicArticleByAddress(string $address): ?WikiArticle
    {
        return WikiArticle::findByAddress(
            WikiArticle::query()->where('is_draft', false),
            $address
        );
    }

    protected function publicArticleById(int $id): ?WikiArticle
    {
        return $id > 0 ? WikiArticle::query()->where('is_draft', false)->find($id) : null;
    }

    protected function payload(ServerRequestInterface $request): array
    {
        $data = $request->getParsedBody();

        return is_array($data) ? $data : [];
    }

    protected function percentage(mixed $value): ?float
    {
        if (!is_numeric($value)) {
            return null;
        }

        $value = (float) $value;

        return is_finite($value) && $value >= 0 && $value <= 100
            ? round($value, 2)
            : null;
    }

    protected function anchor(mixed $value): ?string
    {
        if (!is_string($value) || $value === '') {
            return null;
        }

        // Heading anchors are identifiers, not arbitrary URLs or HTML.
        // Unicode letters allow Markdown headings written in Chinese.
        if (mb_strlen($value) > 190 || !preg_match('/^[\p{L}\p{N}_:.\-]+$/u', $value)) {
            return null;
        }

        return $value;
    }

    protected function articleData(WikiArticle $article): array
    {
        return [
            'id' => (int) $article->id,
            'title' => (string) $article->title,
            'slug' => (string) ($article->slug ?: $article->id),
            'categoryId' => $article->category_id !== null ? (int) $article->category_id : null,
        ];
    }

    protected function positionData(?ReadingProgress $position): ?array
    {
        if (!$position) {
            return null;
        }

        return [
            'scrollPercent' => (float) $position->scroll_percent,
            'anchorId' => $position->anchor_id,
            'updatedAt' => $position->updated_at?->toIso8601String(),
        ];
    }

    protected function bookmarkData(ReadingBookmark $bookmark): array
    {
        return [
            'id' => (int) $bookmark->id,
            'articleId' => (int) $bookmark->article_id,
            'label' => (string) $bookmark->label,
            'anchorId' => $bookmark->anchor_id,
            'scrollPercent' => (float) $bookmark->scroll_percent,
            'createdAt' => $bookmark->created_at?->toIso8601String(),
        ];
    }
}
