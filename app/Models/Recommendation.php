<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Recommendation extends Model
{
    protected $fillable = [
        'project_id',
        'company_key',
        'title',
        'category',
        'priority',
        'impact_score',
        'status',
        'description',
    ];

    protected $casts = [
        'project_id' => 'integer',
        'impact_score' => 'integer',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
