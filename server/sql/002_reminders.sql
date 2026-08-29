create table if not exists reminder_preferences (
  user_id bigint primary key references users(id) on delete cascade,
  email_enabled boolean not null default true,
  due_reminders boolean not null default true,
  overdue_reminders boolean not null default true,
  morning_digest boolean not null default true,
  morning_hour smallint not null default 8 check (morning_hour between 0 and 23),
  end_of_day_digest boolean not null default true,
  end_of_day_hour smallint not null default 17 check (end_of_day_hour between 0 and 23),
  due_lead_minutes integer not null default 30 check (due_lead_minutes between 0 and 10080),
  updated_at timestamptz not null default now()
);

create table if not exists reminder_deliveries (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  follow_up_id bigint references follow_ups(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('due','overdue','morning_digest','end_of_day_digest')),
  dedupe_key text not null unique,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists reminder_deliveries_pending_idx on reminder_deliveries(status, scheduled_for);
