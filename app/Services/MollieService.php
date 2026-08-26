<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class MollieService
{
    protected ?string $apiKey;
    protected bool $isMockMode;

    public function __construct()
    {
        $this->apiKey = env('MOLLIE_KEY') ?: env('MOLLIE_API_KEY');
        $this->isMockMode = empty($this->apiKey);
    }

    public function createCustomer(string $email, string $name): array
    {
        if ($this->isMockMode) {
            $mockId = 'cst_mock_' . Str::random(8);
            Log::info("[Mollie Mock] Customer created for {$name} ({$email}) -> ID: {$mockId}");
            return ['id' => $mockId, 'name' => $name, 'email' => $email];
        }

        try {
            $response = Http::withToken($this->apiKey)
                ->post('https://api.mollie.com/v2/customers', [
                    'name' => $name,
                    'email' => $email,
                ]);

            if ($response->successful()) {
                return $response->json();
            }

            Log::error('Mollie createCustomer error: ' . $response->body());
            throw new \Exception('Fout bij het aanmaken van Mollie klant.');
        } catch (\Exception $e) {
            Log::error('Mollie createCustomer exception: ' . $e->getMessage());
            throw $e;
        }
    }

    public function createFirstPayment(array $data): array
    {
        $customerId = $data['customerId'] ?? null;
        $amount = number_format((float) ($data['amount'] ?? 0), 2, '.', '');
        $description = $data['description'] ?? 'Eerste GEO betaling';
        $redirectUrl = $data['redirectUrl'] ?? route('payments.success', [], false);
        $webhookUrl = $data['webhookUrl'] ?? null;
        $userId = $data['userId'] ?? null;

        if ($this->isMockMode) {
            $mockPaymentId = 'tr_mock_' . Str::random(8);
            $simulatedCheckoutUrl = url("/checkout/simulate?payment_id={$mockPaymentId}&customer_id={$customerId}&amount={$amount}&description=" . urlencode($description) . "&userId={$userId}");

            Log::info("[Mollie Mock] First payment created: {$mockPaymentId}");

            return [
                'id' => $mockPaymentId,
                'status' => 'open',
                'amount' => ['currency' => 'EUR', 'value' => $amount],
                'description' => $description,
                '_links' => [
                    'checkout' => [
                        'href' => $simulatedCheckoutUrl,
                    ],
                ],
            ];
        }

        try {
            $payload = [
                'amount' => ['currency' => 'EUR', 'value' => $amount],
                'description' => $description,
                'redirectUrl' => $redirectUrl,
                'customerId' => $customerId,
                'sequenceType' => 'first',
            ];

            if ($webhookUrl) {
                $payload['webhookUrl'] = $webhookUrl;
            }

            $response = Http::withToken($this->apiKey)
                ->post('https://api.mollie.com/v2/payments', $payload);

            if ($response->successful()) {
                return $response->json();
            }

            Log::error('Mollie createFirstPayment error: ' . $response->body());
            throw new \Exception('Fout bij het aanmaken van Mollie betaling.');
        } catch (\Exception $e) {
            Log::error('Mollie createFirstPayment exception: ' . $e->getMessage());
            throw $e;
        }
    }

    public function createSubscription(array $data): array
    {
        $customerId = $data['customerId'] ?? '';
        $amount = number_format((float) ($data['amount'] ?? 0), 2, '.', '');
        $description = $data['description'] ?? 'GEO Maandabonnement';
        $interval = $data['interval'] ?? '1 month';

        if ($this->isMockMode) {
            $mockSubscriptionId = 'sub_mock_' . Str::random(8);
            Log::info("[Mollie Mock] Recurring subscription created for {$customerId}: {$mockSubscriptionId}");
            return [
                'id' => $mockSubscriptionId,
                'customerId' => $customerId,
                'status' => 'active',
                'amount' => ['currency' => 'EUR', 'value' => $amount],
                'interval' => $interval,
                'description' => $description,
            ];
        }

        try {
            $response = Http::withToken($this->apiKey)
                ->post("https://api.mollie.com/v2/customers/{$customerId}/subscriptions", [
                    'amount' => ['currency' => 'EUR', 'value' => $amount],
                    'interval' => $interval,
                    'description' => $description,
                    'webhookUrl' => env('MOLLIE_WEBHOOK_URL'),
                ]);

            if ($response->successful()) {
                return $response->json();
            }

            Log::error('Mollie createSubscription error: ' . $response->body());
            throw new \Exception('Fout bij het aanmaken van Mollie abonnement.');
        } catch (\Exception $e) {
            Log::error('Mollie createSubscription exception: ' . $e->getMessage());
            throw $e;
        }
    }

    public function getPayment(string $paymentId): array
    {
        if ($this->isMockMode) {
            return [
                'id' => $paymentId,
                'status' => 'paid',
                'customerId' => 'cst_mock_placeholder',
            ];
        }

        try {
            $response = Http::withToken($this->apiKey)
                ->get("https://api.mollie.com/v2/payments/{$paymentId}");

            if ($response->successful()) {
                return $response->json();
            }

            Log::error('Mollie getPayment error: ' . $response->body());
            throw new \Exception('Fout bij het ophalen van Mollie betaling.');
        } catch (\Exception $e) {
            Log::error('Mollie getPayment exception: ' . $e->getMessage());
            throw $e;
        }
    }
}
