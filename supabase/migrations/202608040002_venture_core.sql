create extension if not exists pgcrypto;

-- These tables deliberately keep the existing SQLite identifiers as text. The
-- migration can therefore be repeated without inventing a second ID mapping
-- layer, while Supabase Auth IDs remain UUIDs in venture_auth_accounts.
create table if not exists public.venture_migration_runs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  mode text not null check (mode in ('dry-run', 'apply')),
  row_counts jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text
);

create table if not exists public.venture_organizations (
  legacy_id text primary key,
  name text not null,
  organization_type text not null check (organization_type in ('user', 'investor', 'fa', 'government', 'project', 'platform')),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.venture_users (
  legacy_id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.venture_auth_accounts (
  legacy_user_id text primary key references public.venture_users(legacy_id) on delete cascade,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email text,
  phone text,
  supabase_user_id text unique,
  organization_legacy_id text references public.venture_organizations(legacy_id) on delete set null,
  role text not null check (role in ('user', 'investor', 'fa', 'government', 'project', 'platform')),
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected', 'suspended')),
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.venture_memberships (
  legacy_user_id text not null references public.venture_users(legacy_id) on delete cascade,
  organization_legacy_id text not null references public.venture_organizations(legacy_id) on delete cascade,
  roles text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (legacy_user_id, organization_legacy_id)
);

create table if not exists public.venture_organization_profiles (
  organization_legacy_id text primary key references public.venture_organizations(legacy_id) on delete cascade,
  tagline text not null,
  description text not null,
  region text not null,
  focus text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.venture_projects (
  legacy_id text primary key,
  owner_organization_legacy_id text not null references public.venture_organizations(legacy_id) on delete restrict,
  name text not null,
  summary text not null,
  industry text not null,
  region text not null,
  stage text not null,
  financing_range text not null,
  published boolean not null default false,
  review_status text not null default 'approved' check (review_status in ('pending', 'approved', 'rejected')),
  identity_mode text not null default 'named' check (identity_mode in ('named', 'anonymous')),
  anonymous_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.venture_project_fa_delegations (
  project_legacy_id text not null references public.venture_projects(legacy_id) on delete cascade,
  fa_organization_legacy_id text not null references public.venture_organizations(legacy_id) on delete cascade,
  can_manage_bp boolean not null default false,
  primary key (project_legacy_id, fa_organization_legacy_id)
);

create table if not exists public.venture_bp_files (
  legacy_id text primary key,
  project_legacy_id text not null references public.venture_projects(legacy_id) on delete cascade,
  version integer not null check (version > 0),
  file_name text not null,
  storage_key text not null,
  storage_bucket text not null default 'venture-bp',
  created_at timestamptz not null default now(),
  unique (project_legacy_id, version)
);

create table if not exists public.venture_bp_access_requests (
  legacy_id text primary key,
  bp_file_legacy_id text not null references public.venture_bp_files(legacy_id) on delete cascade,
  requester_organization_legacy_id text not null references public.venture_organizations(legacy_id) on delete restrict,
  requester_user_legacy_id text not null references public.venture_users(legacy_id) on delete restrict,
  purpose text not null,
  status text not null check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by_user_legacy_id text references public.venture_users(legacy_id) on delete set null
);

create table if not exists public.venture_bp_grants (
  legacy_id text primary key,
  bp_file_legacy_id text not null references public.venture_bp_files(legacy_id) on delete cascade,
  grantee_organization_legacy_id text not null references public.venture_organizations(legacy_id) on delete restrict,
  expires_at timestamptz not null,
  allow_download boolean not null default false,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by_user_legacy_id text not null references public.venture_users(legacy_id) on delete restrict
);

create table if not exists public.venture_government_contacts (
  legacy_id text primary key,
  organization_legacy_id text not null references public.venture_organizations(legacy_id) on delete restrict,
  organization_name text not null,
  name text not null,
  title text not null,
  region text not null,
  industries text[] not null default '{}',
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.venture_review_tasks (
  legacy_id text primary key,
  task_type text not null,
  subject_legacy_id text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.venture_articles (
  legacy_id text primary key,
  slug text not null unique,
  title text not null,
  summary text not null,
  content text not null,
  category text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.venture_contact_requests (
  legacy_id text primary key,
  requester_user_legacy_id text references public.venture_users(legacy_id) on delete set null,
  contact_legacy_id text references public.venture_government_contacts(legacy_id) on delete set null,
  target_region text,
  name text not null,
  phone text not null,
  organization text not null,
  need text not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'progressing', 'completed', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.venture_contact_request_updates (
  legacy_id text primary key,
  request_legacy_id text not null references public.venture_contact_requests(legacy_id) on delete cascade,
  status text not null check (status in ('new', 'contacted', 'progressing', 'completed', 'closed')),
  note text not null,
  actor_user_legacy_id text not null references public.venture_users(legacy_id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.venture_identity_submissions (
  legacy_id text primary key,
  owner_user_legacy_id text not null references public.venture_users(legacy_id) on delete cascade,
  owner_organization_legacy_id text not null references public.venture_organizations(legacy_id) on delete cascade,
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

create table if not exists public.venture_identity_submission_revisions (
  legacy_id text primary key,
  submission_legacy_id text not null references public.venture_identity_submissions(legacy_id) on delete cascade,
  version integer not null check (version > 0),
  payload jsonb not null default '{}'::jsonb,
  status text not null,
  rejection_reason text,
  created_by_user_legacy_id text not null references public.venture_users(legacy_id) on delete restrict,
  reviewed_by_user_legacy_id text references public.venture_users(legacy_id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (submission_legacy_id, version)
);

create table if not exists public.venture_favorites (
  user_legacy_id text not null references public.venture_users(legacy_id) on delete cascade,
  resource_type text not null check (resource_type in ('project', 'organization', 'article')),
  resource_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_legacy_id, resource_type, resource_id)
);

create table if not exists public.venture_recent_views (
  user_legacy_id text not null references public.venture_users(legacy_id) on delete cascade,
  resource_type text not null check (resource_type in ('project', 'organization', 'article')),
  resource_id text not null,
  viewed_at timestamptz not null default now(),
  primary key (user_legacy_id, resource_type, resource_id)
);

create table if not exists public.venture_notifications (
  legacy_id text primary key,
  user_legacy_id text not null references public.venture_users(legacy_id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  resource_type text,
  resource_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.venture_audit_logs (
  legacy_id text primary key,
  actor_user_legacy_id text not null references public.venture_users(legacy_id) on delete restrict,
  actor_organization_legacy_id text not null references public.venture_organizations(legacy_id) on delete restrict,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists venture_memberships_organization_idx on public.venture_memberships (organization_legacy_id);
create index if not exists venture_auth_accounts_auth_user_idx on public.venture_auth_accounts (auth_user_id);
create index if not exists venture_projects_owner_idx on public.venture_projects (owner_organization_legacy_id);
create index if not exists venture_projects_public_idx on public.venture_projects (published, review_status, updated_at desc);
create index if not exists venture_bp_files_project_idx on public.venture_bp_files (project_legacy_id, version desc);
create index if not exists venture_bp_requests_requester_idx on public.venture_bp_access_requests (requester_organization_legacy_id, created_at desc);
create index if not exists venture_bp_grants_grantee_idx on public.venture_bp_grants (grantee_organization_legacy_id, expires_at);
create index if not exists venture_contacts_organization_idx on public.venture_government_contacts (organization_legacy_id);
create index if not exists venture_contacts_region_idx on public.venture_government_contacts (region);
create index if not exists venture_reviews_status_idx on public.venture_review_tasks (status, created_at desc);
create index if not exists venture_articles_status_idx on public.venture_articles (status, published_at desc);
create index if not exists venture_contact_requests_status_idx on public.venture_contact_requests (status, created_at desc);
create index if not exists venture_contact_updates_request_idx on public.venture_contact_request_updates (request_legacy_id, created_at desc);
create index if not exists venture_identity_owner_idx on public.venture_identity_submissions (owner_organization_legacy_id, owner_user_legacy_id);
create index if not exists venture_identity_status_idx on public.venture_identity_submissions (status, identity_type, created_at desc);
create index if not exists venture_identity_revisions_submission_idx on public.venture_identity_submission_revisions (submission_legacy_id, version desc);
create index if not exists venture_notifications_user_idx on public.venture_notifications (user_legacy_id, created_at desc);
create index if not exists venture_audit_resource_idx on public.venture_audit_logs (resource_type, resource_id, occurred_at desc);

create or replace function public.venture_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.venture_auth_accounts a
    where a.auth_user_id = (select auth.uid())
      and a.role = 'platform'
      and a.status = 'active'
  );
$$;

create or replace function public.venture_legacy_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select a.legacy_user_id
  from public.venture_auth_accounts a
  where a.auth_user_id = (select auth.uid())
  limit 1;
$$;

alter table public.venture_organizations enable row level security;
alter table public.venture_users enable row level security;
alter table public.venture_auth_accounts enable row level security;
alter table public.venture_memberships enable row level security;
alter table public.venture_organization_profiles enable row level security;
alter table public.venture_projects enable row level security;
alter table public.venture_project_fa_delegations enable row level security;
alter table public.venture_bp_files enable row level security;
alter table public.venture_bp_access_requests enable row level security;
alter table public.venture_bp_grants enable row level security;
alter table public.venture_government_contacts enable row level security;
alter table public.venture_review_tasks enable row level security;
alter table public.venture_articles enable row level security;
alter table public.venture_contact_requests enable row level security;
alter table public.venture_contact_request_updates enable row level security;
alter table public.venture_identity_submissions enable row level security;
alter table public.venture_identity_submission_revisions enable row level security;
alter table public.venture_favorites enable row level security;
alter table public.venture_recent_views enable row level security;
alter table public.venture_notifications enable row level security;
alter table public.venture_audit_logs enable row level security;

drop policy if exists venture_organizations_public_read on public.venture_organizations;
create policy venture_organizations_public_read on public.venture_organizations
  for select to anon, authenticated
  using (verified or (select public.venture_is_platform_admin()));

drop policy if exists venture_profiles_public_read on public.venture_organization_profiles;
create policy venture_profiles_public_read on public.venture_organization_profiles
  for select to anon, authenticated
  using (exists (select 1 from public.venture_organizations o where o.legacy_id = organization_legacy_id and (o.verified or (select public.venture_is_platform_admin()))));

drop policy if exists venture_users_self_read on public.venture_users;
create policy venture_users_self_read on public.venture_users
  for select to authenticated
  using (legacy_id = (select public.venture_legacy_user_id()) or (select public.venture_is_platform_admin()));

drop policy if exists venture_auth_self_read on public.venture_auth_accounts;
create policy venture_auth_self_read on public.venture_auth_accounts
  for select to authenticated
  using (legacy_user_id = (select public.venture_legacy_user_id()) or (select public.venture_is_platform_admin()));

drop policy if exists venture_memberships_self_read on public.venture_memberships;
create policy venture_memberships_self_read on public.venture_memberships
  for select to authenticated
  using (legacy_user_id = (select public.venture_legacy_user_id()) or (select public.venture_is_platform_admin()));

drop policy if exists venture_projects_public_read on public.venture_projects;
create policy venture_projects_public_read on public.venture_projects
  for select to anon, authenticated
  using (published and review_status = 'approved' or (select public.venture_is_platform_admin()));

drop policy if exists venture_articles_public_read on public.venture_articles;
create policy venture_articles_public_read on public.venture_articles
  for select to anon, authenticated
  using (status = 'published' or (select public.venture_is_platform_admin()));

drop policy if exists venture_contacts_public_read on public.venture_government_contacts;
create policy venture_contacts_public_read on public.venture_government_contacts
  for select to anon, authenticated
  using (verified or (select public.venture_is_platform_admin()));

drop policy if exists venture_identity_public_read on public.venture_identity_submissions;
create policy venture_identity_public_read on public.venture_identity_submissions
  for select to anon, authenticated
  using (status = 'approved' or owner_user_legacy_id = (select public.venture_legacy_user_id()) or (select public.venture_is_platform_admin()));

drop policy if exists venture_identity_owner_write on public.venture_identity_submissions;
create policy venture_identity_owner_write on public.venture_identity_submissions
  for all to authenticated
  using (owner_user_legacy_id = (select public.venture_legacy_user_id()) or (select public.venture_is_platform_admin()))
  with check (owner_user_legacy_id = (select public.venture_legacy_user_id()) or (select public.venture_is_platform_admin()));

drop policy if exists venture_favorites_self_access on public.venture_favorites;
create policy venture_favorites_self_access on public.venture_favorites
  for all to authenticated
  using (user_legacy_id = (select public.venture_legacy_user_id()))
  with check (user_legacy_id = (select public.venture_legacy_user_id()));

drop policy if exists venture_recent_views_self_access on public.venture_recent_views;
create policy venture_recent_views_self_access on public.venture_recent_views
  for all to authenticated
  using (user_legacy_id = (select public.venture_legacy_user_id()))
  with check (user_legacy_id = (select public.venture_legacy_user_id()));

drop policy if exists venture_notifications_self_access on public.venture_notifications;
create policy venture_notifications_self_access on public.venture_notifications
  for all to authenticated
  using (user_legacy_id = (select public.venture_legacy_user_id()) or (select public.venture_is_platform_admin()))
  with check (user_legacy_id = (select public.venture_legacy_user_id()) or (select public.venture_is_platform_admin()));

drop policy if exists venture_audit_admin_read on public.venture_audit_logs;
create policy venture_audit_admin_read on public.venture_audit_logs
  for select to authenticated
  using ((select public.venture_is_platform_admin()));
