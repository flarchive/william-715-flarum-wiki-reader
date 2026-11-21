<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReadingHighlight;

final class UpdateHighlightController extends ReaderController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $userId = $this->actorId($request);
        if ($userId === null) return $this->error('Sign in to edit highlights', 401);
        $id = (int) ($request->getQueryParams()['id'] ?? 0);
        if ($id < 1) return $this->error('Invalid highlight ID', 422);
        $highlight = ReadingHighlight::query()->where('user_id', $userId)->find($id);
        if (!$highlight) return $this->error('Highlight not found', 404);
        $body = $this->payload($request);
        if (!array_key_exists('note', $body)) return $this->error('Note is required', 422);
        $note = $this->note($body['note']);
        if ($note === null) return $this->error('Note must be at most 1000 characters', 422);
        $highlight->note = $note;
        $highlight->save();
        return $this->reply(['highlight' => $this->highlightData($highlight)]);
    }
}
