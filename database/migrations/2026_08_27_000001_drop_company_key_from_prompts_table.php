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
        if (Schema::hasTable('prompts') && Schema::hasColumn('prompts', 'company_key')) {
            Schema::table('prompts', function (Blueprint $table) {
                $table->dropColumn('company_key');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('prompts') && !Schema::hasColumn('prompts', 'company_key')) {
            Schema::table('prompts', function (Blueprint $table) {
                $table->string('company_key')->nullable()->index()->after('project_id');
            });
        }
    }
};
