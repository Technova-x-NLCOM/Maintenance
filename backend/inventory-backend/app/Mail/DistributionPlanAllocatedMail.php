<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class DistributionPlanAllocatedMail extends Mailable
{
    use Queueable, SerializesModels;

    public object $plan;
    public array  $issuanceSummary;
    public string $generatedAt;

    public function __construct(object $plan, array $issuanceSummary, string $generatedAt)
    {
        $this->plan           = $plan;
        $this->issuanceSummary = $issuanceSummary;
        $this->generatedAt    = $generatedAt;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Auto-Allocated: ' . $this->plan->week_label . ' — ' . $this->plan->planned_date,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.distribution-plan-allocated',
            with: [
                'plan'            => $this->plan,
                'issuanceSummary' => $this->issuanceSummary,
                'generatedAt'     => $this->generatedAt,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
