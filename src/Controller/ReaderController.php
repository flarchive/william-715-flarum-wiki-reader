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
use StartPro\WikiReader\Model\ReadingHighlight;

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
        if (!is_numeric($value)) return null;
        $value = (float) $value;
        return is_finite($value) && $value >= 0 && $value <= 100 ? round($value, 2) : null;
    }

    protected function anchor(mixed $value): ?string
    {
        if (!is_string($value) || $value === '') return null;
        if (mb_strlen($value) > 190 || !preg_match('/^[\p{L}\p{N}_:.\-]+$/u', $value)) return null;
        return $value;
    }

    /**
     * Accept only a bounded, versioned quote+context shape. Never trust arbitrary
     * client-supplied JSON, markup, URLs or long article content.
     */
    protected function positionContext(mixed $value): ?array
    {
        if (!is_array($value)) return null;
        $text = static function (mixed $input, int $limit): string {
            if (!is_string($input)) return '';
            $input = trim(preg_replace('/\s+/u', ' ', $input) ?? '');
            return mb_substr($input, 0, $limit);
        };
        $quote = isset($value['quote']) && is_array($value['quote']) ? $value['quote'] : [];
        $block = isset($value['block']) && is_array($value['block']) ? $value['block'] : [];
        $index = $block['index'] ?? null;
        $ratio = $block['ratio'] ?? null;
        $index = filter_var($index, FILTER_VALIDATE_INT);
        $ratio = filter_var($ratio, FILTER_VALIDATE_INT);
        $result = [
            'v' => 1,
            'quote' => [
                'exact' => $text($quote['exact'] ?? null, 100),
                'prefix' => $text($quote['prefix'] ?? null, 48),
                'suffix' => $text($quote['suffix'] ?? null, 48),
            ],
            'block' => [
                'index' => $index !== false && $index >= 0 && $index <= 1000000 ? $index : null,
                'ratio' => $ratio !== false && $ratio >= 0 && $ratio <= 1000 ? $ratio : null,
                'preview' => $text($block['preview'] ?? null, 160),
            ],
            'heading' => $this->anchor($value['heading'] ?? null),
        ];
        // Keep stored contexts small even on MySQL TEXT.
        return strlen(json_encode($result, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE)) <= 1800 ? $result : null;
    }

    protected function label(mixed $value, string $fallback): ?string
    {
        if (!is_string($value)) return null;
        $label = trim($value);
        if ($label === '') $label = trim($fallback);
        if ($label === '') return null;
        return mb_substr($label, 0, 120);
    }

    protected function note(mixed $value): ?string
    {
        if (!is_string($value)) return null;
        return mb_strlen($value) <= 1000 ? trim($value) : null;
    }

    protected function admin(ServerRequestInterface $request): bool
    {
        $actor = RequestUtil::getActor($request);
        return !$actor->isGuest() && $actor->isAdmin();
    }

    protected function boundedText(mixed $value, int $length, bool $required = false): ?string
    {
        if (!is_string($value)) return null;
        $value = trim(preg_replace('/\s+/u', ' ', $value) ?? '');
        if (($required && $value === '') || mb_strlen($value) > $length) return null;
        return $value;
    }

    protected function highlightData(ReadingHighlight $item): array
    {
        return [
            'id' => (int) $item->id,
            'articleId' => (int) $item->article_id,
            'quote' => (string) $item->quote_text,
            'note' => (string) ($item->note ?? ''),
            'positionContext' => $item->position_context,
            'createdAt' => $item->created_at?->toIso8601String(),
            'updatedAt' => $item->updated_at?->toIso8601String(),
        ];
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
        if (!$position) return null;
        return [
            'scrollPercent' => (float) $position->scroll_percent,
            'anchorId' => $position->anchor_id,
            'positionContext' => $position->position_context,
            'version' => (int) ($position->version ?? 1),
            'updatedAt' => $position->updated_at?->toIso8601String(),
        ];
    }

    protected function bookmarkData(ReadingBookmark $bookmark): array
    {
        return [
            'id' => (int) $bookmark->id,
            'articleId' => (int) $bookmark->article_id,
            'label' => (string) $bookmark->label,
            'note' => (string) ($bookmark->note ?? ''),
            'anchorId' => $bookmark->anchor_id,
            'positionContext' => $bookmark->position_context,
            'scrollPercent' => (float) $bookmark->scroll_percent,
            'createdAt' => $bookmark->created_at?->toIso8601String(),
            'updatedAt' => $bookmark->updated_at?->toIso8601String(),
        ];
    }
}
