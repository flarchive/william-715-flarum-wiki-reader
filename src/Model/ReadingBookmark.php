<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Model;

use Flarum\Database\AbstractModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use LinkRobins\Wiki\WikiArticle;

class ReadingBookmark extends AbstractModel
{
    use SoftDeletes;

    protected $table = 'startpro_wiki_reader_bookmarks';

    protected $fillable = [
        'user_id', 'article_id', 'scroll_percent', 'anchor_id', 'label', 'note', 'position_context',
    ];

    protected $casts = [
        'scroll_percent' => 'float',
        'article_id' => 'integer',
        'user_id' => 'integer',
        'position_context' => 'array',
    ];

    public function article(): BelongsTo
    {
        return $this->belongsTo(WikiArticle::class, 'article_id');
    }
}
