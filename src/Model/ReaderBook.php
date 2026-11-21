<?php

declare(strict_types=1);

namespace StartPro\WikiReader\Model;

use Flarum\Database\AbstractModel;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ReaderBook extends AbstractModel
{
    protected $table = 'startpro_wiki_reader_books';
    protected $fillable = ['title', 'description'];

    public function chapters(): HasMany
    {
        return $this->hasMany(ReaderBookChapter::class, 'book_id');
    }
}
