<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReadingHighlight;

final class DeleteHighlightController extends ReaderController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $userId = $this->actorId($request);
        if ($userId === null) return $this->error('Sign in to delete highlights', 401);
        $id = (int) ($request->getQueryParams()['id'] ?? 0);
        $item = ReadingHighlight::query()->where('user_id', $userId)->find($id);
        if (!$item) return $this->error('Highlight not found', 404);
        $item->delete();
        return $this->reply(['deleted' => true]);
    }
}
