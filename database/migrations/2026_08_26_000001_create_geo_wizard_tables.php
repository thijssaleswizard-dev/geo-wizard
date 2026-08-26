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
        // 1. Projects table (formerly clients)
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->string('company')->unique();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('subscription')->default('AI Pro');
            $table->integer('prompts_count')->default(0);
            $table->integer('visibility_index')->default(0);
            $table->string('setup_status')->default('completed');
            $table->integer('setup_progress')->default(100);
            $table->timestamps();
        });

        // 2. User Projects junction table
        Schema::create('user_projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
        });

        // 3. Keywords table
        Schema::create('keywords', function (Blueprint $table) {
            $table->id();
            $table->string('company_key')->index();
            $table->string('keyword');
            $table->integer('rank')->nullable();
            $table->string('search_engine')->nullable()->default('ChatGPT');
            $table->string('sentiment')->nullable()->default('N/A');
            $table->integer('citations_count')->default(0);
            $table->integer('monthly_searches')->default(100);
            $table->longText('competitors_json')->nullable();
            $table->longText('brands_mentioned')->nullable();
            $table->timestamps();
        });

        // 4. Prompts table
        Schema::create('prompts', function (Blueprint $table) {
            $table->id();
            $table->string('company_key')->index();
            $table->unsignedBigInteger('keyword_id')->nullable()->index();
            $table->text('prompt_text');
            $table->string('category')->default('Algemeen');
            $table->text('response_summary')->nullable();
            $table->boolean('brand_mentioned')->default(false);
            $table->integer('position')->nullable();
            $table->string('sentiment')->nullable()->default('N/A');
            $table->string('engine')->nullable()->default('ChatGPT');
            $table->string('status')->default('pending');
            $table->longText('logs')->nullable();
            $table->longText('engines')->nullable();
            $table->longText('results')->nullable();
            $table->timestamps();
        });

        // 5. Citations table
        Schema::create('citations', function (Blueprint $table) {
            $table->id();
            $table->string('company_key')->index();
            $table->string('title');
            $table->string('url', 1000);
            $table->string('domain');
            $table->text('snippet')->nullable();
            $table->string('type')->default('Website');
            $table->string('sentiment')->nullable()->default('+90');
            $table->text('cited_by')->nullable(); // JSON string
            $table->string('crawl_date')->nullable();
            $table->timestamps();
        });

        // 6. Recommendations table
        Schema::create('recommendations', function (Blueprint $table) {
            $table->id();
            $table->string('company_key')->index();
            $table->string('title');
            $table->string('category')->default('SEO & GEO');
            $table->string('priority')->default('High');
            $table->integer('impact_score')->default(80);
            $table->string('status')->default('todo');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        // 7. Notifications table
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->string('company_key')->default('all')->index();
            $table->string('text');
            $table->string('time')->nullable();
            $table->boolean('read')->default(false);
            $table->timestamps();
        });

        // 8. Agents Analytics table
        Schema::create('agents_analytics', function (Blueprint $table) {
            $table->id();
            $table->string('company_key')->index();
            $table->string('model_name');
            $table->integer('visibility_score')->default(70);
            $table->integer('citations_count')->default(5);
            $table->integer('sentiment_score')->default(90);
            $table->timestamps();
        });

        // 9. Overview Stats table
        Schema::create('overview_stats', function (Blueprint $table) {
            $table->id();
            $table->string('company_key')->unique();
            $table->integer('geo_score')->default(74);
            $table->integer('brand_share')->default(68);
            $table->integer('citations_total')->default(24);
            $table->integer('sentiment_avg')->default(92);
            $table->timestamps();
        });

        // 10. Invoices table
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('invoice_number')->unique();
            $table->decimal('amount', 10, 2);
            $table->decimal('vat_amount', 10, 2);
            $table->decimal('total_amount', 10, 2);
            $table->string('status')->default('paid');
            $table->string('package_name');
            $table->string('html_path')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('overview_stats');
        Schema::dropIfExists('agents_analytics');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('recommendations');
        Schema::dropIfExists('citations');
        Schema::dropIfExists('prompts');
        Schema::dropIfExists('keywords');
        Schema::dropIfExists('user_projects');
        Schema::dropIfExists('projects');
    }
};
