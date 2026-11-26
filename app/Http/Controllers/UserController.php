<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    protected function resolveCaller(Request $request): ?User
    {
        $user = $request->user();
        if ($user) {
            return $user;
        }

        $userId = $request->query('userId') ?? $request->input('userId');
        if ($userId) {
            return User::find((int) $userId);
        }

        return null;
    }

    protected function authorizeStaff(Request $request): ?JsonResponse
    {
        $caller = $this->resolveCaller($request);
        $role = strtolower(trim((string) (
            $caller?->role
            ?? $request->input('callerRole')
            ?? $request->query('callerRole')
            ?? ($request->isMethod('get') || $request->isMethod('delete') ? ($request->query('role') ?? $request->input('role')) : '')
        )));

        if ($role === 'klant') {
            return response()->json([
                'success' => false,
                'error' => 'Geen toegang. Alleen beheerders en medewerkers kunnen gebruikers beheren.',
            ], 403);
        }

        if ($role !== '' && !in_array($role, ['admin', 'medewerker'], true)) {
            return response()->json([
                'success' => false,
                'error' => 'Geen geldige medewerkersrol voor gebruikersbeheer.',
            ], 403);
        }

        return null;
    }

    protected function formatUser(User $u): array
    {
        $role = strtolower(trim((string) ($u->role ?: 'klant')));
        if (!in_array($role, ['admin', 'medewerker', 'klant'], true)) {
            $role = 'klant';
        }

        $linkedProjects = ($u->projects ?? collect())->map(fn($p) => [
            'id' => (int) $p->id,
            'company' => $p->company,
            'name' => $p->name,
            'subscription' => $p->subscription,
        ])->values()->all();

        return [
            'id' => (int) $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'role' => $role,
            'company_name' => $role === 'klant'
                ? ($linkedProjects[0]['company'] ?? $u->company_name ?? '')
                : 'Saleswizard B.V.',
            'subscription' => $u->subscription ?: 'AI Pro',
            'payment_status' => $u->payment_status ?: 'paid',
            'projects' => $linkedProjects,
            'project_ids' => array_map(fn($p) => $p['id'], $linkedProjects),
            'created_at' => $u->created_at ? $u->created_at->format('d-m-Y H:i') : null,
        ];
    }

    protected function extractProjectIds(Request $request): array
    {
        $raw = $request->input('project_ids', []);
        if (!is_array($raw)) {
            $raw = [];
        }
        if ($request->filled('project_id')) {
            $raw[] = (int) $request->input('project_id');
        }

        $clean = array_values(array_unique(array_filter(array_map('intval', $raw), fn($v) => $v > 0)));
        if (empty($clean)) {
            return [];
        }

        return Project::whereIn('id', $clean)->pluck('id')->map(fn($id) => (int) $id)->values()->all();
    }

    /**
     * List all users (medewerkers, admins & klanten) + all projects for assignment.
     */
    public function index(Request $request): JsonResponse
    {
        if ($deny = $this->authorizeStaff($request)) {
            return $deny;
        }

        // Heal any legacy klant accounts missing pivot links
        User::where('role', 'klant')->orWhereNull('role')->get()->each(function (User $u) {
            $u->getAllowedProjectIds();
        });

        $users = User::with(['projects:id,company,name,subscription'])
            ->orderByRaw("CASE WHEN role = 'admin' THEN 1 WHEN role = 'medewerker' THEN 2 ELSE 3 END")
            ->orderBy('name')
            ->get()
            ->map(fn(User $u) => $this->formatUser($u))
            ->values()
            ->all();

        $projects = Project::orderBy('company')
            ->get(['id', 'company', 'name', 'email', 'subscription'])
            ->map(fn(Project $p) => [
                'id' => (int) $p->id,
                'company' => $p->company,
                'name' => $p->name,
                'email' => $p->email,
                'subscription' => $p->subscription ?: 'AI Pro',
            ])
            ->values()
            ->all();

        return response()->json([
            'success' => true,
            'users' => $users,
            'projects' => $projects,
        ]);
    }

    /**
     * Create a new user (medewerker, admin, or klant linked strictly to selected project(s)).
     */
    public function store(Request $request): JsonResponse
    {
        if ($deny = $this->authorizeStaff($request)) {
            return $deny;
        }

        $name = trim((string) $request->input('name', ''));
        $email = strtolower(trim((string) $request->input('email', '')));
        $password = (string) $request->input('password', '');
        $role = strtolower(trim((string) $request->input('role', 'medewerker')));

        if ($name === '' || $email === '' || $password === '') {
            return response()->json([
                'success' => false,
                'error' => 'Naam, e-mailadres en wachtwoord zijn verplicht.',
            ], 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return response()->json([
                'success' => false,
                'error' => 'Voer een geldig e-mailadres in.',
            ], 400);
        }

        if (strlen($password) < 6) {
            return response()->json([
                'success' => false,
                'error' => 'Het wachtwoord moet uit minimaal 6 tekens bestaan.',
            ], 400);
        }

        if (!in_array($role, ['admin', 'medewerker', 'klant'], true)) {
            return response()->json([
                'success' => false,
                'error' => 'Ongeldige rol. Kies medewerker, admin of klant.',
            ], 400);
        }

        if (User::whereRaw('LOWER(email) = ?', [$email])->exists()) {
            return response()->json([
                'success' => false,
                'error' => 'Dit e-mailadres is al gekoppeld aan een bestaand account.',
            ], 400);
        }

        $projectIds = $this->extractProjectIds($request);
        if ($role === 'klant' && empty($projectIds)) {
            return response()->json([
                'success' => false,
                'error' => 'Selecteer minimaal één project waartoe deze klant toegang krijgt.',
            ], 400);
        }

        $roleModel = Role::firstOrCreate(['name' => $role]);
        $primaryProject = ($role === 'klant' && !empty($projectIds))
            ? Project::find($projectIds[0])
            : null;

        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make($password),
            'role_id' => $roleModel->id,
            'role' => $role,
            'company_name' => $role === 'klant'
                ? ($primaryProject?->company ?? trim((string) $request->input('company_name', '')))
                : 'Saleswizard B.V.',
            'subscription' => $role === 'klant'
                ? ($primaryProject?->subscription ?: 'AI Pro')
                : 'Saleswizard Staff',
            'addon_prompts' => 0,
            'payment_status' => 'paid',
        ]);

        if ($role === 'klant') {
            $user->projects()->sync($projectIds);
        }

        return response()->json([
            'success' => true,
            'message' => $role === 'klant'
                ? "Klantaccount voor {$name} aangemaakt en gekoppeld aan " . count($projectIds) . " project(en)."
                : "Medewerker-account voor {$name} ({$role}) succesvol aangemaakt.",
            'user' => $this->formatUser($user->fresh('projects')),
        ], 201);
    }

    /**
     * Update an existing user (role, assigned project(s), name, email, optional new password).
     */
    public function update(Request $request, int $id): JsonResponse
    {
        if ($deny = $this->authorizeStaff($request)) {
            return $deny;
        }

        $user = User::find($id);
        if (!$user) {
            return response()->json(['success' => false, 'error' => 'Gebruiker niet gevonden.'], 404);
        }

        $name = trim((string) $request->input('name', $user->name));
        $email = strtolower(trim((string) $request->input('email', $user->email)));
        $role = strtolower(trim((string) $request->input('role', $user->role ?: 'klant')));
        $password = (string) $request->input('password', '');

        if ($name === '' || $email === '') {
            return response()->json([
                'success' => false,
                'error' => 'Naam en e-mailadres mogen niet leeg zijn.',
            ], 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return response()->json([
                'success' => false,
                'error' => 'Voer een geldig e-mailadres in.',
            ], 400);
        }

        if (!in_array($role, ['admin', 'medewerker', 'klant'], true)) {
            return response()->json([
                'success' => false,
                'error' => 'Ongeldige rol geselecteerd.',
            ], 400);
        }

        if (User::whereRaw('LOWER(email) = ?', [$email])->where('id', '!=', $user->id)->exists()) {
            return response()->json([
                'success' => false,
                'error' => 'Dit e-mailadres is al in gebruik bij een andere gebruiker.',
            ], 400);
        }

        if ($password !== '' && strlen($password) < 6) {
            return response()->json([
                'success' => false,
                'error' => 'Het nieuwe wachtwoord moet uit minimaal 6 tekens bestaan.',
            ], 400);
        }

        $projectIds = $this->extractProjectIds($request);
        if ($role === 'klant' && empty($projectIds)) {
            return response()->json([
                'success' => false,
                'error' => 'Selecteer minimaal één project waartoe deze klant toegang krijgt.',
            ], 400);
        }

        $roleModel = Role::firstOrCreate(['name' => $role]);
        $primaryProject = ($role === 'klant' && !empty($projectIds))
            ? Project::find($projectIds[0])
            : null;

        $updatePayload = [
            'name' => $name,
            'email' => $email,
            'role_id' => $roleModel->id,
            'role' => $role,
            'company_name' => $role === 'klant'
                ? ($primaryProject?->company ?? $user->company_name)
                : 'Saleswizard B.V.',
            'subscription' => $role === 'klant'
                ? ($primaryProject?->subscription ?: ($user->subscription ?: 'AI Pro'))
                : 'Saleswizard Staff',
            'payment_status' => 'paid',
        ];

        if ($password !== '') {
            $updatePayload['password'] = Hash::make($password);
        }

        $user->update($updatePayload);

        if ($role === 'klant') {
            $user->projects()->sync($projectIds);
        } else {
            $user->projects()->detach();
        }

        return response()->json([
            'success' => true,
            'message' => "Gegevens van {$name} zijn bijgewerkt.",
            'user' => $this->formatUser($user->fresh('projects')),
        ]);
    }

    /**
     * Delete a user account.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        if ($deny = $this->authorizeStaff($request)) {
            return $deny;
        }

        $caller = $this->resolveCaller($request);
        $callerId = (int) ($caller?->id ?? $request->query('userId') ?? $request->input('userId') ?? 0);
        if ($callerId > 0 && $callerId === $id) {
            return response()->json([
                'success' => false,
                'error' => 'U kunt uw eigen momenteel ingelogde account niet verwijderen.',
            ], 400);
        }

        $user = User::find($id);
        if (!$user) {
            return response()->json(['success' => false, 'error' => 'Gebruiker niet gevonden.'], 404);
        }

        $userName = $user->name;
        $user->projects()->detach();
        $user->tokens()->delete();
        $user->delete();

        return response()->json([
            'success' => true,
            'message' => "Gebruiker \"{$userName}\" is definitief verwijderd.",
        ]);
    }
}
