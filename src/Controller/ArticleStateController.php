<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use StartPro\WikiReader\Model\ReadingBookmark;
use StartPro\WikiReader\Model\ReadingProgress;

final class ArticleStateController extends ReaderController implements RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $address = $request->getQueryParams()['address'] ?? '';

        if (!is_string($address) || trim($address) === '' || mb_strlen($address) > 200) {
            return $this->error('Invalid wiki article address', 422);
        }

        $article = $this->publicArticleByAddress($address);
        if (!$article) {
            return $this->error('Article not found', 404);
        }

        $userId = $this->actorId($request);
        $position = $userId === null ? null : ReadingProgress::query()
            ->where('user_id', $userId)->where('article_id', $article->id)->first();
        $bookmarks = $userId === null ? [] : ReadingBookmark::query()
            ->where('user_id', $userId)->where('article_id', $article->id)
            ->orderByDesc('created_at')->limit(100)->get()
            ->map(fn (ReadingBookmark $bookmark) => $this->bookmarkData($bookmark))->all();

        return $this->reply([
            'article' => $this->articleData($article),
            'signedIn' => $userId !== null,
            'progress' => $this->positionData($position),
            'bookmarks' => $bookmarks,
        ]);
    }
}
