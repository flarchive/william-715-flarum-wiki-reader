<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Model;

use Flarum\Database\AbstractModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LinkRobins\Wiki\WikiArticle;

class ReaderBookChapter extends AbstractModel
{
    protected $table = 'startpro_wiki_reader_chapters';
    protected $fillable = ['book_id', 'article_id', 'position'];

    public function article(): BelongsTo
    {
        return $this->belongsTo(WikiArticle::class, 'article_id');
    }

    public function book(): BelongsTo
    {
        return $this->belongsTo(ReaderBook::class, 'book_id');
    }
}
