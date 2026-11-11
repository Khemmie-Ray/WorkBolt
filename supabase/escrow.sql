-- Workbolt escrow migration. Run once in the Supabase SQL editor, after schema.sql.

-- Bond state shown on the board (safe to be public)
alter table public.tasks
  add column if not exists bond_sats integer,
  add column if not exists bond_status text
    check (bond_status in ('none', 'awaiting', 'locked', 'returned', 'claimed', 'expired')),
  add column if not exists bond_invoice text;

-- Escrow records hold the preimage that releases each bond.
-- RLS is on with NO policies, so the browser (publishable key) can't read or write it.
-- Only the server reaches it, with SUPABASE_SECRET_KEY.
create table if not exists public.escrows (
  task_id text primary key references public.tasks (id) on delete cascade,
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

alter table public.escrows enable row level security;