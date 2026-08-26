<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OverviewStat extends Model
{
    protected $fillable = [
        'project_id',
        'company_key',
        'geo_score',
        'brand_share',
        'citations_total',
        'sentiment_avg',
    ];

    protected $casts = [
        'project_id' => 'integer',
        'geo_score' => 'integer',
        'brand_share' => 'integer',
        'citations_total' => 'integer',
        'sentiment_avg' => 'integer',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
