ALTER TABLE "demos" ADD COLUMN "devices" jsonb DEFAULT '{"desktop":{"enabled":false,"model":"1440"},"tablet":{"enabled":false,"model":"ipad-pro-12-9"},"phone":{"enabled":false,"model":"iphone-17-pro-max"}}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "demos" ADD COLUMN "flows" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "demos" ADD COLUMN "brand_color" text DEFAULT '#0071e3' NOT NULL;--> statement-breakpoint
ALTER TABLE "demos" ADD COLUMN "background_image" text;--> statement-breakpoint
ALTER TABLE "demos" ADD COLUMN "logo" text;--> statement-breakpoint
-- Existing Demos: a Device with a node is turned on; Desktop is drawn at 1440 (spec 12).
UPDATE "demos" SET "devices" = jsonb_build_object(
	'desktop', jsonb_build_object('enabled', "desktop_node_id" IS NOT NULL, 'model', '1440'),
	'tablet', jsonb_build_object('enabled', "tablet_node_id" IS NOT NULL, 'model', 'ipad-pro-12-9'),
	'phone', jsonb_build_object('enabled', "phone_node_id" IS NOT NULL, 'model', 'iphone-17-pro-max')
);
