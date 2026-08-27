<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

function dynamicCleanBrand(string $title, string $domain): string {
    $domBase = explode('.', str_replace('www.', '', strtolower($domain)))[0];
    
    // Clean title
    if (!empty($title)) {
        $cleaned = preg_replace('/(www\.[^\s]+|https?:\/\/[^\s]+)/i', '', $title);
        $delimiters = [' | ', ' - ', ' – ', ' — ', ' : ', ' » ', ' › ', ' • '];
        $parts = [$cleaned];
        foreach ($delimiters as $d) {
            $newParts = [];
            foreach ($parts as $p) {
                foreach (explode($d, $p) as $sub) {
                    $sub = trim($sub);
                    if ($sub !== '') $newParts[] = $sub;
                }
            }
            $parts = $newParts;
        }

        $noise = ['home', 'welkom', 'officiële website', 'officiele website', 'contact', 'over ons', 'diensten', 'openingstijden', 'vacatures', 'blog', 'tarieven', 'kosten', 'review', 'reviews', 'vergelijk'];
        
        foreach ($parts as $part) {
            $pLower = strtolower($part);
            $isNoise = false;
            foreach ($noise as $n) {
                if ($pLower === $n || str_starts_with($pLower, $n . ' ')) {
                    $isNoise = true;
                    break;
                }
            }
            if (!$isNoise && strlen($part) >= 2 && strlen($part) <= 45) {
                // If it looks like a brand name (contains part of domain or is capitalized)
                return $part;
            }
        }
    }

    // Fallback: format domain
    $brand = str_replace(['-', '_'], ' ', $domBase);
    return ucwords($brand);
}

echo "Testing Dynamic Brand Formatter:\n";
echo "1. " . dynamicCleanBrand("Orange Juice - Online Marketing Agency Arnhem", "orangejuice.nl") . "\n";
echo "2. " . dynamicCleanBrand("Home | Dakdekkersbedrijf Van der Valk & Zn | Tilburg", "vandervalk-dakbedekking.nl") . "\n";
echo "3. " . dynamicCleanBrand("Tandartspraktijk De Jordaan - Professionele mondzorg in Amsterdam", "tandartsdejordaan.nl") . "\n";
echo "4. " . dynamicCleanBrand("Loodgieter Utrecht Spoed | 24/7 Loodgietersbedrijf De Boer", "loodgieter-deboer.nl") . "\n";
echo "5. " . dynamicCleanBrand("Boekhoudkantoor Zwolle - Jouw administratie geregeld", "zwolle-finance.nl") . "\n";
echo "6. " . dynamicCleanBrand("", "biljoen-groen-liemers.nl") . "\n";
