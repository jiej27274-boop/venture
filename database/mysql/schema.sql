-- Venture Platform MySQL schema.
-- Create the database once before running this file, for example:
--   CREATE DATABASE venture CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Then run this file against that database.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS venture_migration_runs (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  source_name TEXT NOT NULL,
  mode VARCHAR(16) NOT NULL,
  row_counts JSON NOT NULL,
  started_at DATETIME(3) NOT NULL,
  finished_at DATETIME(3) NULL,
  error TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_organizations (
  legacy_id VARCHAR(191) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  organization_type VARCHAR(32) NOT NULL,
  verified TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY venture_organizations_type_idx (organization_type),
  KEY venture_organizations_verified_idx (verified)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_users (
  legacy_id VARCHAR(191) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY venture_users_name_idx (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_auth_accounts (
  legacy_user_id VARCHAR(191) NOT NULL PRIMARY KEY,
  username VARCHAR(191) NULL UNIQUE,
  email VARCHAR(191) NULL UNIQUE,
  phone VARCHAR(32) NULL UNIQUE,
  password_hash TEXT NOT NULL,
  organization_legacy_id VARCHAR(191) NULL,
  role VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  email_verified_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT venture_auth_accounts_user_fk FOREIGN KEY (legacy_user_id) REFERENCES venture_users (legacy_id) ON DELETE CASCADE,
  CONSTRAINT venture_auth_accounts_org_fk FOREIGN KEY (organization_legacy_id) REFERENCES venture_organizations (legacy_id) ON DELETE SET NULL,
  KEY venture_auth_accounts_status_idx (status),
  KEY venture_auth_accounts_org_idx (organization_legacy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_memberships (
  legacy_user_id VARCHAR(191) NOT NULL,
  organization_legacy_id VARCHAR(191) NOT NULL,
  roles JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (legacy_user_id, organization_legacy_id),
  CONSTRAINT venture_memberships_user_fk FOREIGN KEY (legacy_user_id) REFERENCES venture_users (legacy_id) ON DELETE CASCADE,
  CONSTRAINT venture_memberships_org_fk FOREIGN KEY (organization_legacy_id) REFERENCES venture_organizations (legacy_id) ON DELETE CASCADE,
  KEY venture_memberships_org_idx (organization_legacy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_organization_profiles (
  organization_legacy_id VARCHAR(191) NOT NULL PRIMARY KEY,
  tagline VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  region VARCHAR(120) NOT NULL,
  focus JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT venture_org_profiles_org_fk FOREIGN KEY (organization_legacy_id) REFERENCES venture_organizations (legacy_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_projects (
  legacy_id VARCHAR(191) NOT NULL PRIMARY KEY,
  owner_organization_legacy_id VARCHAR(191) NOT NULL,
  name VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  industry VARCHAR(120) NOT NULL,
  region VARCHAR(120) NOT NULL,
  stage VARCHAR(80) NOT NULL,
  financing_range VARCHAR(120) NOT NULL,
  published TINYINT(1) NOT NULL DEFAULT 0,
  review_status VARCHAR(32) NOT NULL DEFAULT 'approved',
  identity_mode VARCHAR(32) NOT NULL DEFAULT 'named',
  anonymous_name VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT venture_projects_org_fk FOREIGN KEY (owner_organization_legacy_id) REFERENCES venture_organizations (legacy_id) ON DELETE RESTRICT,
  KEY venture_projects_owner_idx (owner_organization_legacy_id),
  KEY venture_projects_public_idx (published, review_status),
  KEY venture_projects_created_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_project_fa_delegations (
  project_legacy_id VARCHAR(191) NOT NULL,
  fa_organization_legacy_id VARCHAR(191) NOT NULL,
  can_manage_bp TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (project_legacy_id, fa_organization_legacy_id),
  CONSTRAINT venture_delegations_project_fk FOREIGN KEY (project_legacy_id) REFERENCES venture_projects (legacy_id) ON DELETE CASCADE,
  CONSTRAINT venture_delegations_org_fk FOREIGN KEY (fa_organization_legacy_id) REFERENCES venture_organizations (legacy_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_bp_files (
  legacy_id VARCHAR(191) NOT NULL PRIMARY KEY,
  project_legacy_id VARCHAR(191) NOT NULL,
  version INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY venture_bp_files_project_version_uq (project_legacy_id, version),
  KEY venture_bp_files_project_idx (project_legacy_id, version),
  CONSTRAINT venture_bp_files_project_fk FOREIGN KEY (project_legacy_id) REFERENCES venture_projects (legacy_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_bp_access_requests (
  legacy_id VARCHAR(191) NOT NULL PRIMARY KEY,
  bp_file_legacy_id VARCHAR(191) NOT NULL,
  requester_organization_legacy_id VARCHAR(191) NOT NULL,
  requester_user_legacy_id VARCHAR(191) NOT NULL,
  purpose TEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  decided_at DATETIME(3) NULL,
  decided_by_user_legacy_id VARCHAR(191) NULL,
  CONSTRAINT venture_bp_requests_file_fk FOREIGN KEY (bp_file_legacy_id) REFERENCES venture_bp_files (legacy_id) ON DELETE CASCADE,
  CONSTRAINT venture_bp_requests_org_fk FOREIGN KEY (requester_organization_legacy_id) REFERENCES venture_organizations (legacy_id) ON DELETE RESTRICT,
  CONSTRAINT venture_bp_requests_user_fk FOREIGN KEY (requester_user_legacy_id) REFERENCES venture_users (legacy_id) ON DELETE RESTRICT,
  CONSTRAINT venture_bp_requests_decider_fk FOREIGN KEY (decided_by_user_legacy_id) REFERENCES venture_users (legacy_id) ON DELETE SET NULL,
  KEY venture_bp_requests_requester_idx (requester_organization_legacy_id, created_at),
  KEY venture_bp_requests_status_idx (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_bp_grants (
  legacy_id VARCHAR(191) NOT NULL PRIMARY KEY,
  bp_file_legacy_id VARCHAR(191) NOT NULL,
  grantee_organization_legacy_id VARCHAR(191) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  allow_download TINYINT(1) NOT NULL DEFAULT 0,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  created_by_user_legacy_id VARCHAR(191) NOT NULL,
  CONSTRAINT venture_bp_grants_file_fk FOREIGN KEY (bp_file_legacy_id) REFERENCES venture_bp_files (legacy_id) ON DELETE CASCADE,
  CONSTRAINT venture_bp_grants_org_fk FOREIGN KEY (grantee_organization_legacy_id) REFERENCES venture_organizations (legacy_id) ON DELETE RESTRICT,
  CONSTRAINT venture_bp_grants_user_fk FOREIGN KEY (created_by_user_legacy_id) REFERENCES venture_users (legacy_id) ON DELETE RESTRICT,
  KEY venture_bp_grants_grantee_idx (grantee_organization_legacy_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_government_contacts (
  legacy_id VARCHAR(191) NOT NULL PRIMARY KEY,
  organization_legacy_id VARCHAR(191) NOT NULL,
  organization_name VARCHAR(255) NOT NULL,
  name VARCHAR(120) NOT NULL,
  title VARCHAR(160) NOT NULL,
  region VARCHAR(120) NOT NULL,
  industries JSON NOT NULL,
  verified TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT venture_contacts_org_fk FOREIGN KEY (organization_legacy_id) REFERENCES venture_organizations (legacy_id) ON DELETE RESTRICT,
  KEY venture_contacts_region_idx (region),
  KEY venture_contacts_org_idx (organization_legacy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_review_tasks (
  legacy_id VARCHAR(191) NOT NULL PRIMARY KEY,
  task_type VARCHAR(80) NOT NULL,
  subject_legacy_id VARCHAR(191) NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY venture_reviews_status_idx (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_articles (
  legacy_id VARCHAR(191) NOT NULL PRIMARY KEY,
  slug VARCHAR(191) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  content LONGTEXT NOT NULL,
  category VARCHAR(80) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  published_at DATETIME(3) NULL,
  KEY venture_articles_status_idx (status, published_at),
  KEY venture_articles_updated_idx (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_contact_requests (
  legacy_id VARCHAR(191) NOT NULL PRIMARY KEY,
  requester_user_legacy_id VARCHAR(191) NULL,
  contact_legacy_id VARCHAR(191) NULL,
  target_region VARCHAR(120) NULL,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  organization VARCHAR(255) NOT NULL,
  need TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'new',
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT venture_contact_requests_user_fk FOREIGN KEY (requester_user_legacy_id) REFERENCES venture_users (legacy_id) ON DELETE SET NULL,
  CONSTRAINT venture_contact_requests_contact_fk FOREIGN KEY (contact_legacy_id) REFERENCES venture_government_contacts (legacy_id) ON DELETE SET NULL,
  KEY venture_contact_requests_status_idx (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_contact_request_updates (
  legacy_id VARCHAR(191) NOT NULL PRIMARY KEY,
  request_legacy_id VARCHAR(191) NOT NULL,
  status VARCHAR(32) NOT NULL,
  note TEXT NOT NULL,
  actor_user_legacy_id VARCHAR(191) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT venture_contact_updates_request_fk FOREIGN KEY (request_legacy_id) REFERENCES venture_contact_requests (legacy_id) ON DELETE CASCADE,
  CONSTRAINT venture_contact_updates_actor_fk FOREIGN KEY (actor_user_legacy_id) REFERENCES venture_users (legacy_id) ON DELETE RESTRICT,
  KEY venture_contact_updates_request_idx (request_legacy_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_identity_submissions (
  legacy_id VARCHAR(191) NOT NULL PRIMARY KEY,
  owner_user_legacy_id VARCHAR(191) NOT NULL,
  owner_organization_legacy_id VARCHAR(191) NOT NULL,
  identity_type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  industry VARCHAR(120) NOT NULL,
  region VARCHAR(120) NOT NULL,
  stage VARCHAR(80) NULL,
  financing_range VARCHAR(120) NULL,
  detail JSON NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  current_version INT NOT NULL DEFAULT 1,
  rejection_reason TEXT NULL,
  submitted_at DATETIME(3) NULL,
  published_at DATETIME(3) NULL,
  archived_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  CONSTRAINT venture_identity_owner_user_fk FOREIGN KEY (owner_user_legacy_id) REFERENCES venture_users (legacy_id) ON DELETE CASCADE,
  CONSTRAINT venture_identity_owner_org_fk FOREIGN KEY (owner_organization_legacy_id) REFERENCES venture_organizations (legacy_id) ON DELETE CASCADE,
  KEY venture_identity_owner_idx (owner_organization_legacy_id, owner_user_legacy_id),
  KEY venture_identity_status_idx (status, identity_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_identity_submission_revisions (
  legacy_id VARCHAR(191) NOT NULL PRIMARY KEY,
  submission_legacy_id VARCHAR(191) NOT NULL,
  version INT NOT NULL,
  payload JSON NOT NULL,
  status VARCHAR(32) NOT NULL,
  rejection_reason TEXT NULL,
  created_by_user_legacy_id VARCHAR(191) NOT NULL,
  reviewed_by_user_legacy_id VARCHAR(191) NULL,
  created_at DATETIME(3) NOT NULL,
  reviewed_at DATETIME(3) NULL,
  UNIQUE KEY venture_identity_revision_version_uq (submission_legacy_id, version),
  CONSTRAINT venture_identity_revision_submission_fk FOREIGN KEY (submission_legacy_id) REFERENCES venture_identity_submissions (legacy_id) ON DELETE CASCADE,
  CONSTRAINT venture_identity_revision_creator_fk FOREIGN KEY (created_by_user_legacy_id) REFERENCES venture_users (legacy_id) ON DELETE RESTRICT,
  CONSTRAINT venture_identity_revision_reviewer_fk FOREIGN KEY (reviewed_by_user_legacy_id) REFERENCES venture_users (legacy_id) ON DELETE SET NULL,
  KEY venture_identity_revisions_submission_idx (submission_legacy_id, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_favorites (
  user_legacy_id VARCHAR(191) NOT NULL,
  resource_type VARCHAR(32) NOT NULL,
  resource_id VARCHAR(191) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (user_legacy_id, resource_type, resource_id),
  CONSTRAINT venture_favorites_user_fk FOREIGN KEY (user_legacy_id) REFERENCES venture_users (legacy_id) ON DELETE CASCADE,
  KEY venture_favorites_user_idx (user_legacy_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_recent_views (
  user_legacy_id VARCHAR(191) NOT NULL,
  resource_type VARCHAR(32) NOT NULL,
  resource_id VARCHAR(191) NOT NULL,
  viewed_at DATETIME(3) NOT NULL,
  PRIMARY KEY (user_legacy_id, resource_type, resource_id),
  CONSTRAINT venture_recent_views_user_fk FOREIGN KEY (user_legacy_id) REFERENCES venture_users (legacy_id) ON DELETE CASCADE,
  KEY venture_recent_views_user_idx (user_legacy_id, viewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_notifications (
  legacy_id VARCHAR(191) NOT NULL PRIMARY KEY,
  user_legacy_id VARCHAR(191) NOT NULL,
  notification_type VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  resource_type VARCHAR(80) NULL,
  resource_id VARCHAR(191) NULL,
  read_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT venture_notifications_user_fk FOREIGN KEY (user_legacy_id) REFERENCES venture_users (legacy_id) ON DELETE CASCADE,
  KEY venture_notifications_user_idx (user_legacy_id, created_at),
  KEY venture_notifications_unread_idx (user_legacy_id, read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_audit_logs (
  legacy_id VARCHAR(191) NOT NULL PRIMARY KEY,
  actor_user_legacy_id VARCHAR(191) NOT NULL,
  actor_organization_legacy_id VARCHAR(191) NOT NULL,
  action VARCHAR(120) NOT NULL,
  resource_type VARCHAR(80) NOT NULL,
  resource_id VARCHAR(191) NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  metadata JSON NOT NULL,
  CONSTRAINT venture_audit_actor_user_fk FOREIGN KEY (actor_user_legacy_id) REFERENCES venture_users (legacy_id) ON DELETE RESTRICT,
  CONSTRAINT venture_audit_actor_org_fk FOREIGN KEY (actor_organization_legacy_id) REFERENCES venture_organizations (legacy_id) ON DELETE RESTRICT,
  KEY venture_audit_resource_idx (resource_type, resource_id, occurred_at),
  KEY venture_audit_occurred_idx (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_auth_tokens (
  legacy_id VARCHAR(191) NOT NULL PRIMARY KEY,
  user_legacy_id VARCHAR(191) NOT NULL,
  purpose VARCHAR(32) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME(3) NOT NULL,
  consumed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT venture_auth_tokens_user_fk FOREIGN KEY (user_legacy_id) REFERENCES venture_users (legacy_id) ON DELETE CASCADE,
  KEY venture_auth_tokens_user_idx (user_legacy_id, purpose, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_auth_sessions (
  legacy_id VARCHAR(191) NOT NULL PRIMARY KEY,
  token_hash CHAR(64) NOT NULL UNIQUE,
  user_legacy_id VARCHAR(191) NOT NULL,
  organization_legacy_id VARCHAR(191) NOT NULL,
  session_type VARCHAR(16) NOT NULL DEFAULT 'public',
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT venture_auth_sessions_user_fk FOREIGN KEY (user_legacy_id) REFERENCES venture_users (legacy_id) ON DELETE CASCADE,
  CONSTRAINT venture_auth_sessions_org_fk FOREIGN KEY (organization_legacy_id) REFERENCES venture_organizations (legacy_id) ON DELETE CASCADE,
  KEY venture_auth_sessions_user_idx (user_legacy_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venture_email_otps (
  legacy_id VARCHAR(191) NOT NULL PRIMARY KEY,
  email VARCHAR(191) NOT NULL,
  purpose VARCHAR(32) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  verification_proof_hash CHAR(64) NULL,
  expires_at DATETIME(3) NOT NULL,
  consumed_at DATETIME(3) NULL,
  verified_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY venture_email_otps_email_purpose_unique (email, purpose),
  KEY venture_email_otps_lookup_idx (email, purpose, created_at),
  KEY venture_email_otps_expires_idx (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
