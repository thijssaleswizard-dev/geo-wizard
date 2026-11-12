<?php

namespace App\Providers;

use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('keywords') && !\Illuminate\Support\Facades\Schema::hasColumn('keywords', 'is_archived')) {
                \Illuminate\Support\Facades\Schema::table('keywords', function (\Illuminate\Database\Schema\Blueprint $table) {
                    $table->boolean('is_archived')->default(false)->index();
                });
            }
        } catch (\Throwable $e) {
            // Safe fallback if database is not migrated yet or offline
        }
    }
}
