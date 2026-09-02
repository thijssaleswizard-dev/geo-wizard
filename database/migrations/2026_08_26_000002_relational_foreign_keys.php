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
        // 1. Add project_id column to tables
        $tables = ['keywords', 'prompts', 'citations', 'recommendations', 'overview_stats', 'agents_analytics'];

        foreach ($tables as $tableName) {
            if (Schema::hasTable($tableName) && !Schema::hasColumn($tableName, 'project_id')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->unsignedBigInteger('project_id')->nullable()->after('id')->index();
                });
            }
        }

        // 2. Data Migration: Populate project_id based on company / company_key match
        $projects = DB::table('projects')->get();
        foreach ($projects as $p) {
            $companyKey = strtolower(trim(str_replace('.nl', '', $p->company)));
            $cleanKey = strtolower(preg_replace('/[^a-z0-9]/', '', $companyKey));

            foreach ($tables as $tableName) {
                if (Schema::hasTable($tableName)) {
                    DB::table($tableName)
                        ->where(function ($q) use ($companyKey, $cleanKey, $p) {
                            $q->where('company_key', $companyKey)
                              ->orWhere('company_key', $cleanKey)
                              ->orWhere('company_key', strtolower($p->company))
                              ->orWhere('company_key', $p->company);
                        })
                        ->update(['project_id' => $p->id]);
                }
            }
        }

        // Clean up any orphan rows that don't belong to any project
        foreach ($tables as $tableName) {
            if (Schema::hasTable($tableName)) {
                DB::table($tableName)->whereNull('project_id')->delete();
            }
        }

        // 3. Add Foreign Key Constraints with ON DELETE CASCADE
        foreach ($tables as $tableName) {
            if (Schema::hasTable($tableName) && Schema::hasColumn($tableName, 'project_id')) {
                try {
                    Schema::table($tableName, function (Blueprint $table) {
                        $table->foreign('project_id')->references('id')->on('projects')->cascadeOnDelete();
                    });
                } catch (\Throwable $e) {
                }
            }
        }

        // 4. Link prompts.keyword_id foreign key constraint if valid
        if (Schema::hasTable('prompts') && Schema::hasColumn('prompts', 'keyword_id')) {
            // Nullify invalid keyword_ids
            $validKeywordIds = DB::table('keywords')->pluck('id')->toArray();
            DB::table('prompts')->whereNotIn('keyword_id', $validKeywordIds)->update(['keyword_id' => null]);

            try {
                Schema::table('prompts', function (Blueprint $table) {
                    $table->foreign('keyword_id')->references('id')->on('keywords')->cascadeOnDelete();
                });
            } catch (\Throwable $e) {
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $tables = ['keywords', 'prompts', 'citations', 'recommendations', 'overview_stats', 'agents_analytics'];

        if (Schema::hasTable('prompts') && Schema::hasColumn('prompts', 'keyword_id')) {
            Schema::table('prompts', function (Blueprint $table) {
                $table->dropForeign(['keyword_id']);
            });
        }

        foreach ($tables as $tableName) {
            if (Schema::hasTable($tableName) && Schema::hasColumn($tableName, 'project_id')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->dropForeign(['project_id']);
                    $table->dropColumn('project_id');
                });
            }
        }
    }
};
