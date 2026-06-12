alter table public.prayer_requests
add column if not exists prayed_count integer not null default 0;

create index if not exists prayer_requests_public_wall_idx
on public.prayer_requests (public_permission, status, created_at desc);

create index if not exists prayer_requests_prayed_count_idx
on public.prayer_requests (prayed_count, created_at desc);
