create table if not exists leads (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  company_name text not null,
  contact_name text,
  email text,
  phone text,
  source text not null default 'other' check(source in('quote_builder','website','whatsapp','email','referral','social','manual','other')),
  status text not null default 'new' check(status in('new','contacted','interested','won','lost')),
  estimated_value numeric(12,2),
  currency text not null default 'USD',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lead_activities (
  id bigserial primary key,
  lead_id bigint not null references leads(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  activity_type text not null check(activity_type in('note','call','email','whatsapp','meeting','status_change','created')),
  detail text,
  created_at timestamptz not null default now()
);

alter table follow_ups add column if not exists lead_id bigint references leads(id) on delete set null;

create index if not exists leads_user_status_idx on leads(user_id,status,updated_at desc);
create index if not exists lead_activities_lead_idx on lead_activities(lead_id,created_at desc);
create index if not exists follow_ups_lead_idx on follow_ups(lead_id,due_at);
