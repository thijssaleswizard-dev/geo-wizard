<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\User;
use App\Services\MollieService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthApiController extends Controller
{
    protected MollieService $mollieService;

    const PACKAGES = [
        'starter' => ['name' => 'AI/GEO Starter pakket', 'price' => 195.00, 'totalFirst' => 945.00],
        'pro' => ['name' => 'AI/GEO Pro pakket', 'price' => 350.00, 'totalFirst' => 1100.00],
        'top' => ['name' => 'AI/GEO Top pakket', 'price' => 700.00, 'totalFirst' => 1450.00],
    ];

    public function __construct(MollieService $mollieService)
    {
        $this->mollieService = $mollieService;
    }

    public function login(Request $request): JsonResponse
    {
        $email = strtolower(trim($request->input('email', '')));
        $password = $request->input('password', '');

        if (empty($email) || empty($password)) {
            return response()->json(['error' => 'Vul alstublieft alle velden in.'], 400);
        }

        $user = User::where('email', $email)->first();
        if (!$user) {
            return response()->json(['error' => 'Ongeldige e-mail of wachtwoord. Probeer het opnieuw.'], 401);
        }

        if (!Hash::check($password, $user->password) && $user->password !== $password) {
            return response()->json(['error' => 'Ongeldige e-mail of wachtwoord. Probeer het opnieuw.'], 401);
        }

        if ($user->role === 'klant' && $user->payment_status !== 'paid') {
            $packageKey = strtolower(trim(str_replace(['ai/geo ', ' pakket'], '', $user->subscription)));
            $pack = self::PACKAGES[$packageKey] ?? self::PACKAGES['pro'];

            $firstPayment = $this->mollieService->createFirstPayment([
                'customerId' => $user->mollie_customer_id,
                'amount' => number_format($pack['totalFirst'], 2, '.', ''),
                'description' => "Eerste betaling + Opstartkosten: {$pack['name']}",
                'userId' => $user->id,
            ]);

            return response()->json([
                'success' => false,
                'needs_payment' => true,
                'checkoutUrl' => $firstPayment['_links']['checkout']['href'] ?? '',
                'userId' => $user->id,
                'customerId' => $user->mollie_customer_id,
                'error' => 'Betaling is nog niet afgerond. U wordt omgeleid naar de betaalpagina.',
            ], 402);
        }

        $companyName = $user->company_name ?: 'Saleswizard B.V.';
        if ($user->role === 'klant') {
            $firstProject = $user->projects()->first();
            if ($firstProject) {
                $companyName = $firstProject->company;
            }
        }

        $avatar = !empty($companyName) ? strtoupper($companyName[0]) : 'U';

        // Create Sanctum Token
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'role' => $user->role ?: 'klant',
                'name' => $user->name,
                'company' => $user->role === 'klant' ? $companyName : 'Saleswizard B.V.',
                'email' => $user->email,
                'subscription' => $user->subscription ?: 'AI Pro',
                'addonPrompts' => $user->addon_prompts ?: 0,
                'avatar' => $avatar,
            ],
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $username = trim($request->input('username', ''));
        $email = strtolower(trim($request->input('email', '')));
        $password = $request->input('password', '');
        $companyName = trim($request->input('companyName', ''));
        $subscriptionKey = strtolower(trim($request->input('subscriptionKey', '')));

        if (empty($username) || empty($email) || empty($password) || empty($companyName) || empty($subscriptionKey)) {
            return response()->json(['error' => 'Vul alstublieft alle verplichte velden in.'], 400);
        }

        $pack = self::PACKAGES[$subscriptionKey] ?? null;
        if (!$pack) {
            return response()->json(['error' => 'Ongeldig pakket geselecteerd.'], 400);
        }

        if (User::where('email', $email)->exists()) {
            return response()->json(['error' => 'Dit e-mailadres is al in gebruik.'], 400);
        }

        $klantRole = Role::firstOrCreate(['name' => 'klant']);
        $mollieCustomer = $this->mollieService->createCustomer($email, $username);

        $user = User::create([
            'name' => $username,
            'email' => $email,
            'password' => Hash::make($password),
            'role_id' => $klantRole->id,
            'role' => 'klant',
            'company_name' => $companyName,
            'subscription' => $pack['name'],
            'addon_prompts' => 0,
            'payment_status' => 'pending',
            'mollie_customer_id' => $mollieCustomer['id'] ?? null,
        ]);

        $firstPayment = $this->mollieService->createFirstPayment([
            'customerId' => $mollieCustomer['id'] ?? '',
            'amount' => number_format($pack['totalFirst'], 2, '.', ''),
            'description' => "Eerste betaling + Opstartkosten: {$pack['name']}",
            'userId' => $user->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Registratie succesvol. Rond de betaling af om uw account te activeren.',
            'userId' => $user->id,
            'customerId' => $mollieCustomer['id'] ?? '',
            'checkoutUrl' => $firstPayment['_links']['checkout']['href'] ?? '',
        ], 201);
    }
}
