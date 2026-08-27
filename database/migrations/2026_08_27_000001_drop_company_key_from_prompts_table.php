<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('prompts') && Schema::hasColumn('prompts', 'company_key')) {
            if (DB::getDriverName() === 'sqlite') {
                DB::statement("DROP INDEX IF EXISTS prompts_company_key_index");
            } else {
                try {
                    Schema::table('prompts', function (Blueprint $table) {
                        $table->dropIndex(['company_key']);
                    });
                } catch (\Throwable $e) {
                    // index may not exist
                }
            }

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
