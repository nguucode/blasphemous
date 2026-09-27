CREATE TABLE "demos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"figma_file_key" text NOT NULL,
	"phone_node_id" text,
	"tablet_node_id" text,
	"desktop_node_id" text,
	"responsive_desktop" boolean DEFAULT false NOT NULL,
	"background_color" text DEFAULT '#1e1b4b' NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "demos_slug_unique" UNIQUE("slug"),
	CONSTRAINT "demos_has_a_device" CHECK (coalesce("demos"."phone_node_id", "demos"."tablet_node_id", "demos"."desktop_node_id") is not null)
);
--> statement-breakpoint
ALTER TABLE "demos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "slug_redirects" (
	"slug" text PRIMARY KEY NOT NULL,
	"demo_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "slug_redirects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "demos" ADD CONSTRAINT "demos_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slug_redirects" ADD CONSTRAINT "slug_redirects_demo_id_demos_id_fk" FOREIGN KEY ("demo_id") REFERENCES "public"."demos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "demos_owner_idx" ON "demos" USING btree ("owner_id");