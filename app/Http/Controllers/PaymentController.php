<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\User;
use App\Services\InvoiceService;
use App\Services\MollieService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class PaymentController extends Controller
{
    protected MollieService $mollieService;
    protected InvoiceService $invoiceService;

    const PACKAGES = [
        'starter' => ['name' => 'AI/GEO Starter pakket', 'price' => 195.00],
        'pro' => ['name' => 'AI/GEO Pro pakket', 'price' => 350.00],
        'top' => ['name' => 'AI/GEO Top pakket', 'price' => 700.00],
    ];

    public function __construct(MollieService $mollieService, InvoiceService $invoiceService)
    {
        $this->mollieService = $mollieService;
        $this->invoiceService = $invoiceService;
    }

    public function invoices(Request $request): JsonResponse
    {
        $userId = $request->query('userId') ?: $request->header('x-user-id');
        if (!$userId) {
            $userId = auth()->id();
        }

        if (!$userId) {
            return response()->json(['error' => 'Niet geautoriseerd.'], 401);
        }

        $invoices = Invoice::where('user_id', $userId)->orderBy('created_at', 'desc')->get();
        return response()->json(['success' => true, 'invoices' => $invoices]);
    }

    public function download(string $filename)
    {
        $filePath = storage_path("app/public/invoices/{$filename}");
        if (!File::exists($filePath)) {
            return response('Factuur niet gevonden.', 404);
        }
        return response()->file($filePath, ['Content-Type' => 'text/html']);
    }

    public function webhook(Request $request)
    {
        $paymentId = $request->input('id');
        if (!$paymentId) {
            return response('Missing payment ID', 400);
        }

        try {
            $payment = $this->mollieService->getPayment($paymentId);

            if (($payment['status'] ?? '') === 'paid') {
                $customerId = $payment['customerId'] ?? null;
                $user = null;

                if (!empty($customerId)) {
                    $user = User::where('mollie_customer_id', $customerId)->first();
                }

                if (!$user) {
                    return response('OK but user not found', 200);
                }

                if ($user->payment_status === 'paid') {
                    return response('OK', 200);
                }

                $packageKey = strtolower(trim(str_replace(['ai/geo ', ' pakket'], '', $user->subscription)));
                $pack = self::PACKAGES[$packageKey] ?? self::PACKAGES['pro'];

                $user->update(['payment_status' => 'paid']);

                $subscription = $this->mollieService->createSubscription([
                    'customerId' => $user->mollie_customer_id,
                    'amount' => number_format($pack['price'], 2, '.', ''),
                    'description' => "GEO-Wizard - {$pack['name']} Abonnement",
                ]);

                if (!empty($subscription['id'])) {
                    $user->update(['mollie_subscription_id' => $subscription['id']]);
                }

                $this->invoiceService->generateInvoice($user->id, $pack['name'], $pack['price'], true);
            }

            return response('OK', 200);
        } catch (\Exception $e) {
            Log::error('Webhook error: ' . $e->getMessage());
            return response('Internal Server Error', 500);
        }
    }

    public function simulatePayment(Request $request): JsonResponse
    {
        $userId = $request->input('userId');
        $customerId = $request->input('customerId');

        $user = User::find($userId);
        if (!$user) {
            return response()->json(['error' => 'Gebruiker niet gevonden.'], 404);
        }

        $packageKey = strtolower(trim(str_replace(['ai/geo ', ' pakket'], '', $user->subscription)));
        $pack = self::PACKAGES[$packageKey] ?? self::PACKAGES['pro'];

        $user->update([
            'payment_status' => 'paid',
            'mollie_customer_id' => $customerId ?: ($user->mollie_customer_id ?: 'cst_mock_simulated'),
            'mollie_subscription_id' => 'sub_mock_' . rand(100000, 999999),
        ]);

        $this->invoiceService->generateInvoice($user->id, $pack['name'], $pack['price'], true);

        return response()->json([
            'success' => true,
            'message' => 'Betaling en factuur succesvol gesimuleerd.',
        ]);
    }
}

