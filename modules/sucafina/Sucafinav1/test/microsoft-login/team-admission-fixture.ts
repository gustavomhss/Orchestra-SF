import { expect } from "bun:test"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { SfInstallation } from "../../../../../apps/cli/src/sucafina-product/installation.ts"
import { other, oid, tenant, type microsoftFixture } from "./oidc-fixture.ts"
import { publicOrigin } from "./private-fixture.ts"

const teamId = "77777777-7777-4777-8777-777777777777"

/** A synthetic Team admitted through signed OIDC and the real installed administration HTTP endpoint. */
export async function admitMicrosoftFixtureTeam(input: {
  installation: SfInstallation
  provider: Awaited<ReturnType<typeof microsoftFixture>>
  request: (pathname: string, init?: RequestInit) => Promise<Response>
}) {
  const installed = await input.installation.discovery?.current(new AbortController().signal)
  const identity = installed?.identity()
  if (!installed || installed.authMode !== "microsoft" || installed.tenantId !== tenant || !identity)
    throw new Error("Actual Microsoft installation discovery required")
  const profile = Schema.decodeUnknownSync(TeamProfile.Ref)({
    installationId: identity.installationId, tenantId: installed.tenantId, teamObjectId: teamId,
  })
  const team = { id: teamId, tenantId: tenant, displayName: "Synthetic admitted native Team", isArchived: false }
  input.provider.teamResources.set(teamId, team)
  for (const principal of [oid, other]) input.provider.directTeams.set(principal, [team])
  // Administration needs no business role or product grant. The tested first user is still signed out.
  const start = await input.request(input.installation.mount + "/auth/login")
  expect(start.status).toBe(303)
  const location = start.headers.get("location")
  const challenge = start.headers.getSetCookie()[0]?.split(";")[0]
  if (!location || !challenge) throw new Error("Actual administrator OIDC challenge required")
  const state = new URL(location).searchParams.get("state")
  const code = await input.provider.issueCode(location, other)
  const finish = await input.request(input.installation.mount + "/auth/callback?" + new URLSearchParams({ state: state ?? "", code }), {
    headers: { cookie: challenge },
  })
  expect(finish.status).toBe(303)
  const cookie = finish.headers.getSetCookie().find((value) => value.includes("_session="))?.split(";")[0]
  if (!cookie) throw new Error("Actual administrator session required")
  const configured = await input.request(input.installation.mount + "/api/ui/team-profiles?" + new URLSearchParams({
    contractRevision: "sf-team-profile/1", installationId: profile.installationId, tenantId: profile.tenantId,
  }), {
    method: "POST", headers: { cookie, origin: publicOrigin, "content-type": "application/json" },
    body: JSON.stringify({ action: "enable", profile, expectedRevision: 0 }),
  })
  expect(configured.status).toBe(200)
  expect(await configured.json()).toEqual({ status: "ok", configRevision: 1, changed: true })
  const logout = await input.request(input.installation.mount + "/auth/logout", {
    method: "POST", headers: { cookie, origin: publicOrigin },
  })
  expect(logout.status).toBe(204)
  return { profile, selector: JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile }) }
}
