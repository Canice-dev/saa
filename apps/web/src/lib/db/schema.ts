import {
  pgTable,
  smallint,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  char,
  boolean,
  jsonb,
  index,
  foreignKey,
  primaryKey,
  unique,
  check,
  vector,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const businesses = pgTable(
  "businesses",
  {
    id: smallint().primaryKey(),
    displayName: text("display_name").default("Your business").notNull(),
    locale: text().default("en-NG").notNull(),
    currency: char({ length: 3 }).default("NGN").notNull(),
    timezone: text().default("Africa/Lagos").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [check("businesses_id_check", sql`(id = 1)`)],
);

export const businessSettings = pgTable(
  "business_settings",
  {
    businessId: smallint("business_id").primaryKey(),
    responseDelaySeconds: integer("response_delay_seconds")
      .default(60)
      .notNull(),
    confidenceThreshold: numeric("confidence_threshold", {
      mode: "number",
      precision: 4,
      scale: 3,
    })
      .default(sql`'0.800'`)
      .notNull(),
    automationEnabled: boolean("automation_enabled").default(false).notNull(),
    fallbackMessage: text("fallback_message")
      .default("I’m checking with the team and will get back to you.")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "business_settings_business_id_fkey",
    }).onDelete("cascade"),
    check(
      "business_settings_confidence_threshold_check",
      sql`((confidence_threshold >= (0)::numeric) AND (confidence_threshold <= (1)::numeric))`,
    ),
    check(
      "business_settings_response_delay_seconds_check",
      sql`((response_delay_seconds >= 0) AND (response_delay_seconds <= 3600))`,
    ),
  ],
);

export const channelConnections = pgTable(
  "channel_connections",
  {
    id: uuid().defaultRandom().primaryKey(),
    businessId: smallint("business_id").default(1).notNull(),
    channel: text().notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    providerPhoneNumberId: text("provider_phone_number_id"),
    displayName: text("display_name"),
    status: text().default("pending").notNull(),
    capabilities: jsonb().default({}).notNull(),
    lastHealthCheckAt: timestamp("last_health_check_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "channel_connections_business_id_fkey",
    }).onDelete("cascade"),
    unique(
      "channel_connections_business_id_channel_provider_account_id_key",
    ).on(table.businessId, table.channel, table.providerAccountId),
    check(
      "channel_connections_channel_check",
      sql`(channel = ANY (ARRAY['whatsapp'::text, 'instagram'::text]))`,
    ),
    check(
      "channel_connections_status_check",
      sql`(status = ANY (ARRAY['pending'::text, 'connected'::text, 'restricted'::text, 'disconnected'::text]))`,
    ),
  ],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid().defaultRandom().primaryKey(),
    businessId: smallint("business_id").default(1).notNull(),
    channel: text().notNull(),
    externalUserId: text("external_user_id").notNull(),
    phoneNumber: text("phone_number"),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "customers_business_id_fkey",
    }).onDelete("cascade"),
    unique("customers_business_id_channel_external_user_id_key").on(
      table.businessId,
      table.channel,
      table.externalUserId,
    ),
    check(
      "customers_channel_check",
      sql`(channel = ANY (ARRAY['whatsapp'::text, 'instagram'::text]))`,
    ),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid().defaultRandom().primaryKey(),
    businessId: smallint("business_id").default(1).notNull(),
    channel: text().notNull(),
    customerId: uuid("customer_id").notNull(),
    state: text().default("open").notNull(),
    automationPaused: boolean("automation_paused").default(false).notNull(),
    responseGeneration: integer("response_generation").default(0).notNull(),
    lastCustomerMessageAt: timestamp("last_customer_message_at", {
      withTimezone: true,
    }),
    lastSellerMessageAt: timestamp("last_seller_message_at", {
      withTimezone: true,
    }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "conversations_business_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.customerId],
      foreignColumns: [customers.id],
      name: "conversations_customer_id_fkey",
    }).onDelete("cascade"),
    unique("conversations_business_id_channel_customer_id_key").on(
      table.businessId,
      table.channel,
      table.customerId,
    ),
    check(
      "conversations_channel_check",
      sql`(channel = ANY (ARRAY['whatsapp'::text, 'instagram'::text]))`,
    ),
    check(
      "conversations_state_check",
      sql`(state = ANY (ARRAY['open'::text, 'closed'::text]))`,
    ),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid().defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id").notNull(),
    provider: text().notNull(),
    providerMessageId: text("provider_message_id").notNull(),
    senderRole: text("sender_role").notNull(),
    direction: text().notNull(),
    messageType: text("message_type").notNull(),
    body: text(),
    providerTimestamp: timestamp("provider_timestamp", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    deliveryStatus: text("delivery_status"),
    providerErrorCode: integer("provider_error_code"),
  },
  (table) => [
    foreignKey({
      columns: [table.conversationId],
      foreignColumns: [conversations.id],
      name: "messages_conversation_id_fkey",
    }).onDelete("cascade"),
    index("messages_conversation_timeline_idx").using(
      "btree",
      table.conversationId.asc().nullsLast(),
      table.receivedAt.desc().nullsFirst(),
    ),
    unique("messages_provider_provider_message_id_key").on(
      table.provider,
      table.providerMessageId,
    ),
    check(
      "messages_delivery_status_check",
      sql`(delivery_status = ANY (ARRAY['accepted'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'failed'::text]))`,
    ),
    check(
      "messages_direction_check",
      sql`(direction = ANY (ARRAY['inbound'::text, 'outbound'::text]))`,
    ),
    check(
      "messages_sender_role_check",
      sql`(sender_role = ANY (ARRAY['customer'::text, 'seller'::text, 'assistant'::text]))`,
    ),
  ],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid().defaultRandom().primaryKey(),
    businessId: smallint("business_id").default(1).notNull(),
    eventType: text("event_type").notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    payload: jsonb().default({}).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    status: text().default("pending").notNull(),
    attempts: integer().default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "outbox_events_business_id_fkey",
    }).onDelete("cascade"),
    index("outbox_pending_idx")
      .using(
        "btree",
        table.availableAt.asc().nullsLast(),
        table.createdAt.asc().nullsLast(),
      )
      .where(sql`(status = 'pending'::text)`),
    unique("outbox_events_dedupe_key_key").on(table.dedupeKey),
    check(
      "outbox_events_status_check",
      sql`(status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text]))`,
    ),
  ],
);

export const providerEvents = pgTable(
  "provider_events",
  {
    id: uuid().defaultRandom().primaryKey(),
    provider: text().notNull(),
    eventKey: text("event_key").notNull(),
    eventType: text("event_type").notNull(),
    providerAccountId: text("provider_account_id"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    eventData: jsonb("event_data").default({}).notNull(),
  },
  (table) => [
    unique("provider_events_provider_event_key_key").on(
      table.provider,
      table.eventKey,
    ),
  ],
);

export const schemaMigrations = pgTable("schema_migrations", {
  version: text().primaryKey(),
  appliedAt: timestamp("applied_at", { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
});

export const products = pgTable(
  "products",
  {
    id: uuid().defaultRandom().primaryKey(),
    businessId: smallint("business_id").default(1).notNull(),
    sku: text().notNull(),
    name: text().notNull(),
    description: text(),
    category: text(),
    price: numeric({ precision: 12, scale: 2, mode: "number" }).notNull(),
    currency: char({ length: 3 }).default("NGN").notNull(),
    stockQuantity: integer("stock_quantity").default(0).notNull(),
    searchTerms: text("search_terms"),
    embedding: vector("embedding", { dimensions: 1024 }),
    embeddingUpdatedAt: timestamp("embedding_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "products_business_id_fkey",
    }).onDelete("cascade"),
    unique("products_business_id_sku_key").on(table.businessId, table.sku),
    index("products_business_name_idx").on(table.businessId, table.name),
    check("products_price_check", sql`(price >= 0)`),
    check("products_stock_quantity_check", sql`(stock_quantity >= 0)`),
  ],
);

export const catalogImports = pgTable(
  "catalog_imports",
  {
    id: uuid().defaultRandom().primaryKey(),
    businessId: smallint("business_id").default(1).notNull(),
    fileName: text("file_name").notNull(),
    status: text().default("uploading").notNull(),
    totalRows: integer("total_rows").default(0).notNull(),
    updateExisting: boolean("update_existing").default(false).notNull(),
    appliedThroughRowNumber: integer("applied_through_row_number").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      columns: [table.businessId],
      foreignColumns: [businesses.id],
      name: "catalog_imports_business_id_fkey",
    }).onDelete("cascade"),
    index("catalog_imports_business_created_idx").on(
      table.businessId,
      table.createdAt,
    ),
    check(
      "catalog_imports_status_check",
      sql`(status = ANY (ARRAY['uploading'::text, 'review'::text, 'imported'::text]))`,
    ),
  ],
);

export const catalogImportRows = pgTable(
  "catalog_import_rows",
  {
    importId: uuid("import_id").notNull(),
    rowNumber: integer("row_number").notNull(),
    sku: text(),
    raw: jsonb().default({}).notNull(),
    normalized: jsonb().default({}).notNull(),
    errors: text().array().default(sql`ARRAY[]::text[]`).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.importId, table.rowNumber] }),
    foreignKey({
      columns: [table.importId],
      foreignColumns: [catalogImports.id],
      name: "catalog_import_rows_import_id_fkey",
    }).onDelete("cascade"),
    index("catalog_import_rows_import_sku_idx").on(table.importId, table.sku),
  ],
);
