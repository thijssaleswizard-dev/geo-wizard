<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Keyword extends Model
{
    protected $fillable = [
        'project_id',
        'company_key',
        'keyword',
        'rank',
        'search_engine',
        'sentiment',
        'citations_count',
        'monthly_searches',
        'competitors_json',
        'brands_mentioned',
    ];

    protected $casts = [
        'project_id' => 'integer',
        'rank' => 'integer',
        'citations_count' => 'integer',
        'monthly_searches' => 'integer',
        'competitors_json' => 'array',
        'brands_mentioned' => 'array',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function prompts(): HasMany
    {
        return $this->hasMany(Prompt::class, 'keyword_id');
    }
}
