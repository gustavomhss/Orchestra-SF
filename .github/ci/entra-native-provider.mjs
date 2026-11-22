// Hosted package qualification only. Replaces the remote Entra/Graph transport while
// the installed binary, OIDC verification, session persistence, and Team check stay real.
import { createHash, generateKeyPairSync, sign } from "node:crypto"
import { pathToFileURL } from "node:url"

const tenant = "11111111-1111-4111-8111-111111111111"
const client = "22222222-2222-4222-8222-222222222222"
const allowedPrincipal = "33333333-3333-4333-8333-333333333333"
const deniedPrincipal = "33333333-3333-4333-8333-333333333334"
const otherPrincipal = "33333333-3333-4333-8333-333333333335"
const otherTeam = "44444444-4444-4444-8444-444444444445"
const team = "44444444-4444-4444-8444-444444444444"
const group = "55555555-5555-4555-8555-555555555555"
const issuer = `https://login.microsoftonline.com/${tenant}/v2.0`
const authority = `https://login.microsoftonline.com/${tenant}`
const keyId = "entra-native-ci"
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: "jwk" }), alg: "RS256", kid: keyId, use: "sig" }
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url")

function idToken(oid, nonce) {
  const now = Math.floor(Date.now() / 1000)
  const body = `${b64({ alg: "RS256", kid: keyId })}.${b64({
    oid, nonce, tid: tenant, sub: `synthetic-${oid}`, iss: issuer, aud: client, iat: now, exp: now + 3600,
  })}`
  return body + "." + sign("RSA-SHA256", Buffer.from(body), privateKey).toString("base64url")
}

async function hostedProvider(request) {
  const url = new URL(request.url)
  if (url.href === `${issuer}/.well-known/openid-configuration`) {
    return Response.json({
      issuer,
      authorization_endpoint: `${authority}/oauth2/v2.0/authorize`,
      token_endpoint: `${authority}/oauth2/v2.0/token`,
      jwks_uri: `${authority}/discovery/v2.0/keys`,
    })
  }
  if (url.href === `${authority}/discovery/v2.0/keys`) return Response.json({ keys: [jwk] })
  if (url.href === `${authority}/oauth2/v2.0/token`) {
    const form = new URLSearchParams(await request.text())
    const [principal, nonce, challenge, trailing] = (form.get("code") ?? "").split(".")
    const verifier = form.get("code_verifier")
    const correctChallenge = verifier && createHash("sha256").update(verifier).digest("base64url")
    if (!["allowed", "denied", "other"].includes(principal) || !nonce || trailing || correctChallenge !== challenge ||
      form.get("client_id") !== client || form.get("client_secret") !== "hosted-ci-only") return Response.json({}, { status: 400 })
    const oid = principal === "allowed" ? allowedPrincipal : principal === "other" ? otherPrincipal : deniedPrincipal
    return Response.json({
      token_type: "Bearer", access_token: `synthetic-${principal}`, id_token: idToken(oid, nonce),
      expires_in: 3600, scope: "User.Read Team.ReadBasic.All",
    })
  }
  if (url.origin === "https://graph.microsoft.com") {
    const authorization = request.headers.get("authorization")
    if (!["Bearer synthetic-allowed", "Bearer synthetic-denied", "Bearer synthetic-other"].includes(authorization)) return Response.json({}, { status: 401 })
    const allowed = authorization.endsWith("-allowed")
    const other = authorization.endsWith("-other")
    switch (url.pathname) {
      case "/v1.0/me":
        return Response.json({ id: allowed ? allowedPrincipal : other ? otherPrincipal : deniedPrincipal, displayName: other ? "Other Team CI account" : allowed ? "Allowed CI account" : "Denied CI account" })
      case "/v1.0/me/joinedTeams":
        return Response.json({ value: allowed || other ? [{ id: other ? otherTeam : team, tenantId: tenant, displayName: "CI Team", isArchived: false }] : [] })
      case "/v1.0/me/checkMemberGroups":
        return Response.json({ value: allowed || other ? [group] : [] })
    }
  }
  throw new Error("Unexpected outbound request in hosted Entra package qualification")
}

const installed = await import(pathToFileURL(process.env.SF_PROOF_FACTORY).href)
if (installed.nativeSfTeamInstallation !== true) throw new Error("Packaged Microsoft factory lacks Team installation support")
export const nativeSfTeamInstallation = installed.nativeSfTeamInstallation

export default function hostedInstallation(context) {
  return installed.createMicrosoftInstallation(context, process.env.SUCAFINA_MICROSOFT_CONFIG, process.env, { fetch: hostedProvider })
}
