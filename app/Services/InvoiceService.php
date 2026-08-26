<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class InvoiceService
{
    public function generateInvoice(int $userId, string $packageName, float $packagePrice, bool $isFirstInvoice = true): array
    {
        $user = User::findOrFail($userId);
        $companyName = $user->company_name ?: 'Uw Bedrijf';
        $email = $user->email;

        $setupCosts = $isFirstInvoice ? 750.00 : 0.00;
        $subtotal = $packagePrice + $setupCosts;
        $vat = $subtotal * 0.21;
        $total = $subtotal + $vat;

        $year = date('Y');
        $count = Invoice::count() + 1;
        $invoiceNumber = sprintf("SW-%s-%04d", $year, $count);

        $invoiceDir = storage_path('app/public/invoices');
        if (!File::exists($invoiceDir)) {
            File::makeDirectory($invoiceDir, 0755, true);
        }

        $data = [
            'invoiceNumber' => $invoiceNumber,
            'companyName' => $companyName,
            'userName' => $user->name,
            'email' => $email,
            'packageName' => $packageName,
            'packagePrice' => $packagePrice,
            'isFirstInvoice' => $isFirstInvoice,
            'setupCosts' => $setupCosts,
            'subtotal' => $subtotal,
            'vat' => $vat,
            'total' => $total,
            'date' => date('d-m-Y'),
        ];

        // Generate HTML Invoice
        $htmlContent = view('invoices.template', $data)->render();
        $fileName = "{$invoiceNumber}.html";
        File::put("{$invoiceDir}/{$fileName}", $htmlContent);

        // Save to Database
        $invoice = Invoice::create([
            'user_id' => $userId,
            'invoice_number' => $invoiceNumber,
            'amount' => $subtotal,
            'vat_amount' => $vat,
            'total_amount' => $total,
            'status' => 'paid',
            'package_name' => $packageName,
            'html_path' => "/storage/invoices/{$fileName}",
        ]);

        Log::info("[Invoice Service] Invoice {$invoiceNumber} created for user {$userId}.");

        return [
            'id' => $invoice->id,
            'invoiceNumber' => $invoiceNumber,
            'totalAmount' => $total,
            'htmlPath' => $invoice->html_path,
        ];
    }
}
