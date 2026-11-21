<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReaderBook;
use StartPro\WikiReader\Model\ReaderBookChapter;

final class AttachChapterController extends ReaderController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (!$this->admin($request)) return $this->error('Admin access required', 403);
        $bookId = (int) ($request->getQueryParams()['id'] ?? 0);
        $book = ReaderBook::query()->find($bookId);
        if (!$book) return $this->error('Book not found', 404);
        $data = $this->payload($request);
        $articleId = filter_var($data['articleId'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $article = $articleId === false ? null : $this->publicArticleById((int) $articleId);
        if (!$article) return $this->error('Article not found', 404);
        $position = filter_var($data['position'] ?? 0, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 100000]]);
        if ($position === false) return $this->error('Invalid position', 422);
        $existing = ReaderBookChapter::query()->where('article_id', $article->id)->first();
        if ($existing && (int) $existing->book_id !== $bookId) {
            return $this->error('Article belongs to another book; remove it from that book first', 409);
        }
        if (!$existing && ReaderBookChapter::query()->where('book_id', $bookId)->count() >= 300) {
            return $this->error('Book chapter limit reached (300)', 422);
        }
        $chapter = ReaderBookChapter::query()->updateOrCreate(['article_id' => (int) $article->id],
            ['book_id' => $bookId, 'position' => $position]);
        return $this->reply(['chapter' => ['articleId' => (int) $chapter->article_id,
            'bookId' => (int) $chapter->book_id, 'position' => (int) $chapter->position]]);
    }
}
