<?php

namespace App\Mail;

use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
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
        $this->plan            = $plan;
        $this->issuanceSummary = $issuanceSummary;
        $this->generatedAt     = $generatedAt;
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
        try {
            $pdf = Pdf::loadView('pdf.distribution-plan-allocated', [
                'plan'            => $this->plan,
                'issuanceSummary' => $this->issuanceSummary,
                'generatedAt'     => $this->generatedAt,
            ])->setPaper('a4', 'portrait');

            $filename = 'issuance-' . $this->plan->week_label . '-' . $this->plan->planned_date . '.pdf';
            // Sanitise filename
            $filename = preg_replace('/[^A-Za-z0-9\-_.]/', '-', $filename);

            return [
                Attachment::fromData(
                    fn () => $pdf->output(),
                    $filename
                )->withMime('application/pdf'),
            ];
        } catch (\Throwable $e) {
            // If PDF generation fails, send email without attachment rather than failing the whole job
            \Log::warning('PDF attachment failed for plan ' . $this->plan->plan_id . ': ' . $e->getMessage());
            return [];
        }
    }
}
