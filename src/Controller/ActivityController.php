<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\QueryException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReadingSession;

final class ActivityController extends ReaderController implements RequestHandlerInterface
{
    public function __construct(private readonly ConnectionInterface $connection) {}

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $userId = $this->actorId($request);
        if ($userId === null) return $this->error('Sign in to track reading', 401);
        $id = (int) ($request->getQueryParams()['id'] ?? 0);
        if (!$this->publicArticleById($id)) return $this->error('Article not found', 404);
        $body = $this->payload($request);
        $key = $body['sessionKey'] ?? null;
        $seconds = filter_var($body['activeSeconds'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 14400]]);
        if (!is_string($key) || !preg_match('/^[A-Za-z0-9_-]{16,64}$/', $key) || $seconds === false) {
            return $this->error('Invalid session or activeSeconds', 422);
        }
        try {
            $result = $this->connection->transaction(function () use ($userId, $id, $key, $seconds): array {
                $row = ReadingSession::query()->where('user_id', $userId)
                    ->where('session_key', $key)->lockForUpdate()->first();
                if ($row && (int) $row->article_id !== $id) return ['mismatch' => true];
                if (!$row) {
                    $row = ReadingSession::query()->create([
                        'user_id' => $userId, 'article_id' => $id, 'session_key' => $key,
                        'active_seconds' => $seconds,
                    ]);
                } elseif ($seconds > (int) $row->active_seconds) {
                    $row->active_seconds = $seconds;
                    $row->save();
                }
                return ['activeSeconds' => (int) $row->active_seconds];
            });
        } catch (QueryException $e) {
            $mysqlError = (string) ($e->errorInfo[1] ?? '');
            if (!in_array($mysqlError, ['1062', '19'], true) && (string) $e->getCode() !== '23000') throw $e;
            // Another tab won a first-write race. Its row is already persisted.
            $existing = ReadingSession::query()->where('user_id', $userId)
                ->where('session_key', $key)->first();
            if (!$existing) throw $e;
            if ((int) $existing->article_id !== $id) return $this->error('Session belongs to a different article', 409);
            if ($seconds > (int) $existing->active_seconds) {
                return $this->reply(['activeSeconds' => (int) $this->connection->transaction(function () use ($userId, $key, $seconds) {
                    $locked = ReadingSession::query()->where('user_id', $userId)->where('session_key', $key)
                        ->lockForUpdate()->firstOrFail();
                    if ($seconds > (int) $locked->active_seconds) {
                        $locked->active_seconds = $seconds;
                        $locked->save();
                    }
                    return $locked->active_seconds;
                })]);
            }
            return $this->reply(['activeSeconds' => (int) $existing->active_seconds]);
        }
        if (isset($result['mismatch'])) return $this->error('Session belongs to a different article', 409);
        return $this->reply($result);
    }
}
