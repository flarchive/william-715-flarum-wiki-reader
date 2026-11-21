<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReadingBookmark;
use StartPro\WikiReader\Model\ReadingProgress;

final class LibraryController extends ReaderController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $userId = $this->actorId($request);
        if ($userId === null) return $this->error('Sign in to view your reading history', 401);
        $params = $request->getQueryParams();
        $page = filter_var($params['page'] ?? 1, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $perPage = filter_var($params['perPage'] ?? 20, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 50]]);
        if ($page === false || $page > 100000 || $perPage === false) return $this->error('Invalid pagination', 422);
        $term = trim(is_string($params['search'] ?? null) ? $params['search'] : '');
        if (mb_strlen($term) > 80) return $this->error('Search too long', 422);
        $sort = $params['sort'] ?? 'newest';
        if (!in_array($sort, ['newest', 'oldest', 'title'], true)) return $this->error('Invalid sort option', 422);
        $visible = static fn ($query) => $query->where('is_draft', false);

        $positions = ReadingProgress::query()
            ->where('user_id', $userId)->whereHas('article', $visible)->with('article')
            ->orderByDesc('updated_at')->limit(30)->get()
            ->map(fn (ReadingProgress $progress) => [
                'article' => $this->articleData($progress->article),
                'progress' => $this->positionData($progress),
            ])->all();

        $query = ReadingBookmark::query()
            ->where('user_id', $userId)->whereHas('article', $visible)->with('article');
        if ($term !== '') {
            $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $term);
            $like = '%'.$escaped.'%';
            $query->where(function ($builder) use ($like): void {
                $builder->where('label', 'like', $like)->orWhere('note', 'like', $like)
                    ->orWhereHas('article', function ($articleQuery) use ($like): void {
                        $articleQuery->where('title', 'like', $like);
                    });
            });
        }
        if ($sort === 'oldest') $query->orderBy('created_at')->orderBy('id');
        elseif ($sort === 'title') $query->orderBy('label')->orderByDesc('id');
        else $query->orderByDesc('created_at')->orderByDesc('id');
        $result = $query->paginate($perPage, ['*'], 'page', $page);
        $bookmarks = $result->getCollection()->map(fn (ReadingBookmark $bookmark) => [
            'article' => $this->articleData($bookmark->article),
            'bookmark' => $this->bookmarkData($bookmark),
        ])->all();
        return $this->reply([
            'recent' => $positions,
            'bookmarks' => $bookmarks,
            'pagination' => [
                'page' => $result->currentPage(), 'perPage' => $result->perPage(),
                'total' => $result->total(), 'lastPage' => $result->lastPage(),
                'hasMore' => $result->hasMorePages(),
            ],
        ]);
    }
}
