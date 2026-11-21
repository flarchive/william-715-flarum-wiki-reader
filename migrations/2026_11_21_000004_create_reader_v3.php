<?php

declare(strict_types=1);

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

// New tables only: old progress and bookmarks remain unchanged.
return [
    'up' => function (Builder $schema): void {
        $schema->create('startpro_wiki_reader_highlights', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('article_id');
            $table->string('quote_text', 500);
            $table->text('note')->nullable();
            $table->text('position_context')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'article_id'], 'spr_highlight_article_idx');
            $table->index(['user_id', 'created_at'], 'spr_highlight_recent_idx');
        });
        $schema->create('startpro_wiki_reader_books', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('title', 160);
            $table->string('description', 500)->nullable();
            $table->timestamps();
        });
        $schema->create('startpro_wiki_reader_chapters', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('book_id');
            $table->unsignedInteger('article_id');
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
            $table->unique('article_id', 'spr_one_book_per_article_uq');
            $table->index(['book_id', 'position'], 'spr_chapter_order_idx');
        });
        $schema->create('startpro_wiki_reader_completions', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('article_id');
            $table->timestamps();
            $table->unique(['user_id', 'article_id'], 'spr_completed_user_article_uq');
        });
        $schema->create('startpro_wiki_reader_sessions', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('article_id');
            $table->string('session_key', 64);
            $table->unsignedInteger('active_seconds')->default(0);
            $table->timestamps();
            $table->unique(['user_id', 'session_key'], 'spr_session_idempotency_uq');
            $table->index(['user_id', 'updated_at'], 'spr_session_recent_idx');
        });
    },
    'down' => function (Builder $schema): void {
        $schema->dropIfExists('startpro_wiki_reader_sessions');
        $schema->dropIfExists('startpro_wiki_reader_completions');
        $schema->dropIfExists('startpro_wiki_reader_chapters');
        $schema->dropIfExists('startpro_wiki_reader_books');
        $schema->dropIfExists('startpro_wiki_reader_highlights');
    },
];
