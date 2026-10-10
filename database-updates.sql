alter table prayer_requests
add column if not exists prayed_count integer not null default 0;

create index if not exists prayer_requests_public_wall_idx
on prayer_requests (public_permission, status, created_at desc);

create index if not exists prayer_requests_prayed_count_idx
on prayer_requests (prayed_count, created_at desc);

create table if not exists events (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 title varchar(140) not null,
 summary varchar(240),
 description varchar(5000) not null,
 location varchar(240),
 start_at timestamptz not null,
 end_at timestamptz,
 registration_url varchar(500),
 featured boolean not null default false,
 status text not null default 'draft' check (status in ('draft','published')),
 check (end_at is null or end_at >= start_at)
);

create index if not exists events_public_upcoming_idx
on events (status, start_at);
