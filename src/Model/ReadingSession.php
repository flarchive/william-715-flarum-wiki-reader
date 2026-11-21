<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Model;

use Flarum\Database\AbstractModel;

class ReadingSession extends AbstractModel
{
    protected $table = 'startpro_wiki_reader_sessions';
    protected $fillable = ['user_id', 'article_id', 'session_key', 'active_seconds'];
    protected $casts = ['user_id' => 'integer', 'article_id' => 'integer', 'active_seconds' => 'integer'];
}
