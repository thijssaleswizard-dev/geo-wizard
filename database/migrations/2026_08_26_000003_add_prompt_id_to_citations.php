<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('citations') && !Schema::hasColumn('citations', 'prompt_id')) {
            Schema::table('citations', function (Blueprint $table) {
                $table->unsignedBigInteger('prompt_id')->nullable()->after('project_id')->index();
                $table->foreign('prompt_id')->references('id')->on('prompts')->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('citations') && Schema::hasColumn('citations', 'prompt_id')) {
            Schema::table('citations', function (Blueprint $table) {
                $table->dropForeign(['prompt_id']);
                $table->dropColumn('prompt_id');
            });
        }
    }
};
