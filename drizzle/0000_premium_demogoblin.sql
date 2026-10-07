CREATE TABLE IF NOT EXISTS `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`method` text NOT NULL,
	`neighborhood` text,
	`address` text,
	`notes` text,
	`items_json` text NOT NULL,
	`burger_count` integer NOT NULL,
	`subtotal` integer NOT NULL,
	`delivery_fee` integer,
	`total` integer,
	`status` text NOT NULL,
	`payment_mode` text,
	`checkout_url` text,
	`invoice_slug` text,
	`transaction_nsu` text,
	`paid_at` text,
	`refund_note` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`capacity` integer DEFAULT 100 NOT NULL,
	`paused` integer DEFAULT false NOT NULL
);
