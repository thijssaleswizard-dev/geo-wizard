<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Citation extends Model
{
    protected $fillable = [
        'project_id',
        'prompt_id',
        'company_key',
        'title',
        'url',
        'domain',
        'snippet',
        'type',
        'sentiment',
        'cited_by',
        'crawl_date',
    ];

    protected $casts = [
        'project_id' => 'integer',
        'prompt_id' => 'integer',
        'cited_by' => 'array',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function prompt(): BelongsTo
    {
        return $this->belongsTo(Prompt::class);
    }
}
