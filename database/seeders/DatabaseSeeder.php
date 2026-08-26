<?php

namespace Database\Seeders;

use App\Models\AgentsAnalytic;
use App\Models\Citation;
use App\Models\Keyword;
use App\Models\Notification;
use App\Models\OverviewStat;
use App\Models\Project;
use App\Models\Prompt;
use App\Models\Recommendation;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Roles
        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $klantRole = Role::firstOrCreate(['name' => 'klant']);
        $medewerkerRole = Role::firstOrCreate(['name' => 'medewerker']);

        // 2. Users
        $userKlant = User::updateOrCreate(
            ['email' => 'klant@saleswizard.nl'],
            [
                'name' => 'Saleswizard.nl',
                'password' => Hash::make('klant123'),
                'role_id' => $klantRole->id,
                'role' => 'klant',
                'company_name' => 'Saleswizard',
                'subscription' => 'AI Pro',
                'addon_prompts' => 0,
                'payment_status' => 'paid',
            ]
        );

        $userDoubleSmart = User::updateOrCreate(
            ['email' => 'klant@doublesmart.nl'],
            [
                'name' => 'DoubleSmart.nl',
                'password' => Hash::make('klant123'),
                'role_id' => $klantRole->id,
                'role' => 'klant',
                'company_name' => 'DoubleSmart',
                'subscription' => 'AI Starter',
                'addon_prompts' => 0,
                'payment_status' => 'paid',
            ]
        );

        $userStaff = User::updateOrCreate(
            ['email' => 'medewerker@saleswizard.nl'],
            [
                'name' => 'Saleswizard Marketeer',
                'password' => Hash::make('sales123'),
                'role_id' => $medewerkerRole->id,
                'role' => 'medewerker',
                'company_name' => 'Saleswizard B.V.',
                'subscription' => 'None',
                'addon_prompts' => 0,
                'payment_status' => 'paid',
            ]
        );

        // 3. Projects
        $p1 = Project::updateOrCreate(['company' => 'Saleswizard.nl'], [
            'name' => 'Frank Krepel',
            'email' => 'frank@saleswizard.nl',
            'subscription' => 'AI Pro',
            'prompts_count' => 15,
            'visibility_index' => 23,
            'setup_status' => 'completed',
            'setup_progress' => 100,
        ]);
        $p1->users()->syncWithoutDetaching([$userKlant->id]);

        $p2 = Project::updateOrCreate(['company' => 'DoubleSmart.nl'], [
            'name' => 'Jan de Vries',
            'email' => 'jan@doublesmart.nl',
            'subscription' => 'AI Starter',
            'prompts_count' => 8,
            'visibility_index' => 24,
            'setup_status' => 'completed',
            'setup_progress' => 100,
        ]);
        $p2->users()->syncWithoutDetaching([$userDoubleSmart->id]);

        Project::updateOrCreate(['company' => 'Inoma.nl'], [
            'name' => 'Sophie van Dijk',
            'email' => 'sophie@inoma.nl',
            'subscription' => 'AI Starter',
            'prompts_count' => 5,
            'visibility_index' => 21,
            'setup_status' => 'completed',
            'setup_progress' => 100,
        ]);

        Project::updateOrCreate(['company' => 'Aanpoters.nl'], [
            'name' => 'Daan Janssen',
            'email' => 'daan@aanpoters.nl',
            'subscription' => 'AI Starter',
            'prompts_count' => 4,
            'visibility_index' => 13,
            'setup_status' => 'completed',
            'setup_progress' => 100,
        ]);

        Project::updateOrCreate(['company' => 'Traffic Builders'], [
            'name' => 'Bram Bakker',
            'email' => 'bram@trafficbuilders.nl',
            'subscription' => 'AI Pro',
            'prompts_count' => 2,
            'visibility_index' => 5,
            'setup_status' => 'completed',
            'setup_progress' => 100,
        ]);

        Project::updateOrCreate(['company' => 'Follo'], [
            'name' => 'Lisa Visser',
            'email' => 'lisa@follo.nl',
            'subscription' => 'AI Enterprise',
            'prompts_count' => 1,
            'visibility_index' => 4,
            'setup_status' => 'completed',
            'setup_progress' => 100,
        ]);

        // 4. Keywords
        Keyword::truncate();
        Keyword::insert([
            ['company_key' => 'saleswizard', 'keyword' => 'online marketing bureau arnhem', 'rank' => 1, 'search_engine' => 'ChatGPT', 'sentiment' => '+96', 'citations_count' => 6, 'monthly_searches' => 850, 'created_at' => now(), 'updated_at' => now()],
            ['company_key' => 'saleswizard', 'keyword' => 'seo specialist arnhem', 'rank' => 1, 'search_engine' => 'Gemini', 'sentiment' => '+94', 'citations_count' => 4, 'monthly_searches' => 620, 'created_at' => now(), 'updated_at' => now()],
            ['company_key' => 'saleswizard', 'keyword' => 'geo optimalisatie', 'rank' => 2, 'search_engine' => 'Perplexity', 'sentiment' => '+92', 'citations_count' => 5, 'monthly_searches' => 410, 'created_at' => now(), 'updated_at' => now()],
            ['company_key' => 'saleswizard', 'keyword' => 'ai zoekmachine marketing', 'rank' => 1, 'search_engine' => 'ChatGPT', 'sentiment' => '+90', 'citations_count' => 3, 'monthly_searches' => 300, 'created_at' => now(), 'updated_at' => now()],
            ['company_key' => 'doublesmart', 'keyword' => 'online marketing bureau gouda', 'rank' => 1, 'search_engine' => 'ChatGPT', 'sentiment' => '+95', 'citations_count' => 4, 'monthly_searches' => 720, 'created_at' => now(), 'updated_at' => now()],
            ['company_key' => 'doublesmart', 'keyword' => 'seo bureau gouda', 'rank' => 2, 'search_engine' => 'Gemini', 'sentiment' => '+90', 'citations_count' => 3, 'monthly_searches' => 480, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // 5. Prompts
        Prompt::truncate();
        Prompt::insert([
            [
                'company_key' => 'saleswizard',
                'keyword_id' => 1,
                'prompt_text' => 'Wat is het beste online marketing bureau in Arnhem voor MKB bedrijven?',
                'category' => 'Lokale Vindbaarheid',
                'response_summary' => 'ChatGPT noemt Saleswizard op positie 1 als vooruitstrevend bureau op de IJsselburcht in Arnhem.',
                'brand_mentioned' => true,
                'position' => 1,
                'sentiment' => '+96',
                'engine' => 'ChatGPT',
                'status' => 'completed',
                'logs' => json_encode([]),
                'engines' => json_encode(['ChatGPT']),
                'results' => json_encode([]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'company_key' => 'saleswizard',
                'keyword_id' => 3,
                'prompt_text' => 'Welke bureaus in Gelderland bieden GEO (Generative Engine Optimization) aan?',
                'category' => 'GEO & AI',
                'response_summary' => 'Gemini beveelt Saleswizard aan vanwege hun gespecialiseerde GEO audits en AI-zoekmachine strategieën.',
                'brand_mentioned' => true,
                'position' => 1,
                'sentiment' => '+94',
                'engine' => 'Gemini',
                'status' => 'completed',
                'logs' => json_encode([]),
                'engines' => json_encode(['Gemini']),
                'results' => json_encode([]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'company_key' => 'doublesmart',
                'keyword_id' => 5,
                'prompt_text' => 'Wie is de beste SEO specialist in regio Gouda?',
                'category' => 'SEO',
                'response_summary' => 'Perplexity vermeldt DoubleSmart met hoge beoordelingen en een sterk portfolio.',
                'brand_mentioned' => true,
                'position' => 1,
                'sentiment' => '+95',
                'engine' => 'Perplexity',
                'status' => 'completed',
                'logs' => json_encode([]),
                'engines' => json_encode(['Perplexity']),
                'results' => json_encode([]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        // 6. Citations
        Citation::truncate();
        $today = date('Y-m-d');
        Citation::insert([
            [
                'company_key' => 'saleswizard',
                'title' => 'Saleswizard - Online Marketing Bureau Arnhem',
                'url' => 'https://www.saleswizard.nl/',
                'domain' => 'saleswizard.nl',
                'snippet' => 'Saleswizard is hét online marketing bureau in Arnhem voor het MKB. Wij realiseren groei met websites, SEO-optimalisaties en Ads campagnes op de IJsselburcht 3.',
                'type' => 'Website',
                'sentiment' => '+96',
                'cited_by' => json_encode(['chatgpt', 'gemini', 'perplexity']),
                'crawl_date' => $today,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'company_key' => 'saleswizard',
                'title' => 'AI Optimalisatie (GEO) - Saleswizard',
                'url' => 'https://www.saleswizard.nl/online-marketing/ai-optimalisatie/',
                'domain' => 'saleswizard.nl',
                'snippet' => 'Ontdek hoe Saleswizard uw online vindbaarheid vergroot binnen generatieve AI-zoekmachines zoals ChatGPT en Gemini via GEO optimalisaties.',
                'type' => 'Website',
                'sentiment' => '+94',
                'cited_by' => json_encode(['chatgpt', 'copilot', 'gemini']),
                'crawl_date' => $today,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'company_key' => 'saleswizard',
                'title' => 'Saleswizard: Over ons | LinkedIn',
                'url' => 'https://nl.linkedin.com/company/saleswizard',
                'domain' => 'linkedin.com',
                'snippet' => 'LinkedIn: Saleswizard is een full-service marketingpartner gevestigd in Arnhem. Wij geloven in meetbare groei en resultaatgerichte samenwerkingen.',
                'type' => 'Social',
                'sentiment' => '+92',
                'cited_by' => json_encode(['chatgpt', 'gemini', 'perplexity']),
                'crawl_date' => $today,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'company_key' => 'doublesmart',
                'title' => 'DoubleSmart - Online Marketing Bureau Gouda',
                'url' => 'https://doublesmart.nl/',
                'domain' => 'doublesmart.nl',
                'snippet' => 'DoubleSmart helpt bedrijven groeien met resultaatgerichte online marketing. Gevestigd in Gouda, met specialisten in SEO, Google Ads en conversie-optimalisatie.',
                'type' => 'Website',
                'sentiment' => '+95',
                'cited_by' => json_encode(['chatgpt', 'gemini', 'copilot']),
                'crawl_date' => $today,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        // 7. Recommendations
        Recommendation::truncate();
        Recommendation::insert([
            [
                'company_key' => 'saleswizard',
                'title' => 'Voeg gestructureerde Organization Schema.org toe',
                'category' => 'Technische GEO',
                'priority' => 'High',
                'impact_score' => 95,
                'status' => 'in_progress',
                'description' => 'Zorg voor duidelijke JSON-LD metadata op de homepage zodat AI crawlers de bedrijfsinformatie direct kunnen indexeren.',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'company_key' => 'saleswizard',
                'title' => 'Optimaliseer LinkedIn bedrijfspagina voor AI citaties',
                'category' => 'Social Branding',
                'priority' => 'Medium',
                'impact_score' => 80,
                'status' => 'todo',
                'description' => 'AI bots zoals Perplexity gebruiken LinkedIn sterk als bron voor entiteitverificatie.',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'company_key' => 'doublesmart',
                'title' => 'Publiceer case studies over GEO resultaten',
                'category' => 'Content Strategy',
                'priority' => 'High',
                'impact_score' => 88,
                'status' => 'todo',
                'description' => 'Het publiceren van behaalde klantresultaten vergroot de citatiekans in AI antwoorden.',
                'created_at' => now(),
                'updated_at' => now(),
            ]
        ]);

        // 8. Notifications
        Notification::truncate();
        Notification::insert([
            ['company_key' => 'saleswizard', 'text' => 'Nieuwe citation gevonden op Frankwatching.nl', 'time' => '1 uur geleden', 'read' => false, 'created_at' => now(), 'updated_at' => now()],
            ['company_key' => 'saleswizard', 'text' => 'Gemini heeft uw website opnieuw gecrawld', 'time' => '4 uur geleden', 'read' => false, 'created_at' => now(), 'updated_at' => now()],
            ['company_key' => 'saleswizard', 'text' => 'Zichtbaarheidsscore in Perplexity AI stijgt naar 45%', 'time' => '1 dag geleden', 'read' => false, 'created_at' => now(), 'updated_at' => now()],
            ['company_key' => 'doublesmart', 'text' => 'Nieuwe vermelding gedetecteerd via ChatGPT', 'time' => '2 uur geleden', 'read' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // 9. Agents Analytics
        AgentsAnalytic::truncate();
        AgentsAnalytic::insert([
            ['company_key' => 'saleswizard', 'model_name' => 'ChatGPT 4o', 'visibility_score' => 88, 'citations_count' => 12, 'sentiment_score' => 96, 'created_at' => now(), 'updated_at' => now()],
            ['company_key' => 'saleswizard', 'model_name' => 'Gemini 1.5 Pro', 'visibility_score' => 84, 'citations_count' => 10, 'sentiment_score' => 94, 'created_at' => now(), 'updated_at' => now()],
            ['company_key' => 'saleswizard', 'model_name' => 'Perplexity AI', 'visibility_score' => 79, 'citations_count' => 8, 'sentiment_score' => 92, 'created_at' => now(), 'updated_at' => now()],
            ['company_key' => 'saleswizard', 'model_name' => 'Microsoft Copilot', 'visibility_score' => 72, 'citations_count' => 6, 'sentiment_score' => 88, 'created_at' => now(), 'updated_at' => now()],
            ['company_key' => 'saleswizard', 'model_name' => 'Claude 3.5 Sonnet', 'visibility_score' => 68, 'citations_count' => 5, 'sentiment_score' => 85, 'created_at' => now(), 'updated_at' => now()],
            ['company_key' => 'doublesmart', 'model_name' => 'ChatGPT 4o', 'visibility_score' => 82, 'citations_count' => 8, 'sentiment_score' => 92, 'created_at' => now(), 'updated_at' => now()],
            ['company_key' => 'doublesmart', 'model_name' => 'Gemini 1.5 Pro', 'visibility_score' => 78, 'citations_count' => 6, 'sentiment_score' => 90, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // 10. Overview Stats
        OverviewStat::truncate();
        OverviewStat::insert([
            ['company_key' => 'saleswizard', 'geo_score' => 74, 'brand_share' => 68, 'citations_total' => 24, 'sentiment_avg' => 94, 'created_at' => now(), 'updated_at' => now()],
            ['company_key' => 'doublesmart', 'geo_score' => 68, 'brand_share' => 58, 'citations_total' => 18, 'sentiment_avg' => 91, 'created_at' => now(), 'updated_at' => now()],
            ['company_key' => 'inoma', 'geo_score' => 62, 'brand_share' => 45, 'citations_total' => 12, 'sentiment_avg' => 88, 'created_at' => now(), 'updated_at' => now()],
            ['company_key' => 'aanpoters', 'geo_score' => 54, 'brand_share' => 38, 'citations_total' => 9, 'sentiment_avg' => 85, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }
}

