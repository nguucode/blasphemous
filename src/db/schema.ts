import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

// Spec 7.1. RLS is on with no policies: Supabase's Data API (publishable key) sees nothing,
// while the server connects as the table owner and does its own checks (spec 7.5).

export const demos = pgTable(
  "demos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      // restrict, not cascade: deleting an account must not free its slugs (spec 7.3)
      .references(() => authUsers.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    figmaFileKey: text("figma_file_key").notNull(),
    phoneNodeId: text("phone_node_id"),
    tabletNodeId: text("tablet_node_id"),
    desktopNodeId: text("desktop_node_id"),
    responsiveDesktop: boolean("responsive_desktop").notNull().default(false),
    backgroundColor: text("background_color").notNull().default("#1e1b4b"),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check("demos_has_a_device", sql`coalesce(${t.phoneNodeId}, ${t.tabletNodeId}, ${t.desktopNodeId}) is not null`),
    index("demos_owner_idx").on(t.ownerId),
  ],
).enableRLS();

export const slugRedirects = pgTable("slug_redirects", {
  slug: text("slug").primaryKey(),
  demoId: uuid("demo_id")
    .notNull()
    .references(() => demos.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();
