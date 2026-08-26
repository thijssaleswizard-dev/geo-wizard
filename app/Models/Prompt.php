<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Prompt extends Model
{
    protected $fillable = [
        'project_id',
        'company_key',
        'keyword_id',
        'prompt_text',
        'category',
        'response_summary',
        'brand_mentioned',
        'position',
        'sentiment',
        'engine',
        'status',
        'logs',
        'engines',
        'results',
    ];

    protected $casts = [
        'project_id' => 'integer',
        'brand_mentioned' => 'boolean',
        'position' => 'integer',
        'keyword_id' => 'integer',
        'logs' => 'array',
        'engines' => 'array',
        'results' => 'array',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function keyword(): BelongsTo
    {
        return $this->belongsTo(Keyword::class, 'keyword_id');
    }

    public function citations(): HasMany
    {
        return $this->hasMany(Citation::class);
    }
}
