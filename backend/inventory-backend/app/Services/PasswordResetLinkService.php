<?php

namespace App\Services;

use App\Mail\ResetPasswordMail;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class PasswordResetLinkService
{
    public function sendToUser(User $user): string
    {
        return $this->sendToEmail($user->email, $user->first_name ?? $user->username);
    }

    public function sendToEmail(string $email, ?string $recipientName = null): string
    {
        $email = trim($email);
        $recipientName = $recipientName ?: explode('@', $email)[0];

        $token = Str::random(60);
        $hashedToken = hash('sha256', $token);

        DB::table('password_reset_tokens')
            ->where('email', $email)
            ->delete();

        DB::table('password_reset_tokens')->insert([
            'email' => $email,
            'token' => $hashedToken,
            'created_at' => now(),
        ]);

        $frontendUrl = rtrim(config('app.frontend_url', 'http://localhost:4200'), '/');
        $resetUrl = $frontendUrl . '/reset-password?token=' . $token . '&email=' . urlencode($email);

        Mail::mailer('smtp')->to($email)->send(new ResetPasswordMail($email, $resetUrl, $recipientName));

        return $resetUrl;
    }
}