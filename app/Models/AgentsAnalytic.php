<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AgentsAnalytic extends Model
{
    protected $table = 'agents_analytics';

    protected $fillable = [
        'company_key',
        'model_name',
        'visibility_score',
        'citations_count',
        'sentiment_score',
    ];

    protected $casts = [
        'visibility_score' => 'integer',
        'citations_count' => 'integer',
        'sentiment_score' => 'integer',
    ];
}
