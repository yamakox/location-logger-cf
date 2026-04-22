import { sql } from "drizzle-orm";
import { sqliteTable, int, text, real } from "drizzle-orm/sqlite-core";

export const clients = sqliteTable("clients", {
  id: int("id").primaryKey({ autoIncrement: true }),
  cid: text("cid").notNull().unique(),
  ua: text("ua").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const locations = sqliteTable("locations", {
  id: int("id").primaryKey({ autoIncrement: true }),
  timestamp: int("timestamp").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  distance: real("distance"),
  address: text("address").notNull(),
  clientId: int("client_id").references(() => clients.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
