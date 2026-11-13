-- One database belongs to one business installation.
CREATE TABLE IF NOT EXISTS businesses (
  id smallint PRIMARY KEY CHECK (id = 1),
  display_name text NOT NULL DEFAULT 'Your business',
  locale text NOT NULL DEFAULT 'en-NG',
  currency char(3) NOT NULL DEFAULT 'NGN',
  timezone text NOT NULL DEFAULT 'Africa/Lagos',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO businesses (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS business_settings (
  business_id smallint PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  response_delay_seconds integer NOT NULL DEFAULT 60 CHECK (response_delay_seconds BETWEEN 0 AND 3600),
  confidence_threshold numeric(4, 3) NOT NULL DEFAULT 0.800 CHECK (confidence_threshold BETWEEN 0 AND 1),
  automation_enabled boolean NOT NULL DEFAULT false,
  fallback_message text NOT NULL DEFAULT 'I’m checking with the team and will get back to you.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO business_settings (business_id) VALUES (1) ON CONFLICT (business_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS channel_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id smallint NOT NULL DEFAULT 1 REFERENCES businesses(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'instagram')),
  provider_account_id text NOT NULL,
  provider_phone_number_id text,
  display_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'restricted', 'disconnected')),
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_health_check_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, channel, provider_account_id)
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id smallint NOT NULL DEFAULT 1 REFERENCES businesses(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'instagram')),
  external_user_id text NOT NULL,
  phone_number text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, channel, external_user_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id smallint NOT NULL DEFAULT 1 REFERENCES businesses(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'instagram')),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'closed')),
  automation_paused boolean NOT NULL DEFAULT false,
  response_generation integer NOT NULL DEFAULT 0,
  last_customer_message_at timestamptz,
  last_seller_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, channel, customer_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_message_id text NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('customer', 'seller', 'assistant')),
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type text NOT NULL,
  body text,
  provider_timestamp timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  delivery_status text CHECK (delivery_status IN ('accepted', 'sent', 'delivered', 'read', 'failed')),
  provider_error_code integer,
  UNIQUE (provider, provider_message_id)
);

CREATE INDEX IF NOT EXISTS messages_conversation_timeline_idx
  ON messages (conversation_id, received_at DESC);

CREATE TABLE IF NOT EXISTS provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_key text NOT NULL,
  event_type text NOT NULL,
  provider_account_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, event_key)
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id smallint NOT NULL DEFAULT 1 REFERENCES businesses(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  available_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS outbox_pending_idx
  ON outbox_events (available_at, created_at)
  WHERE status = 'pending';
