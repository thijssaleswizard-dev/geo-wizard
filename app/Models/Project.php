<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Project extends Model
{
    protected $fillable = [
        'company',
        'name',
        'email',
        'subscription',
        'prompts_count',
        'visibility_index',
        'setup_status',
        'setup_progress',
    ];

    protected $casts = [
        'prompts_count' => 'integer',
        'visibility_index' => 'integer',
        'setup_progress' => 'integer',
    ];

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_projects', 'project_id', 'user_id')->withTimestamps();
    }

    public function keywords(): HasMany
    {
        return $this->hasMany(Keyword::class);
    }

    public function prompts(): HasMany
    {
        return $this->hasMany(Prompt::class);
    }

    public function citations(): HasMany
    {
        return $this->hasMany(Citation::class);
    }

        public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    public function recommendations(): HasMany
    {
        return $this->hasMany(Recommendation::class);
    }

    public function agentsAnalytics(): HasMany
    {
        return $this->hasMany(AgentAnalytic::class);
    }

    public function overviewStats(): HasOne
    {
        return $this->hasOne(OverviewStat::class);
    }

    public function getCompanyKeyAttribute()
    {
        return strtolower(str_replace(['.nl', '.com', '.org', '.be', ' '], '', $this->company));
    }
}
