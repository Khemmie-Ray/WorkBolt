-- ============================================================================
-- Workbolt database
-- Run the whole file once in the Supabase SQL editor.
-- WARNING: it drops and recreates Workbolt's tables, so existing rows are deleted.
-- ============================================================================

-- ---------- clean slate ----------
drop table if exists public.escrows cascade;
drop table if exists public.tasks cascade;
drop table if exists public.profiles cascade;
drop trigger if exists on_auth_user_created on auth.users;

-- ============================================================================
-- Profiles: one per signed-in user, created automatically on first sign-in
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  lightning_address text check (
    lightning_address is null
    or lightning_address ~* '^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
  ),
  -- Flash username or Flash wallet ID the person gets paid into
  flash_account text check (flash_account is null or char_length(flash_account) between 3 and 60),
  skills text check (skills is null or char_length(skills) <= 300),
  onboarded boolean not null default false,
  -- Written only by the server after it verifies a Trezor signature
  trezor_address text,
  trezor_message text,
  trezor_signature text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'New member'
      ),
      60
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Tasks
-- ============================================================================
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 6 and 90),
  description text not null check (char_length(description) between 20 and 4000),
  category text not null check (category in ('design', 'translation', 'tutoring', 'writing', 'other')),
  budget_sats integer not null check (budget_sats between 100 and 10000000),
  deadline date not null,
  contact text not null check (char_length(contact) between 2 and 120),
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed')),

  poster_id uuid not null references public.profiles (id) on delete cascade,
  poster_name text not null,
  assignee_id uuid references public.profiles (id) on delete set null,
  assignee_name text,

  -- Payment request: a Lightning invoice, or a Flash request (invoice made when the poster pays)
  invoice text,
  invoice_source text check (invoice_source in ('flash')),
  flash_wallet text,
  delivery_note text check (delivery_note is null or char_length(delivery_note) <= 2000),
  preimage text,
  paid_via text check (paid_via in ('flash')),

  -- Commitment bond, written by the server (see app/api/escrow)
  bond_sats integer,
  bond_status text not null default 'none'
    check (bond_status in ('none', 'awaiting', 'locked', 'returned', 'claimed', 'expired')),
  bond_invoice text,

  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  invoiced_at timestamptz,
  completed_at timestamptz,

  -- The person who posts a task can never be the one who does it
  constraint poster_is_not_assignee check (assignee_id is null or assignee_id <> poster_id)
);

create index tasks_board_idx on public.tasks (status, created_at desc);
create index tasks_poster_idx on public.tasks (poster_id);
create index tasks_assignee_idx on public.tasks (assignee_id);

-- Keep names on tasks in step when someone renames themselves
create or replace function public.sync_task_names()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name is distinct from old.name then
    update public.tasks set poster_name = new.name where poster_id = new.id;
    update public.tasks set assignee_name = new.name where assignee_id = new.id;
  end if;
  return new;
end;
$$;

create trigger profiles_sync_names
  after update of name on public.profiles
  for each row execute function public.sync_task_names();

-- ============================================================================
-- Escrow records: hold the preimage that releases each bond. Server only.
-- ============================================================================
create table public.escrows (
  task_id uuid primary key references public.tasks (id) on delete cascade,
  payment_hash text not null unique,
  preimage text not null,
  invoice text not null,
  bond_sats integer not null check (bond_sats > 0),
  budget_sats integer not null check (budget_sats > 0),
  status text not null check (status in ('awaiting', 'locked', 'returned', 'claimed', 'expired')),
  work_invoice text,
  work_invoice_at timestamptz,
  payout_address text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

-- ============================================================================
-- Access: the browser can read the board and edit only its own profile.
-- Every change to a task goes through the functions below.
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.escrows enable row level security;

revoke all on public.profiles, public.tasks, public.escrows from anon, authenticated;
grant select on public.profiles, public.tasks to anon, authenticated;
grant update (name, lightning_address, flash_account, skills, onboarded) on public.profiles to authenticated;

create policy "anyone can read profiles" on public.profiles for select using (true);
create policy "people edit their own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "anyone can read tasks" on public.tasks for select using (true);
-- escrows: RLS on and no policies, so only the server (secret key) can reach it

-- ---------- helpers ----------
create or replace function public.current_member()
returns public.profiles
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Your profile is missing. Sign out and sign in again.' using errcode = 'P0002';
  end if;
  return me;
end;
$$;

create or replace function public.lock_task(p_task uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks;
begin
  select * into t from public.tasks where id = p_task for update;
  if not found then
    raise exception 'This task is not on the board.' using errcode = 'P0002';
  end if;
  return t;
end;
$$;

-- ---------- post a task ----------
create or replace function public.create_task(
  p_title text,
  p_description text,
  p_category text,
  p_budget_sats integer,
  p_deadline date,
  p_contact text,
  p_with_bond boolean default false
)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles := public.current_member();
  t public.tasks;
begin
  -- one day of slack so posters east of UTC can still pick "today"
  if p_deadline < current_date - 1 then
    raise exception 'Pick a deadline from today onwards.' using errcode = '22023';
  end if;
  insert into public.tasks (title, description, category, budget_sats, deadline, contact, poster_id, poster_name, bond_status)
  values (
    btrim(p_title), btrim(p_description), p_category, p_budget_sats, p_deadline, btrim(p_contact),
    me.id, me.name, case when p_with_bond then 'awaiting' else 'none' end
  )
  returning * into t;
  return t;
end;
$$;

-- ---------- accept ----------
create or replace function public.accept_task(p_task uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles := public.current_member();
  t public.tasks := public.lock_task(p_task);
begin
  if t.poster_id = me.id then
    raise exception 'You posted this task, so you can''t accept it.' using errcode = '42501';
  end if;
  if t.status <> 'open' then
    raise exception 'Someone already took this task.' using errcode = '55000';
  end if;
  if t.bond_status not in ('none', 'locked') then
    raise exception 'This task isn''t open for work yet.' using errcode = '55000';
  end if;
  update public.tasks
     set status = 'in_progress', assignee_id = me.id, assignee_name = me.name, accepted_at = now()
   where id = p_task
  returning * into t;
  return t;
end;
$$;

-- ---------- freelancer gives the task back (before asking to be paid) ----------
create or replace function public.release_task(p_task uuid)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles := public.current_member();
  t public.tasks := public.lock_task(p_task);
begin
  if t.assignee_id is distinct from me.id or t.status <> 'in_progress' then
    raise exception 'Only the person doing this task can give it back.' using errcode = '42501';
  end if;
  if t.invoiced_at is not null then
    raise exception 'You already asked to be paid for this task.' using errcode = '55000';
  end if;
  update public.tasks
     set status = 'open', assignee_id = null, assignee_name = null, accepted_at = null
   where id = p_task
  returning * into t;
  return t;
end;
$$;

-- ---------- freelancer asks to be paid: Lightning invoice ----------
create or replace function public.send_invoice(p_task uuid, p_invoice text, p_note text)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles := public.current_member();
  t public.tasks := public.lock_task(p_task);
begin
  if t.assignee_id is distinct from me.id or t.status <> 'in_progress' then
    raise exception 'Only the person doing this task can ask to be paid.' using errcode = '42501';
  end if;
  if p_invoice is null or lower(btrim(p_invoice)) !~ '^ln(bc|tb|tbs|bcrt)[0-9a-z]+$' then
    raise exception 'That is not a Lightning invoice.' using errcode = '22023';
  end if;
  update public.tasks
     set invoice = lower(btrim(p_invoice)), invoice_source = null, flash_wallet = null,
         delivery_note = nullif(btrim(coalesce(p_note, '')), ''), invoiced_at = now()
   where id = p_task
  returning * into t;
  return t;
end;
$$;

-- ---------- freelancer asks to be paid: Flash (invoice made when the poster pays) ----------
create or replace function public.request_flash_payment(p_task uuid, p_note text)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles := public.current_member();
  t public.tasks := public.lock_task(p_task);
begin
  if t.assignee_id is distinct from me.id or t.status <> 'in_progress' then
    raise exception 'Only the person doing this task can ask to be paid.' using errcode = '42501';
  end if;
  if me.flash_account is null then
    raise exception 'Add your Flash username or wallet ID in your profile first.' using errcode = '22023';
  end if;
  update public.tasks
     set invoice = null, invoice_source = 'flash', flash_wallet = me.flash_account,
         delivery_note = nullif(btrim(coalesce(p_note, '')), ''), invoiced_at = now()
   where id = p_task
  returning * into t;
  return t;
end;
$$;

-- ---------- poster marks a Lightning invoice paid (no bond; Flash and bonds close on the server) ----------
create or replace function public.complete_task(p_task uuid, p_preimage text default null)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles := public.current_member();
  t public.tasks := public.lock_task(p_task);
begin
  if t.poster_id <> me.id then
    raise exception 'Only the person who posted this task can mark it paid.' using errcode = '42501';
  end if;
  if t.status <> 'in_progress' or t.invoice is null then
    raise exception 'There is no invoice to pay yet.' using errcode = '55000';
  end if;
  if t.invoice_source = 'flash' then
    raise exception 'Flash confirms this payment by itself.' using errcode = '55000';
  end if;
  if t.bond_status = 'locked' then
    raise exception 'Add the payment proof to release your commitment.' using errcode = '55000';
  end if;
  if p_preimage is not null and p_preimage !~ '^[0-9a-f]{64}$' then
    raise exception 'A payment proof is 64 characters of 0-9 and a-f.' using errcode = '22023';
  end if;
  update public.tasks
     set status = 'completed', preimage = p_preimage, completed_at = now()
   where id = p_task
  returning * into t;
  return t;
end;
$$;

-- ---------- who may call what ----------
revoke execute on function
  public.handle_new_user(), public.sync_task_names(), public.current_member(), public.lock_task(uuid),
  public.create_task(text, text, text, integer, date, text, boolean), public.accept_task(uuid),
  public.release_task(uuid), public.send_invoice(uuid, text, text), public.request_flash_payment(uuid, text),
  public.complete_task(uuid, text)
  from public, anon, authenticated;

grant execute on function
  public.create_task(text, text, text, integer, date, text, boolean), public.accept_task(uuid),
  public.release_task(uuid), public.send_invoice(uuid, text, text), public.request_flash_payment(uuid, text),
  public.complete_task(uuid, text)
  to authenticated;

-- ============================================================================
-- Realtime: screens update when tasks or profiles change
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'tasks') then
    alter publication supabase_realtime add table public.tasks;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;