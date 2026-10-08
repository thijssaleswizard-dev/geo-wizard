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
        if (!Schema::hasTable('llm_cost_logs')) {
            Schema::create('llm_cost_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
                $table->foreignId('prompt_id')->nullable()->constrained('prompts')->nullOnDelete();
                $table->string('engine', 50)->index();
                $table->string('model', 100)->index();
                $table->string('operation', 100)->default('prompt_scan');
                $table->unsignedInteger('input_tokens')->default(0);
                $table->unsignedInteger('output_tokens')->default(0);
                $table->unsignedInteger('total_tokens')->default(0);
                $table->decimal('cost_usd', 12, 6)->default(0.000000);
                $table->decimal('cost_eur', 12, 6)->default(0.000000);
                $table->unsignedInteger('latency_ms')->nullable();
                $table->string('status', 30)->default('SUCCESS'); // SUCCESS, ERROR, FALLBACK
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->index(['engine', 'created_at']);
                $table->index(['project_id', 'created_at']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('llm_cost_logs');
    }
};
