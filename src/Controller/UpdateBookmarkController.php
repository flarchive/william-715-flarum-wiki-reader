<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReadingBookmark;

final class UpdateBookmarkController extends ReaderController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $userId = $this->actorId($request);
        if ($userId === null) return $this->error('Sign in to edit bookmarks', 401);
        $id = filter_var($request->getQueryParams()['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id || $id < 1) return $this->error('Invalid bookmark ID', 422);
        $bookmark = ReadingBookmark::query()->where('user_id', $userId)->find((int) $id);
        if (!$bookmark) return $this->error('Bookmark not found', 404);
        $body = $this->payload($request);
        if (!array_key_exists('label', $body) && !array_key_exists('note', $body)) {
            return $this->error('No changes supplied', 422);
        }
        if (array_key_exists('label', $body)) {
            $label = $this->label($body['label'], '');
            if ($label === null || $label === '') return $this->error('Label is required', 422);
            $bookmark->label = $label;
        }
        if (array_key_exists('note', $body)) {
            $note = $this->note($body['note']);
            if ($note === null) return $this->error('Note must be at most 1000 characters', 422);
            $bookmark->note = $note;
        }
        $bookmark->save();
        return $this->reply(['bookmark' => $this->bookmarkData($bookmark)]);
    }
}
