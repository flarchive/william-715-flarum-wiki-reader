<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Model;

use Flarum\Database\AbstractModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LinkRobins\Wiki\WikiArticle;

class ReadingProgress extends AbstractModel
{
    protected $table = 'startpro_wiki_reader_progress';

    protected $fillable = ['user_id', 'article_id', 'scroll_percent', 'anchor_id'];

    protected $casts = ['scroll_percent' => 'float', 'article_id' => 'integer', 'user_id' => 'integer'];

    public function article(): BelongsTo
    {
        return $this->belongsTo(WikiArticle::class, 'article_id');
    }
}
