import type {
  ActorContext,
  AuthorizationDecision,
  BpGrant,
  GrantInput,
  GrantValidation,
  ProjectResource,
} from "./types.ts";

const PROJECT_MUTATION_ROLES = new Set(["org_admin", "project_manager", "editor"]);
const BP_REQUEST_ORGANIZATION_TYPES = new Set(["investor", "fa", "government"]);

function hasAnyRole(actor: ActorContext, roles: Set<string>): boolean {
  return actor.roles.some((role) => roles.has(role));
}

export function authorizeProjectMutation(
  actor: ActorContext | null,
  project: ProjectResource,
): AuthorizationDecision {
  if (!actor) {
    return { allowed: false, reason: "authentication_required" };
  }

  const ownsProject = actor.organizationId === project.ownerOrganizationId;
  const isDelegatedFa =
    actor.organizationType === "fa" &&
    project.delegatedFaOrganizationIds.includes(actor.organizationId);

  if (!ownsProject && !isDelegatedFa) {
    return { allowed: false, reason: "cross_organization" };
  }

  if (!hasAnyRole(actor, PROJECT_MUTATION_ROLES)) {
    return { allowed: false, reason: "insufficient_role" };
  }

  return { allowed: true };
}

export function canRequestBp(
  actor: ActorContext | null,
  project: ProjectResource,
): AuthorizationDecision {
  if (!actor) {
    return { allowed: false, reason: "authentication_required" };
  }
  if (!actor.organizationVerified) {
    return { allowed: false, reason: "organization_not_verified" };
  }
  if (actor.organizationId === project.ownerOrganizationId) {
    return { allowed: false, reason: "owner_does_not_request" };
  }
  if (!BP_REQUEST_ORGANIZATION_TYPES.has(actor.organizationType)) {
    return { allowed: false, reason: "organization_type_not_eligible" };
  }
  return { allowed: true };
}

export function authorizeBpRead(
  actor: ActorContext | null,
  project: ProjectResource,
  bpFileId: string,
  grants: BpGrant[],
  now = new Date(),
): AuthorizationDecision<{ grant?: BpGrant }> {
  if (!actor) {
    return { allowed: false, reason: "authentication_required" };
  }

  if (actor.organizationId === project.ownerOrganizationId) {
    return { allowed: true };
  }

  const grant = grants.find(
    (candidate) =>
      candidate.bpFileId === bpFileId &&
      candidate.granteeOrganizationId === actor.organizationId,
  );

  if (!grant) {
    return { allowed: false, reason: "grant_required" };
  }
  if (grant.revokedAt) {
    return { allowed: false, reason: "grant_revoked" };
  }
  const expiresAt = new Date(grant.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
    return { allowed: false, reason: "grant_expired" };
  }

  return { allowed: true, grant };
}

export function validateGrantInput(input: GrantInput, now = new Date()): GrantValidation {
  if (!input.granteeOrganizationVerified) {
    return { valid: false, reason: "grantee_not_verified" };
  }
  const expiresAt = new Date(input.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return { valid: false, reason: "invalid_expiry" };
  }
  if (expiresAt.getTime() <= now.getTime()) {
    return { valid: false, reason: "expiry_must_be_future" };
  }
  return { valid: true };
}
