<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReadingSession;
use StartPro\WikiReader\Model\ReadingHighlight;
use StartPro\WikiReader\Model\ReadingCompletion;
use StartPro\WikiReader\Model\ReadingProgress;
use StartPro\WikiReader\Model\ReadingBookmark;
use Carbon\Carbon;

final class ReadingStatsController extends ReaderController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $userId = $this->actorId($request);
        if ($userId === null) return $this->error('Sign in to view statistics', 401);
        $sessions = ReadingSession::query()->where('user_id', $userId);
        $totalSeconds = (int) (clone $sessions)->sum('active_seconds');
        $recentSince = Carbon::now()->subDays(30);
        $recentSeconds = (int) (clone $sessions)->where('updated_at', '>=', $recentSince)->sum('active_seconds');
        $days = (clone $sessions)->where('updated_at', '>=', $recentSince)
            ->orderByDesc('updated_at')->limit(5000)->pluck('updated_at')
            ->map(fn ($date) => substr((string) $date, 0, 10))->unique()->count();
        return $this->reply(['stats' => [
            'estimatedReadingSeconds' => $totalSeconds,
            'estimatedLast30DaysSeconds' => $recentSeconds,
            'activeDaysLast30' => $days,
            'articlesVisited' => ReadingProgress::query()->where('user_id', $userId)->count(),
            'articlesCompleted' => ReadingCompletion::query()->where('user_id', $userId)->count(),
            'bookmarks' => ReadingBookmark::query()->where('user_id', $userId)->count(),
            'highlights' => ReadingHighlight::query()->where('user_id', $userId)->count(),
        ]]);
    }
}
