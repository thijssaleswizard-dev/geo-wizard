<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('notifications') && !Schema::hasColumn('notifications', 'project_id')) {
            Schema::table('notifications', function (Blueprint $table) {
                $table->unsignedBigInteger('project_id')->nullable()->after('id')->index();
                $table->foreign('project_id')->references('id')->on('projects')->cascadeOnDelete();
            });

            // Map any existing company_key notifications to matching project_id
            $projects = DB::table('projects')->get();
            foreach ($projects as $p) {
                $companyKey = strtolower(trim(str_replace('.nl', '', $p->company)));
                $cleanKey = strtolower(preg_replace('/[^a-z0-9]/', '', $companyKey));

                DB::table('notifications')
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

    public function down(): void
    {
        if (Schema::hasTable('notifications') && Schema::hasColumn('notifications', 'project_id')) {
            Schema::disableForeignKeyConstraints();

            if (DB::getDriverName() === 'sqlite') {
                DB::statement("DROP INDEX IF EXISTS notifications_project_id_index");
            } else {
                try {
                    Schema::table('notifications', function (Blueprint $table) {
                        $table->dropForeign(['project_id']);
                        $table->dropIndex(['project_id']);
                    });
                } catch (\Throwable $e) {
                }
            }

            Schema::table('notifications', function (Blueprint $table) {
                $table->dropColumn('project_id');
            });

            Schema::enableForeignKeyConstraints();
        }
    }
};
