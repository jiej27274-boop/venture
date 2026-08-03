import { describe, expect, it } from "vitest";
import {
  authorizeBpRead,
  authorizeProjectMutation,
  canRequestBp,
  validateGrantInput,
  type ActorContext,
  type BpGrant,
  type ProjectResource,
} from "../src/index.ts";

const project: ProjectResource = {
  id: "project-1",
  ownerOrganizationId: "org-project",
  delegatedFaOrganizationIds: ["org-fa"],
};

const actors = {
  visitor: null,
  owner: {
    userId: "user-owner",
    organizationId: "org-project",
    organizationType: "project",
    organizationVerified: true,
    roles: ["org_admin"],
  },
  investor: {
    userId: "user-investor",
    organizationId: "org-investor",
    organizationType: "investor",
    organizationVerified: true,
    roles: ["member"],
  },
  unverifiedInvestor: {
    userId: "user-unverified",
    organizationId: "org-unverified",
    organizationType: "investor",
    organizationVerified: false,
    roles: ["member"],
  },
  fa: {
    userId: "user-fa",
    organizationId: "org-fa",
    organizationType: "fa",
    organizationVerified: true,
    roles: ["project_manager"],
  },
  government: {
    userId: "user-government",
    organizationId: "org-government",
    organizationType: "government",
    organizationVerified: true,
    roles: ["member"],
  },
  platformAdmin: {
    userId: "user-admin",
    organizationId: "org-platform",
    organizationType: "platform",
    organizationVerified: true,
    roles: ["platform_admin"],
  },
} satisfies Record<string, ActorContext | null>;

function activeGrant(overrides: Partial<BpGrant> = {}): BpGrant {
  return {
    id: "grant-1",
    bpFileId: "bp-1",
    granteeOrganizationId: "org-investor",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    revokedAt: null,
    allowDownload: false,
    ...overrides,
  };
}

describe("project mutation isolation", () => {
  it("allows the owning project organization", () => {
    expect(authorizeProjectMutation(actors.owner, project)).toEqual({ allowed: true });
  });

  it("rejects a member from another organization", () => {
    expect(authorizeProjectMutation(actors.investor, project)).toEqual({
      allowed: false,
      reason: "cross_organization",
    });
  });

  it("allows an explicitly delegated FA to maintain the project", () => {
    expect(authorizeProjectMutation(actors.fa, project)).toEqual({ allowed: true });
  });
});

describe("BP request eligibility", () => {
  it("requires a verified eligible organization", () => {
    expect(canRequestBp(actors.unverifiedInvestor, project)).toEqual({
      allowed: false,
      reason: "organization_not_verified",
    });
  });

  it.each([actors.investor, actors.fa, actors.government])(
    "allows verified investor, FA, and government subjects",
    (actor) => {
      expect(canRequestBp(actor, project)).toEqual({ allowed: true });
    },
  );
});

describe("BP read authorization", () => {
  it("rejects visitors and actors without a grant", () => {
    expect(authorizeBpRead(actors.visitor, project, "bp-1", [])).toEqual({
      allowed: false,
      reason: "authentication_required",
    });
    expect(authorizeBpRead(actors.investor, project, "bp-1", [])).toEqual({
      allowed: false,
      reason: "grant_required",
    });
  });

  it("allows the project owner", () => {
    expect(authorizeBpRead(actors.owner, project, "bp-1", [])).toEqual({ allowed: true });
  });

  it("allows an active grant for the current organization", () => {
    const grant = activeGrant();
    expect(authorizeBpRead(actors.investor, project, "bp-1", [grant])).toEqual({
      allowed: true,
      grant,
    });
  });

  it("rejects expired and revoked grants", () => {
    expect(
      authorizeBpRead(actors.investor, project, "bp-1", [
        activeGrant({ expiresAt: new Date(Date.now() - 60_000).toISOString() }),
      ]),
    ).toEqual({ allowed: false, reason: "grant_expired" });

    expect(
      authorizeBpRead(actors.investor, project, "bp-1", [
        activeGrant({ revokedAt: new Date().toISOString() }),
      ]),
    ).toEqual({ allowed: false, reason: "grant_revoked" });
  });

  it("does not let a platform administrator bypass BP authorization", () => {
    expect(authorizeBpRead(actors.platformAdmin, project, "bp-1", [])).toEqual({
      allowed: false,
      reason: "grant_required",
    });
  });
});

describe("grant input validation", () => {
  it("rejects grants to unverified organizations", () => {
    expect(
      validateGrantInput({
        granteeOrganizationVerified: false,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        allowDownload: true,
      }),
    ).toEqual({ valid: false, reason: "grantee_not_verified" });
  });

  it("rejects a grant that is already expired", () => {
    expect(
      validateGrantInput({
        granteeOrganizationVerified: true,
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        allowDownload: false,
      }),
    ).toEqual({ valid: false, reason: "expiry_must_be_future" });
  });
});
