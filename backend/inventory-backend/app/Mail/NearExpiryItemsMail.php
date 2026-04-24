<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Collection;

class NearExpiryItemsMail extends Mailable
{
    use Queueable, SerializesModels;

    public Collection $items;
    public Collection $expiredItems;
    public int $alertDays;
    public string $generatedAt;

    /**
     * Create a new message instance.
     */
    public function __construct(Collection $items, Collection $expiredItems, int $alertDays, string $generatedAt)
    {
        $this->items = $items;
        $this->expiredItems = $expiredItems;
        $this->alertDays = $alertDays;
        $this->generatedAt = $generatedAt;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Near Expiry Inventory Alert',
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.near-expiry-items',
            with: [
                'items' => $this->items,
                'expiredItems' => $this->expiredItems,
                'alertDays' => $this->alertDays,
                'generatedAt' => $this->generatedAt,
            ],
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
