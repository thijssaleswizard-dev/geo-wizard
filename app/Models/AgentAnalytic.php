<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AgentAnalytic extends Model
{
    protected $table = 'agents_analytics';

    protected $fillable = [
        'project_id',
        'company_key',
        'model_name',
        'visibility_score',
        'citations_count',
        'sentiment_score',
    ];

    protected $casts = [
        'project_id' => 'integer',
        'visibility_score' => 'integer',
        'citations_count' => 'integer',
        'sentiment_score' => 'integer',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
