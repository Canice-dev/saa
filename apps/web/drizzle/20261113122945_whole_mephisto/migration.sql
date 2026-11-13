CREATE TABLE "business_settings" (
	"business_id" smallint PRIMARY KEY,
	"response_delay_seconds" integer DEFAULT 60 NOT NULL,
	"confidence_threshold" numeric(4,3) DEFAULT '0.800' NOT NULL,
	"automation_enabled" boolean DEFAULT false NOT NULL,
	"fallback_message" text DEFAULT 'I’m checking with the team and will get back to you.' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_settings_confidence_threshold_check" CHECK (((confidence_threshold >= (0)::numeric) AND (confidence_threshold <= (1)::numeric))),
	CONSTRAINT "business_settings_response_delay_seconds_check" CHECK (((response_delay_seconds >= 0) AND (response_delay_seconds <= 3600)))
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" smallint PRIMARY KEY,
	"display_name" text DEFAULT 'Your business' NOT NULL,
	"locale" text DEFAULT 'en-NG' NOT NULL,
	"currency" char(3) DEFAULT 'NGN' NOT NULL,
	"timezone" text DEFAULT 'Africa/Lagos' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_id_check" CHECK ((id = 1))
);
--> statement-breakpoint
CREATE TABLE "channel_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"business_id" smallint DEFAULT 1 NOT NULL,
	"channel" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"provider_phone_number_id" text,
	"display_name" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"capabilities" jsonb DEFAULT '{}' NOT NULL,
	"last_health_check_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_connections_business_id_channel_provider_account_id_key" UNIQUE("business_id","channel","provider_account_id"),
	CONSTRAINT "channel_connections_channel_check" CHECK ((channel = ANY (ARRAY['whatsapp'::text, 'instagram'::text]))),
	CONSTRAINT "channel_connections_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'connected'::text, 'restricted'::text, 'disconnected'::text])))
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"business_id" smallint DEFAULT 1 NOT NULL,
	"channel" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"state" text DEFAULT 'open' NOT NULL,
	"automation_paused" boolean DEFAULT false NOT NULL,
	"response_generation" integer DEFAULT 0 NOT NULL,
	"last_customer_message_at" timestamp with time zone,
	"last_seller_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_business_id_channel_customer_id_key" UNIQUE("business_id","channel","customer_id"),
	CONSTRAINT "conversations_channel_check" CHECK ((channel = ANY (ARRAY['whatsapp'::text, 'instagram'::text]))),
	CONSTRAINT "conversations_state_check" CHECK ((state = ANY (ARRAY['open'::text, 'closed'::text])))
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"business_id" smallint DEFAULT 1 NOT NULL,
	"channel" text NOT NULL,
	"external_user_id" text NOT NULL,
	"phone_number" text,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_business_id_channel_external_user_id_key" UNIQUE("business_id","channel","external_user_id"),
	CONSTRAINT "customers_channel_check" CHECK ((channel = ANY (ARRAY['whatsapp'::text, 'instagram'::text])))
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"conversation_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_message_id" text NOT NULL,
	"sender_role" text NOT NULL,
	"direction" text NOT NULL,
	"message_type" text NOT NULL,
	"body" text,
	"provider_timestamp" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivery_status" text,
	"provider_error_code" integer,
	CONSTRAINT "messages_provider_provider_message_id_key" UNIQUE("provider","provider_message_id"),
	CONSTRAINT "messages_delivery_status_check" CHECK ((delivery_status = ANY (ARRAY['accepted'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'failed'::text]))),
	CONSTRAINT "messages_direction_check" CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text]))),
	CONSTRAINT "messages_sender_role_check" CHECK ((sender_role = ANY (ARRAY['customer'::text, 'seller'::text, 'assistant'::text])))
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"business_id" smallint DEFAULT 1 NOT NULL,
	"event_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"dedupe_key" text NOT NULL CONSTRAINT "outbox_events_dedupe_key_key" UNIQUE,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "outbox_events_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);
--> statement-breakpoint
CREATE TABLE "provider_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"provider" text NOT NULL,
	"event_key" text NOT NULL,
	"event_type" text NOT NULL,
	"provider_account_id" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"event_data" jsonb DEFAULT '{}' NOT NULL,
	CONSTRAINT "provider_events_provider_event_key_key" UNIQUE("provider","event_key")
);
--> statement-breakpoint
CREATE TABLE "schema_migrations" (
	"version" text PRIMARY KEY,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "messages_conversation_timeline_idx" ON "messages" ("conversation_id","received_at" DESC);--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "outbox_events" ("available_at","created_at") WHERE (status = 'pending'::text);--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "channel_connections" ADD CONSTRAINT "channel_connections_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE;