<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('citations')) {
            if (!Schema::hasColumn('citations', 'prompt_id')) {
                $isBigInt = true;
                try {
                    $colType = Schema::getColumnType('prompts', 'id');
                    $isBigInt = str_contains(strtolower($colType), 'bigint');
                } catch (\Throwable $e) {
                }

                Schema::table('citations', function (Blueprint $table) use ($isBigInt) {
                    if ($isBigInt) {
                        $table->unsignedBigInteger('prompt_id')->nullable()->after('project_id')->index();
                    } else {
                        $table->unsignedInteger('prompt_id')->nullable()->after('project_id')->index();
                    }
                });
            }

            try {
                Schema::table('citations', function (Blueprint $table) {
                    $table->foreign('prompt_id')->references('id')->on('prompts')->cascadeOnDelete();
                });
            } catch (\Throwable $e) {
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('citations') && Schema::hasColumn('citations', 'prompt_id')) {
            try {
                Schema::table('citations', function (Blueprint $table) {
                    $table->dropForeign(['prompt_id']);
                });
            } catch (\Throwable $e) {
            }

            Schema::table('citations', function (Blueprint $table) {
                $table->dropColumn('prompt_id');
            });
        }
    }
};
