<?php

declare(strict_types=1);

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('startpro_wiki_reader_bookmarks', function (Blueprint $table): void {
    $table->increments('id');
    $table->unsignedInteger('user_id');
    $table->unsignedInteger('article_id');
    $table->string('anchor_id', 190)->nullable();
    $table->string('label', 120);
    $table->decimal('scroll_percent', 5, 2)->default(0);
    $table->timestamps();
    $table->index(['user_id', 'created_at'], 'spr_bookmarks_recent_idx');
    $table->index(['user_id', 'article_id'], 'spr_bookmarks_article_idx');
});
