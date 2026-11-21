<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Model;

use Flarum\Database\AbstractModel;

class ReadingCompletion extends AbstractModel
{
    protected $table = 'startpro_wiki_reader_completions';
    protected $fillable = ['user_id', 'article_id'];
    protected $casts = ['user_id' => 'integer', 'article_id' => 'integer'];
}
