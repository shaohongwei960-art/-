-- Huanhuan production schema, provider-independent PostgreSQL.
-- The API server is the only client allowed to connect to this database.
-- Never expose DATABASE_URL or database credentials to Vite/browser code.
-- gen_random_uuid() is built into PostgreSQL 13+; no extra extension is needed.
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject text NOT NULL UNIQUE,
  display_name varchar(40) NOT NULL DEFAULT '新用户',
  avatar_key text,
  country_code char(2) NOT NULL DEFAULT 'CN' CHECK (country_code ~ '^[A-Z]{2}$'),
  city varchar(80),
  locale varchar(16) NOT NULL DEFAULT 'zh-CN',
  account_role text NOT NULL DEFAULT 'user' CHECK (account_role IN ('user','moderator','admin')),
  account_status text NOT NULL DEFAULT 'active' CHECK (account_status IN ('active','suspended','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_role text NOT NULL DEFAULT 'user' CHECK (account_role IN ('user','moderator','admin'));

CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title varchar(80) NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 80),
  description varchar(3000) NOT NULL CHECK (length(btrim(description)) BETWEEN 5 AND 3000),
  flaws varchar(500) NOT NULL CHECK (length(btrim(flaws)) BETWEEN 1 AND 500),
  category text NOT NULL CHECK (category IN ('electronics','books_media','home','outdoors','clothing','other')),
  condition text NOT NULL CHECK (condition IN ('like_new','good','visible_wear')),
  desired_items varchar(200) NOT NULL DEFAULT 'Any reasonable offer',
  image_key text NOT NULL,
  country_code char(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  city varchar(80) NOT NULL,
  area varchar(80),
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','available','hidden','reserved','exchanged','rejected')),
  moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending','approved','rejected')),
  reserved_offer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'reserved') = (reserved_offer_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS listings_public_feed_idx ON listings(country_code, city, category, created_at DESC) WHERE status = 'available' AND moderation_status = 'approved';
CREATE INDEX IF NOT EXISTS listings_owner_idx ON listings(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS swap_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  requested_listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  offered_listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  note varchar(500) NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','partial','completed','cancelled','rejected','disputed')),
  requester_confirmed boolean NOT NULL DEFAULT false,
  recipient_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> recipient_id),
  CHECK (requested_listing_id <> offered_listing_id)
);
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_reserved_offer_id_fkey;
ALTER TABLE listings ADD CONSTRAINT listings_reserved_offer_id_fkey FOREIGN KEY (reserved_offer_id) REFERENCES swap_offers(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX IF NOT EXISTS swap_offers_requester_idx ON swap_offers(requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS swap_offers_recipient_idx ON swap_offers(recipient_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS swap_offers_no_duplicate_pending_idx ON swap_offers(requester_id, requested_listing_id, offered_listing_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS favorites (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (owner_id <> guest_id),
  UNIQUE (listing_id, guest_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  body varchar(2000) NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (body !~ '[[:cntrl:]]')
);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  target_type text NOT NULL CHECK (target_type IN ('listing','user','message')),
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 2 AND 80),
  details varchar(1000) NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS reports_queue_idx ON reports(status, created_at);

CREATE TABLE IF NOT EXISTS moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  target_type text NOT NULL CHECK (target_type IN ('listing','report')),
  target_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('approve','reject','resolve','dismiss')),
  reason varchar(1000) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_actions_target_idx ON moderation_actions(target_type,target_id,created_at DESC);

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES swap_offers(id) ON DELETE RESTRICT,
  reviewer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  reviewee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  body varchar(1000) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reviewer_id <> reviewee_id),
  UNIQUE (offer_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS reviews_reviewee_idx ON reviews(reviewee_id, created_at DESC);
