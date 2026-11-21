<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Illuminate\Database\QueryException;
use Illuminate\Database\ConnectionInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReadingProgress;

final class SaveProgressController extends ReaderController implements RequestHandlerInterface
{
    public function __construct(private ConnectionInterface $connection)
    {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $userId = $this->actorId($request);
        if ($userId === null) return $this->error('Sign in to save reading progress', 401);

        $id = (int) ($request->getQueryParams()['id'] ?? 0);
        $article = $this->publicArticleById($id);
        if (!$article) return $this->error('Article not found', 404);

        $body = $this->payload($request);
        $percent = $this->percentage($body['scrollPercent'] ?? null);
        if ($percent === null) return $this->error('scrollPercent must be between 0 and 100', 422);
        $expected = $body['expectedVersion'] ?? null;
        // Explicitly require a version so old cached tabs cannot silently
        // overwrite a position saved by another device.
        if (!is_int($expected) || $expected < 0) {
            return $this->error('expectedVersion is required (0 for a new article)', 422);
        }
        $force = ($body['force'] ?? false) === true;
        $attrs = [
            'scroll_percent' => $percent,
            'anchor_id' => $this->anchor($body['anchorId'] ?? null),
            'position_context' => $this->positionContext($body['positionContext'] ?? null),
        ];
        try {
            $result = $this->connection->transaction(function () use ($userId, $article, $expected, $force, $attrs): array {
                $position = ReadingProgress::query()
                    ->where('user_id', $userId)
                    ->where('article_id', $article->id)
                    ->lockForUpdate()->first();
                $actual = $position ? (int) $position->version : 0;
                if (!$force && $actual !== $expected) {
                    return ['conflict' => true, 'progress' => $this->positionData($position)];
                }
                if (!$position) {
                    $position = ReadingProgress::query()->create([
                        'user_id' => $userId, 'article_id' => (int) $article->id,
                        ...$attrs, 'version' => 1,
                    ]);
                } else {
                    $position->fill([...$attrs, 'version' => $actual + 1]);
                    $position->save();
                }
                return ['conflict' => false, 'progress' => $this->positionData($position)];
            });
        } catch (QueryException $e) {
            // Concurrent first writes can race on the unique(user_id,article_id)
            // index. Only convert duplicate-key errors to conflicts.
            $code = (string) ($e->errorInfo[1] ?? '');
            if (!in_array($code, ['1062', '19'], true) && (string) $e->getCode() !== '23000') throw $e;
            $position = ReadingProgress::query()->where('user_id', $userId)
                ->where('article_id', $article->id)->first();
            return $this->reply(['error' => 'Reading progress was updated by another session',
                'conflict' => true, 'progress' => $this->positionData($position)], 409);
        }

        if ($result['conflict']) {
            return $this->reply(['error' => 'Reading progress was updated by another session',
                'conflict' => true, 'progress' => $result['progress']], 409);
        }
        return $this->reply(['progress' => $result['progress']]);
    }
}
