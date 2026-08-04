create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_type text not null check (organization_type in ('user', 'investor', 'fa', 'government', 'project', 'platform')),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  display_name text not null,
  organization_type text not null check (organization_type in ('user', 'investor', 'fa', 'government', 'project', 'platform')),
  account_status text not null default 'pending' check (account_status in ('pending', 'active', 'rejected', 'suspended')),
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  roles text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);

create table if not exists public.identity_submissions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  owner_organization_id uuid not null references public.organizations(id) on delete cascade,
  identity_type text not null check (identity_type in ('investor_thesis', 'fa_recommendation', 'government_demand')),
  title text not null,
  summary text not null,
  industry text not null,
  region text not null,
  stage text,
  financing_range text,
  detail jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected', 'archived')),
  current_version integer not null default 1 check (current_version > 0),
  rejection_reason text,
  submitted_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.identity_submission_revisions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.identity_submissions(id) on delete cascade,
  version integer not null check (version > 0),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('draft', 'pending', 'approved', 'rejected', 'archived')),
  rejection_reason text,
  created_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (submission_id, version)
);

create table if not exists public.identity_review_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.identity_submissions(id) on delete cascade,
  revision_id uuid references public.identity_submission_revisions(id) on delete set null,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected', 'archived')),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  resource_type text,
  resource_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_type text not null check (resource_type in ('project', 'organization', 'article')),
  resource_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, resource_type, resource_id)
);

create table if not exists public.recent_views (
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_type text not null check (resource_type in ('project', 'organization', 'article')),
  resource_id text not null,
  viewed_at timestamptz not null default now(),
  primary key (user_id, resource_type, resource_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_organization_id uuid references public.organizations(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists organization_memberships_organization_id_idx on public.organization_memberships (organization_id);
create index if not exists profiles_organization_id_idx on public.profiles (organization_id);
create index if not exists identity_submissions_owner_user_id_idx on public.identity_submissions (owner_user_id);
create index if not exists identity_submissions_owner_organization_id_idx on public.identity_submissions (owner_organization_id);
create index if not exists identity_submissions_status_created_at_idx on public.identity_submissions (status, created_at desc);
create index if not exists identity_submissions_type_status_idx on public.identity_submissions (identity_type, status);
create index if not exists identity_submission_revisions_submission_id_idx on public.identity_submission_revisions (submission_id);
create index if not exists identity_review_events_submission_id_idx on public.identity_review_events (submission_id);
create index if not exists notifications_user_id_created_at_idx on public.notifications (user_id, created_at desc);
create index if not exists favorites_user_id_idx on public.favorites (user_id);
create index if not exists recent_views_user_id_viewed_at_idx on public.recent_views (user_id, viewed_at desc);
create index if not exists audit_logs_resource_idx on public.audit_logs (resource_type, resource_id, occurred_at desc);

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and organization_type = 'platform'
      and account_status = 'active'
  );
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.identity_submissions enable row level security;
alter table public.identity_submission_revisions enable row level security;
alter table public.identity_review_events enable row level security;
alter table public.notifications enable row level security;
alter table public.favorites enable row level security;
alter table public.recent_views enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists organizations_public_read on public.organizations;
create policy organizations_public_read on public.organizations
  for select to anon, authenticated using (verified or (select public.is_platform_admin()));

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_platform_admin()));

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists memberships_self_read on public.organization_memberships;
create policy memberships_self_read on public.organization_memberships
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_platform_admin()));

drop policy if exists identity_submissions_public_read on public.identity_submissions;
create policy identity_submissions_public_read on public.identity_submissions
  for select to anon, authenticated using (status = 'approved' or owner_user_id = (select auth.uid()) or (select public.is_platform_admin()));

drop policy if exists identity_submissions_owner_insert on public.identity_submissions;
create policy identity_submissions_owner_insert on public.identity_submissions
  for insert to authenticated with check (owner_user_id = (select auth.uid()));

drop policy if exists identity_submissions_owner_update on public.identity_submissions;
create policy identity_submissions_owner_update on public.identity_submissions
  for update to authenticated using (owner_user_id = (select auth.uid()) or (select public.is_platform_admin())) with check (owner_user_id = (select auth.uid()) or (select public.is_platform_admin()));

drop policy if exists identity_revisions_owner_read on public.identity_submission_revisions;
create policy identity_revisions_owner_read on public.identity_submission_revisions
  for select to authenticated using (created_by = (select auth.uid()) or (select public.is_platform_admin()));

drop policy if exists identity_review_events_admin_read on public.identity_review_events;
create policy identity_review_events_admin_read on public.identity_review_events
  for select to authenticated using ((select public.is_platform_admin()));

drop policy if exists notifications_self_access on public.notifications;
create policy notifications_self_access on public.notifications
  for all to authenticated using (user_id = (select auth.uid()) or (select public.is_platform_admin())) with check (user_id = (select auth.uid()) or (select public.is_platform_admin()));

drop policy if exists favorites_self_access on public.favorites;
create policy favorites_self_access on public.favorites
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists recent_views_self_access on public.recent_views;
create policy recent_views_self_access on public.recent_views
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read on public.audit_logs
  for select to authenticated using ((select public.is_platform_admin()));
