<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LlmCostLog extends Model
{
    protected $fillable = [
        'project_id',
        'prompt_id',
        'engine',
        'model',
        'operation',
        'input_tokens',
        'output_tokens',
        'total_tokens',
        'cost_usd',
        'cost_eur',
        'latency_ms',
        'status',
        'metadata',
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'project_id' => 'integer',
        'prompt_id' => 'integer',
        'input_tokens' => 'integer',
        'output_tokens' => 'integer',
        'total_tokens' => 'integer',
        'cost_usd' => 'float',
        'cost_eur' => 'float',
        'latency_ms' => 'integer',
        'metadata' => 'array',
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
