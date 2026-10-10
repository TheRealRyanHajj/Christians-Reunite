CREATE TABLE IF NOT EXISTS prayer_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 name VARCHAR(120), phone VARCHAR(40), wants_contact BOOLEAN NOT NULL DEFAULT false,
 category TEXT NOT NULL DEFAULT 'Other', public_permission BOOLEAN NOT NULL DEFAULT false,
 prayer_request VARCHAR(4000) NOT NULL, urgent BOOLEAN NOT NULL DEFAULT false,
 prayed_count INTEGER NOT NULL DEFAULT 0 CHECK (prayed_count >= 0),
 status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','prayed','archived'))
);
CREATE INDEX IF NOT EXISTS prayer_requests_public_wall_idx ON prayer_requests(public_permission,status,created_at DESC);
CREATE INDEX IF NOT EXISTS prayer_requests_prayed_count_idx ON prayer_requests(prayed_count,created_at DESC);
CREATE TABLE IF NOT EXISTS admin_users (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_sessions (
 token_hash TEXT PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_expires_at_idx ON admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 title VARCHAR(140) NOT NULL,
 summary VARCHAR(240),
 description VARCHAR(5000) NOT NULL,
 location VARCHAR(240),
 start_at TIMESTAMPTZ NOT NULL,
 end_at TIMESTAMPTZ,
 registration_url VARCHAR(500),
 featured BOOLEAN NOT NULL DEFAULT false,
 status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
 CHECK (end_at IS NULL OR end_at >= start_at)
);
CREATE INDEX IF NOT EXISTS events_public_upcoming_idx ON events(status,start_at);
