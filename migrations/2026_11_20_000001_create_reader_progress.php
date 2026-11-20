<?php

declare(strict_types=1);

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

return Migration::createTable('startpro_wiki_reader_progress', function (Blueprint $table): void {
    $table->increments('id');
    $table->unsignedInteger('user_id');
    $table->unsignedInteger('article_id');
    $table->decimal('scroll_percent', 5, 2)->default(0);
    $table->string('anchor_id', 190)->nullable();
    $table->timestamps();
    $table->unique(['user_id', 'article_id'], 'spr_progress_user_article_uq');
    $table->index(['user_id', 'updated_at'], 'spr_progress_recent_idx');
});
