<?php

declare(strict_types=1);

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

// Additive migration: beta.5 progress and bookmarks are preserved unchanged.
// Text fields intentionally use TEXT instead of an engine-specific JSON column.
return [
    'up' => function (Builder $schema): void {
        $schema->table('startpro_wiki_reader_progress', function (Blueprint $table): void {
            $table->unsignedInteger('version')->default(1);
            $table->text('position_context')->nullable();
        });
        $schema->table('startpro_wiki_reader_bookmarks', function (Blueprint $table): void {
            $table->text('position_context')->nullable();
            $table->text('note')->nullable();
            $table->timestamp('deleted_at')->nullable()->index();
        });
    },
    'down' => function (Builder $schema): void {
        $schema->table('startpro_wiki_reader_bookmarks', function (Blueprint $table): void {
            $table->dropIndex(['deleted_at']);
            $table->dropColumn(['position_context', 'note', 'deleted_at']);
        });
        $schema->table('startpro_wiki_reader_progress', function (Blueprint $table): void {
            $table->dropColumn(['version', 'position_context']);
        });
    },
];
