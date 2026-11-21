<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Model;

use Flarum\Database\AbstractModel;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LinkRobins\Wiki\WikiArticle;

class ReadingHighlight extends AbstractModel
{
    protected $table = 'startpro_wiki_reader_highlights';
    protected $fillable = ['user_id', 'article_id', 'quote_text', 'note', 'position_context'];
    protected $casts = ['user_id' => 'integer', 'article_id' => 'integer', 'position_context' => 'array'];

    public function article(): BelongsTo
    {
        return $this->belongsTo(WikiArticle::class, 'article_id');
    }
}
