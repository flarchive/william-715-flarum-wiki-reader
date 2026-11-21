<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReadingHighlight;

final class HighlightsController extends ReaderController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $userId = $this->actorId($request);
        if ($userId === null) return $this->error('Sign in to view highlights', 401);
        $params = $request->getQueryParams();
        $page = filter_var($params['page'] ?? 1, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $perPage = filter_var($params['perPage'] ?? 20, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 50]]);
        if ($page === false || $page > 100000 || $perPage === false) return $this->error('Invalid pagination', 422);
        $term = $this->boundedText($params['search'] ?? '', 80);
        if ($term === null) return $this->error('Invalid search text', 422);
        $query = ReadingHighlight::query()->where('user_id', $userId)
            ->whereHas('article', static fn ($q) => $q->where('is_draft', false))->with('article');
        $articleId = $params['articleId'] ?? null;
        if ($articleId !== null) {
            $articleId = filter_var($articleId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            if ($articleId === false) return $this->error('Invalid article ID', 422);
            $query->where('article_id', $articleId);
        }
        if ($term !== '') {
            $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $term);
            $like = '%'.$escaped.'%';
            $query->where(function ($q) use ($like): void {
                $q->where('quote_text', 'like', $like)->orWhere('note', 'like', $like)
                    ->orWhereHas('article', static fn ($a) => $a->where('title', 'like', $like));
            });
        }
        $result = $query->orderByDesc('created_at')->orderByDesc('id')
            ->paginate($perPage, ['*'], 'page', $page);
        return $this->reply([
            'highlights' => $result->getCollection()->map(fn ($item) => [
                'article' => $this->articleData($item->article),
                'highlight' => $this->highlightData($item),
            ])->all(),
            'pagination' => [
                'page' => $result->currentPage(), 'perPage' => $result->perPage(),
                'total' => $result->total(), 'lastPage' => $result->lastPage(),
                'hasMore' => $result->hasMorePages(),
            ],
        ]);
    }
}
