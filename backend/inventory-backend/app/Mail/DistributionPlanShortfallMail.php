<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class DistributionPlanShortfallMail extends Mailable
{
    use Queueable, SerializesModels;

    public object $plan;
    public array  $shortfallItems;
    public string $generatedAt;

    public function __construct(object $plan, array $shortfallItems, string $generatedAt)
    {
        $this->plan           = $plan;
        $this->shortfallItems = $shortfallItems;
        $this->generatedAt    = $generatedAt;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Stock Shortfall: ' . $this->plan->week_label . ' — ' . $this->plan->planned_date . ' — Action Required',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.distribution-plan-shortfall',
            with: [
                'plan'           => $this->plan,
                'shortfallItems' => $this->shortfallItems,
                'generatedAt'    => $this->generatedAt,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
