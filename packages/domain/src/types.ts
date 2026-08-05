export type OrganizationType = "project" | "company" | "investor" | "fa" | "government" | "user" | "platform";

export type OrganizationRole =
  | "platform_admin"
  | "org_admin"
  | "project_manager"
  | "editor"
  | "member"
  | "viewer";

export interface ActorContext {
  userId: string;
  organizationId: string;
  organizationType: OrganizationType;
  organizationVerified: boolean;
  roles: OrganizationRole[];
  displayName?: string;
  organizationName?: string;
  email?: string | null;
  emailVerifiedAt?: string | null;
  phone?: string | null;
  createdAt?: string;
}

export interface ProjectResource {
  id: string;
  ownerOrganizationId: string;
  delegatedFaOrganizationIds: string[];
}

export interface BpGrant {
  id: string;
  bpFileId: string;
  granteeOrganizationId: string;
  expiresAt: string;
  revokedAt: string | null;
  allowDownload: boolean;
}

export type AuthorizationReason =
  | "authentication_required"
  | "organization_not_verified"
  | "organization_type_not_eligible"
  | "cross_organization"
  | "insufficient_role"
  | "grant_required"
  | "grant_expired"
  | "grant_revoked"
  | "owner_does_not_request";

export type AuthorizationDecision<T extends object = object> =
  | ({ allowed: true } & T)
  | { allowed: false; reason: AuthorizationReason };

export interface GrantInput {
  granteeOrganizationVerified: boolean;
  expiresAt: string;
  allowDownload: boolean;
}

export type GrantValidation =
  | { valid: true }
  | { valid: false; reason: "grantee_not_verified" | "invalid_expiry" | "expiry_must_be_future" };
