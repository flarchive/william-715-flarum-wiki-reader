<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReaderBook;
use StartPro\WikiReader\Model\ReadingCompletion;
use StartPro\WikiReader\Model\ReadingProgress;

final class ShelfController extends ReaderController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $userId = $this->actorId($request);
        if ($userId === null) return $this->error('Sign in to view your shelf', 401);

        $books = ReaderBook::query()->with(['chapters' => function ($q): void {
            $q->orderBy('position')->orderBy('id')->with('article');
        }])->orderBy('id')->limit(200)->get();

        $ids = [];
        foreach ($books as $book) {
            foreach ($book->chapters as $chapter) {
                if ($chapter->article && !$chapter->article->is_draft) {
                    $ids[] = (int) $chapter->article_id;
                }
            }
        }
        $ids = array_values(array_unique($ids));
        $progress = $ids ? ReadingProgress::query()->where('user_id', $userId)
            ->whereIn('article_id', $ids)->get()->keyBy('article_id') : collect();
        $completions = ReadingCompletion::query()->where('user_id', $userId)
            ->pluck('article_id')->mapWithKeys(fn ($id) => [(int) $id => true]);

        $payload = [];
        foreach ($books as $book) {
            $chapters = [];
            $last = null;
            $completed = 0;
            foreach ($book->chapters as $chapter) {
                $article = $chapter->article;
                if (!$article || $article->is_draft) continue;
                $id = (int) $article->id;
                $p = $progress->get($id);
                $done = $completions->has($id);
                if ($done) $completed++;
                $chapters[] = [
                    'article' => $this->articleData($article),
                    'position' => (int) $chapter->position,
                    'completed' => $done,
                    'progress' => $this->positionData($p),
                ];
                if ($p && (!$last || $p->updated_at->greaterThan($last->updated_at))) $last = $p;
            }
            if ($chapters || $this->admin($request)) {
                $payload[] = [
                    'id' => (int) $book->id,
                    'title' => (string) $book->title,
                    'description' => (string) ($book->description ?? ''),
                    'chaptersTotal' => count($chapters),
                    'chaptersCompleted' => $completed,
                    'lastArticleId' => $last ? (int) $last->article_id : null,
                    'chapters' => $chapters,
                ];
            }
        }

        $solo = ReadingProgress::query()->where('user_id', $userId)
            ->whereNotIn('article_id', $ids ?: [-1])
            ->whereHas('article', static fn ($q) => $q->where('is_draft', false))
            ->with('article')->orderByDesc('updated_at')->limit(60)->get()
            ->map(fn (ReadingProgress $p) => [
                'article' => $this->articleData($p->article),
                'progress' => $this->positionData($p),
                'completed' => $completions->has((int) $p->article_id),
            ])->all();

        return $this->reply(['books' => $payload, 'standalone' => $solo,
            'isAdmin' => $this->admin($request)]);
    }
}
