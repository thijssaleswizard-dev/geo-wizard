<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role_id',
        'role',
        'company_name',
        'subscription',
        'addon_prompts',
        'mollie_customer_id',
        'mollie_subscription_id',
        'payment_status',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'addon_prompts' => 'integer',
        ];
    }

    public function roleModel()
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    public function projects()
    {
        return $this->belongsToMany(Project::class, 'user_projects', 'user_id', 'project_id')->withTimestamps();
    }

    /**
     * Ensure legacy client accounts whose email or company_name matches a Project are linked in user_projects,
     * and return the strict list of Project IDs this client is allowed to view.
     * Returns null for staff/admin (unrestricted).
     */
    public function getAllowedProjectIds(): ?array
    {
        $normalizedRole = strtolower(trim((string) ($this->role ?: 'klant')));
        if (in_array($normalizedRole, ['admin', 'medewerker'], true)) {
            return null;
        }

        $ids = $this->projects()->pluck('projects.id')->map(fn($id) => (int) $id)->values()->all();

        if (empty($ids)) {
            $emailLower = strtolower(trim((string) $this->email));
            $compLower = strtolower(trim((string) $this->company_name));

            $fallbackQuery = Project::query()->where(function ($q) use ($emailLower, $compLower) {
                if ($emailLower !== '') {
                    $q->orWhereRaw('LOWER(email) = ?', [$emailLower]);
                }
                if ($compLower !== '' && !str_contains($compLower, 'saleswizard')) {
                    $cleanKey = \App\Services\AiEngineService::cleanBrandKey($compLower);
                    $q->orWhereRaw('LOWER(company) = ?', [$compLower])
                      ->orWhereRaw('LOWER(company) = ?', ["{$cleanKey}.nl"])
                      ->orWhereRaw('LOWER(company) = ?', [$cleanKey]);
                }
            });

            $matchedIds = $fallbackQuery->pluck('id')->map(fn($id) => (int) $id)->values()->all();
            if (!empty($matchedIds)) {
                $this->projects()->syncWithoutDetaching($matchedIds);
                $ids = $matchedIds;
            }
        }

        return $ids;
    }

    public function invoices()
    {
        return $this->hasMany(Invoice::class);
    }
}
