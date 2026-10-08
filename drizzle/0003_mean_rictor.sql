CREATE TABLE `product_images` (
	`id` text PRIMARY KEY NOT NULL,
	`mime_type` text NOT NULL,
	`base64_data` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `products` ADD `stock` integer;