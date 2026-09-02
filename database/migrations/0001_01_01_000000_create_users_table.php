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
        if (!Schema::hasTable('roles')) {
            Schema::create('roles', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('users')) {
            Schema::create('users', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('email')->unique();
                $table->timestamp('email_verified_at')->nullable();
                $table->string('password');
                $table->foreignId('role_id')->nullable()->constrained('roles')->nullOnDelete();
                $table->string('role')->default('klant');
                $table->string('company_name')->nullable();
                $table->string('subscription')->default('AI Pro');
                $table->integer('addon_prompts')->default(0);
                $table->string('mollie_customer_id')->nullable();
                $table->string('mollie_subscription_id')->nullable();
                $table->string('payment_status')->default('paid');
                $table->rememberToken();
                $table->timestamps();
            });
        } else {
            if (!Schema::hasColumn('users', 'name') && Schema::hasColumn('users', 'username')) {
                Schema::table('users', fn (Blueprint $table) => $table->renameColumn('username', 'name'));
            }
            if (!Schema::hasColumn('users', 'password') && Schema::hasColumn('users', 'password_hash')) {
                Schema::table('users', fn (Blueprint $table) => $table->renameColumn('password_hash', 'password'));
            }
            Schema::table('users', function (Blueprint $table) {
                if (!Schema::hasColumn('users', 'name')) {
                    $table->string('name')->default('');
                }
                if (!Schema::hasColumn('users', 'password')) {
                    $table->string('password')->default('');
                }
                if (!Schema::hasColumn('users', 'email_verified_at')) {
                    $table->timestamp('email_verified_at')->nullable();
                }
                if (!Schema::hasColumn('users', 'role')) {
                    $table->string('role')->default('klant');
                }
                if (!Schema::hasColumn('users', 'company_name')) {
                    $table->string('company_name')->nullable();
                }
                if (!Schema::hasColumn('users', 'subscription')) {
                    $table->string('subscription')->default('AI Pro');
                }
                if (!Schema::hasColumn('users', 'addon_prompts')) {
                    $table->integer('addon_prompts')->default(0);
                }
                if (!Schema::hasColumn('users', 'mollie_customer_id')) {
                    $table->string('mollie_customer_id')->nullable();
                }
                if (!Schema::hasColumn('users', 'mollie_subscription_id')) {
                    $table->string('mollie_subscription_id')->nullable();
                }
                if (!Schema::hasColumn('users', 'payment_status')) {
                    $table->string('payment_status')->default('paid');
                }
                if (!Schema::hasColumn('users', 'remember_token')) {
                    $table->rememberToken();
                }
            });
            if (!Schema::hasColumn('users', 'role_id')) {
                Schema::table('users', function (Blueprint $table) {
                    $table->foreignId('role_id')->nullable()->constrained('roles')->nullOnDelete();
                });
            }
        }

        if (!Schema::hasTable('password_reset_tokens')) {
            Schema::create('password_reset_tokens', function (Blueprint $table) {
                $table->string('email')->primary();
                $table->string('token');
                $table->timestamp('created_at')->nullable();
            });
        }

        if (!Schema::hasTable('sessions')) {
            Schema::create('sessions', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->foreignId('user_id')->nullable()->index();
                $table->string('ip_address', 45)->nullable();
                $table->text('user_agent')->nullable();
                $table->longText('payload');
                $table->integer('last_activity')->index();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
        Schema::dropIfExists('roles');
    }
};
