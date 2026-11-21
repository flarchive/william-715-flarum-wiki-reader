<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReaderBook;

final class CreateBookController extends ReaderController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (!$this->admin($request)) return $this->error('Admin access required', 403);
        $data = $this->payload($request);
        $title = $this->boundedText($data['title'] ?? null, 160, true);
        $description = $this->boundedText($data['description'] ?? '', 500);
        if ($title === null || $description === null) return $this->error('Invalid book title or description', 422);
        if (ReaderBook::query()->count() >= 200) return $this->error('Book limit reached', 422);
        $book = ReaderBook::query()->create(['title' => $title, 'description' => $description]);
        return $this->reply(['book' => ['id' => (int) $book->id, 'title' => $book->title,
            'description' => (string) $book->description]], 201);
    }
}
