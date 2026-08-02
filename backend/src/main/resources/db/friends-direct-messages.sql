-- Supabase SQL Editor에서도 그대로 실행할 수 있는 PlanTalk 친구/1:1 메시지 스키마입니다.
create extension if not exists pgcrypto;

alter table users add column if not exists last_active_at timestamp;

create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  user_one_id uuid not null references users(id) on delete cascade,
  user_two_id uuid not null references users(id) on delete cascade,
  requested_by uuid not null references users(id) on delete cascade,
  status varchar(20) not null default 'PENDING'
    check (status in ('PENDING', 'ACCEPTED', 'REJECTED')),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  constraint uq_friendships_pair unique (user_one_id, user_two_id),
  constraint chk_friendship_order check (user_one_id::text < user_two_id::text),
  constraint chk_friendship_requester check (requested_by in (user_one_id, user_two_id))
);

create index if not exists idx_friendships_user_one on friendships(user_one_id);
create index if not exists idx_friendships_user_two on friendships(user_two_id);

create table if not exists direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references users(id) on delete cascade,
  recipient_id uuid not null references users(id) on delete cascade,
  content text not null,
  created_at timestamp not null default now(),
  read_at timestamp,
  constraint chk_direct_message_users check (sender_id <> recipient_id),
  constraint chk_direct_message_content check (length(btrim(content)) > 0)
);

create index if not exists idx_dm_sender_recipient_created
  on direct_messages(sender_id, recipient_id, created_at desc);
create index if not exists idx_dm_recipient_read
  on direct_messages(recipient_id, read_at);
