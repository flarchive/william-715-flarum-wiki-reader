<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReadingHighlight;

final class CreateHighlightController extends ReaderController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $userId = $this->actorId($request);
        if ($userId === null) return $this->error('Sign in to highlight text', 401);
        $data = $this->payload($request);
        $id = filter_var($data['articleId'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $article = $id === false ? null : $this->publicArticleById((int) $id);
        if (!$article) return $this->error('Article not found', 404);
        $quote = $this->boundedText($data['quote'] ?? null, 500, true);
        $note = $this->note($data['note'] ?? '');
        $context = $this->positionContext($data['positionContext'] ?? null);
        if ($quote === null || $context === null || $note === null) return $this->error('Invalid highlight', 422);
        if (ReadingHighlight::query()->where('user_id', $userId)->count() >= 5000) {
            return $this->error('Highlight limit reached (5000)', 422);
        }
        $highlight = ReadingHighlight::query()->create([
            'user_id' => $userId, 'article_id' => (int) $article->id,
            'quote_text' => $quote, 'note' => $note, 'position_context' => $context,
        ]);
        return $this->reply(['highlight' => $this->highlightData($highlight)], 201);
    }
}
