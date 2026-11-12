<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('keywords') && !Schema::hasColumn('keywords', 'is_archived')) {
            Schema::table('keywords', function (Blueprint $table) {
                $table->boolean('is_archived')->default(false)->after('monthly_searches')->index();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('keywords') && Schema::hasColumn('keywords', 'is_archived')) {
            Schema::table('keywords', function (Blueprint $table) {
                $table->dropColumn('is_archived');
            });
        }
    }
};

