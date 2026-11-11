-- Sats for Skills schema. Paste into the Supabase SQL editor and run.

create table if not exists public.profiles (
  id text primary key,
  name text not null check (char_length(name) between 1 and 60),
  lightning_address text,
  skills text,
  trezor_address text,
  trezor_message text,
  trezor_signature text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id text primary key,
  title text not null check (char_length(title) between 3 and 120),
  description text not null,
  category text not null check (category in ('design', 'translation', 'tutoring', 'writing', 'other')),
  budget_sats integer not null check (budget_sats >= 100),
  deadline date not null,
  contact text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed')),
  poster_id text not null references public.profiles (id),
  poster_name text not null,
  assignee_id text references public.profiles (id),
  assignee_name text,
  invoice text,
  delivery_note text,
  preimage text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  invoiced_at timestamptz,
  completed_at timestamptz
);

create index if not exists tasks_status_idx on public.tasks (status, created_at desc);

-- Realtime: dashboards update when someone accepts, invoices or pays
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.profiles;

-- Hackathon-grade access: anyone with the anon key can read and write.
-- Before real use, add Supabase Auth and restrict updates to the poster/assignee.
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;

create policy "public read profiles" on public.profiles for select using (true);
create policy "public insert profiles" on public.profiles for insert with check (true);
create policy "public update profiles" on public.profiles for update using (true);

create policy "public read tasks" on public.tasks for select using (true);
create policy "public insert tasks" on public.tasks for insert with check (true);
create policy "public update tasks" on public.tasks for update using (true);