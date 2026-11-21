<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReaderBook;

final class UpdateBookController extends ReaderController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (!$this->admin($request)) return $this->error('Admin access required', 403);
        $id = (int) ($request->getQueryParams()['id'] ?? 0);
        $book = ReaderBook::query()->find($id);
        if (!$book) return $this->error('Book not found', 404);
        $body = $this->payload($request);
        if (!array_key_exists('title', $body) && !array_key_exists('description', $body)) return $this->error('No changes', 422);
        if (array_key_exists('title', $body)) {
            $title = $this->boundedText($body['title'], 160, true);
            if ($title === null) return $this->error('Invalid title', 422);
            $book->title = $title;
        }
        if (array_key_exists('description', $body)) {
            $desc = $this->boundedText($body['description'], 500);
            if ($desc === null) return $this->error('Invalid description', 422);
            $book->description = $desc;
        }
        $book->save();
        return $this->reply(['book' => ['id' => (int) $book->id, 'title' => $book->title,
            'description' => (string) $book->description]]);
    }
}
