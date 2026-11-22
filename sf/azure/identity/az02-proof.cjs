#!/usr/bin/env node
"use strict";

// AZ02 CHANGE_CONTRACT from 687759276c2c9121c2cfd20a5994b277ceb7ee4d.
// Six owner-operated phases; the 32 original obligations remain mapped below.
// This executor records observations. Even a successful invocation never grants
// LIVE qualification by itself: installed G08 joins the original host observer,
// package, reservation and complete phase receipts on the same candidate.
// CLI: node sf/azure/identity/az02-proof.cjs --phase <phase> --config <private-json>
//      --out <fresh-private-public-receipt> --private-out <fresh-private-details>
// Producer/logout additionally require their explicit --confirm-* flags.
// Start after-restart --observe-restart BEFORE the owner performs the approved
// restart, while the original service runs and the logout cookie is already
// revoked. This read-only watcher waits at most five minutes; it never restarts
// a service. It rediscovers the fresh hostId before replaying those same bytes.
const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");

const CONTRACT = "sf-team-profile/1";
const PHASES = Object.freeze(["preflight", "actors", "producer", "after-revoke", "logout", "after-restart"]);
const ROSTER = Object.freeze({
  preflight: ["GUEST", "MISSING_SELECTORS", "DUPLICATE_SELECTOR", "BIND_installationId", "BIND_tenantId", "BIND_hostId",
    "CROSS_ORIGIN_GET", "CROSS_SITE_GET", "CSRF_NO_ORIGIN", "CSRF_OTHER_ORIGIN", "CSRF_CROSS_SITE", "OIDC_REDIRECT",
    "CALLBACK_WITHOUT_CHALLENGE", "CALLBACK_DUPLICATE_STATE", "NO_TEAM_BUSINESS", "ADMIN_NO_TEAM_MAINTENANCE"],
  actors: ["ACTOR_REQUESTER", "ACTOR_HOLDER", "ACTOR_DENIED", "DISTINCT_ACTORS",
    "AUTH_BIND_installationId", "AUTH_BIND_tenantId", "AUTH_BIND_hostId",
    "AUTH_CSRF_NO_ORIGIN", "AUTH_CSRF_OTHER_ORIGIN", "AUTH_CSRF_CROSS_SITE", "AUTH_CSRF_SESSION_SURVIVES",
    "AUTH_FOREIGN_TEAM", "AUTH_FORGED_PRINCIPAL", "AUTH_FORGED_REVISIONS"],
  producer: ["CAS_409", "VALIDATION_422"],
  "after-revoke": ["REVOKE_CONTEXT", "REVOKE_SOURCE"],
  logout: ["LOGOUT_204", "REPLAY_AFTER_LOGOUT"],
  "after-restart": ["REPLAY_AFTER_RESTART"],
});
const LEGACY_MAP = Object.freeze({
  BIND_projectId: "BIND_tenantId", AUTH_BIND_projectId: "AUTH_BIND_tenantId",
});
const ADDITIONS = Object.freeze(["NO_TEAM_BUSINESS", "ADMIN_NO_TEAM_MAINTENANCE",
  "AUTH_FOREIGN_TEAM", "AUTH_FORGED_PRINCIPAL", "AUTH_FORGED_REVISIONS"]);
const HASH40 = /^[a-f0-9]{40}$/;
const HASH64 = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const COOKIE = /^__Secure-sucafina_[a-f0-9]{12}_session=[a-f0-9]{64}$/;
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const assert = (condition, code) => { if (!condition) throw new Error(code); };
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const changed = (value) => value[0] === "a" ? "b" + value.slice(1) : "a" + value.slice(1);

/** Reject duplicate JSON keys before JSON.parse can discard contrary evidence. */
function strictJson(raw) {
  assert(typeof raw === "string" && raw.length <= 8_388_608, "JSON_LIMIT");
  let at = 0, nodes = 0;
  const space = () => { while (/\s/.test(raw[at] ?? "") && at < raw.length) at++; };
  function string() {
    const start = at++;
    while (at < raw.length) {
      if (raw[at] === "\\") { at += 2; continue; }
      if (raw[at++] === '"') return JSON.parse(raw.slice(start, at));
    }
    throw new Error("JSON_STRING");
  }
  function value(depth) {
    space();
    assert(depth <= 40 && ++nodes <= 100000, "JSON_DEPTH");
    if (raw[at] === '"') return string();
    if (raw[at] === "{" || raw[at] === "[") {
      const dictionary = raw[at++] === "{", close = dictionary ? "}" : "]", keys = new Set();
      space();
      if (raw[at] === close) { at++; return; }
      while (at < raw.length) {
        if (dictionary) {
          assert(raw[at] === '"', "JSON_KEY");
          const key = string();
          assert(!keys.has(key), "JSON_DUPLICATE_KEY");
          keys.add(key); space(); assert(raw[at++] === ":", "JSON_COLON");
        }
        value(depth + 1); space();
        const separator = raw[at++];
        if (separator === close) return;
        assert(separator === ",", "JSON_SEPARATOR"); space();
      }
      throw new Error("JSON_UNTERMINATED");
    }
    const token = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(raw.slice(at));
    assert(token, "JSON_VALUE"); at += token[0].length;
  }
  value(0); space(); assert(at === raw.length, "JSON_TRAILING");
  return JSON.parse(raw);
}

function privateRead(file, maximum = 131072) {
  assert(typeof file === "string" && path.isAbsolute(file) && path.normalize(file) === file, "PRIVATE_PATH_REQUIRED");
  const parent = path.dirname(file), directory = fs.lstatSync(parent);
  assert(directory.isDirectory() && !directory.isSymbolicLink() && (directory.mode & 0o077) === 0 &&
    directory.uid === process.getuid() && fs.realpathSync(parent) === parent, "PRIVATE_0700_REQUIRED");
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const before = fs.fstatSync(fd);
    assert(before.isFile() && (before.mode & 0o077) === 0 && before.uid === process.getuid() &&
      before.nlink === 1 && before.size > 0 && before.size <= maximum &&
      fs.realpathSync(file) === file, "PRIVATE_0600_REQUIRED");
    const bytes = fs.readFileSync(fd);
    const after = fs.fstatSync(fd);
    assert(bytes.length === before.size && before.ino === after.ino && before.size === after.size &&
      before.mtimeMs === after.mtimeMs, "PRIVATE_FILE_CHANGED");
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } finally { fs.closeSync(fd); }
}

function writePrivate(file, value) {
  assert(path.isAbsolute(file) && path.normalize(file) === file, "PRIVATE_OUTPUT_PATH");
  const parent = path.dirname(file), entry = fs.lstatSync(parent);
  assert(entry.isDirectory() && entry.uid === process.getuid() && (entry.mode & 0o077) === 0 &&
    fs.realpathSync(parent) === parent, "PRIVATE_OUTPUT_ROOT");
  const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value) + "\n"); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function validateConfig(input) {
  assert(object(input) && input.schema === "sf.az02.teams-plan.v2", "TEAMS_PLAN_REQUIRED");
  const config = structuredClone(input), origin = new URL(config.origin);
  assert(origin.protocol === "https:" && origin.origin === config.origin && !origin.port &&
    !origin.username && !origin.password && origin.hostname.includes(".") &&
    !origin.hostname.endsWith(".local") && !origin.hostname.endsWith(".localhost") &&
    !/^[0-9.]+$/.test(origin.hostname), "PUBLIC_HTTPS_ORIGIN_REQUIRED");
  assert(/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(config.mount), "MOUNT_REQUIRED");
  for (const key of ["tenantId", "clientId", "teamObjectId", "foreignTeamObjectId"]) assert(UUID.test(config[key]), "OBJECT_ID_REQUIRED");
  assert(config.teamObjectId !== config.foreignTeamObjectId, "FOREIGN_TEAM_REQUIRED");
  for (const key of ["installationId", "projectId", "hostId"])
    assert(typeof config[key] === "string" && /^[A-Za-z0-9._:-]{8,128}$/.test(config[key]), "HOST_BINDING_REQUIRED");
  assert(HASH40.test(config.candidate?.sha) && HASH40.test(config.candidate?.tree) &&
    HASH64.test(config.archiveSha256), "CANDIDATE_TREE_TAR_REQUIRED");
  assert(/^[a-f0-9]{32}$/.test(config.invocation?.id) && /^[1-9][0-9]*$/.test(config.invocation?.runId) &&
    /^[1-9][0-9]*$/.test(config.invocation?.runAttempt) && HASH40.test(config.invocation?.workflowSha), "INVOCATION_REQUIRED");
  assert(config.teamDirectory === "self" || config.teamDirectory === "members", "ROSTER_MODE_REQUIRED");
  for (const role of ["requester", "holder", "denied", "noTeam", "administrator"]) {
    assert(object(config.actors?.[role]) && UUID.test(config.actors[role].principalObjectId) &&
      typeof config.actors[role].cookieFile === "string", "ORIGINAL_ACTOR_REQUIRED");
  }
  assert(config.actors.requester.principalObjectId !== config.actors.holder.principalObjectId, "DISTINCT_PRINCIPALS_REQUIRED");
  assert(!Object.hasOwn(config, "restartReceipt") && !Object.hasOwn(config, "liveQualified"), "MANUAL_LIVE_CLAIM_REFUSED");
  return config;
}

function target(config, route, credentialed = false) {
  const url = new URL(config.origin + route);
  const discovery = "/api/sucafina/installations?select=current&contractRevision=sf-team-profile%2F1";
  assert(url.origin === config.origin && !url.username && !url.password && !url.hash &&
    (url.pathname.startsWith(config.mount + "/") || !credentialed && route === discovery), "UNTRUSTED_DESTINATION");
  return url;
}

function sendHttps(config, method, route, headers = {}, body) {
  const url = target(config, route, Object.keys(headers).some((key) => /^(cookie|authorization)$/i.test(key)));
  return new Promise((resolve, reject) => {
    const request = https.request(url, { method, headers: { Accept: "application/json", ...headers },
      timeout: 15000, maxHeaderSize: 16384, agent: false }, (response) => {
      const chunks = [], peer = response.socket?.remoteAddress ?? null, peerPort = response.socket?.remotePort ?? null;
      let bytes = 0;
      response.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > 8388608) request.destroy(new Error("RESPONSE_LIMIT"));
        else chunks.push(chunk);
      });
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers,
        body: Buffer.concat(chunks).toString("utf8"), peer, peerPort }));
      response.on("error", reject);
    });
    request.on("timeout", () => request.destroy(new Error("TIMEOUT")));
    request.on("error", reject);
    request.end(body);
  });
}
function json(response) {
  if (!/^application\/json(?:\s*;|$)/i.test(String(response.headers["content-type"] ?? ""))) return undefined;
  try { return strictJson(response.body); } catch { return undefined; }
}
function safe(response, config) {
  return /\bno-store\b/i.test(String(response.headers["cache-control"] ?? "")) &&
    (!response.headers["access-control-allow-origin"] || response.headers["access-control-allow-origin"] === config.origin);
}
function accepted(response, statuses, config) { return statuses.includes(response.status) && safe(response, config); }
function contextRoute(config, changes = {}) {
  const query = { contractRevision: CONTRACT, installationId: config.installationId, tenantId: config.tenantId,
    hostId: config.hostId, kind: "team", teamObjectId: config.teamObjectId, ...changes };
  for (const key of Object.keys(query)) if (query[key] === undefined) delete query[key];
  return config.mount + "/api/ui/context?" + new URLSearchParams(query);
}
function selector(config, team = config.teamObjectId) {
  return JSON.stringify({ contractRevision: CONTRACT, kind: "team",
    profile: { installationId: config.installationId, tenantId: config.tenantId, teamObjectId: team } });
}
function stampOk(response, config, role) {
  const value = json(response)?.value, stamp = value?.stamp, profile = value?.profile, team = stamp?.team;
  const expected = config.actors[role].principalObjectId;
  return accepted(response, [200], config) && json(response)?.status === "ok" &&
    value.contractRevision === CONTRACT && value.authMode === "microsoft" &&
    stamp?.installationId === config.installationId && stamp.projectId === config.projectId &&
    stamp.hostId === config.hostId && stamp.principalRef === expected &&
    typeof stamp.policyVersion === "string" && stamp.policyVersion.length > 0 &&
    typeof stamp.accessRevision === "string" && stamp.accessRevision.length > 0 &&
    profile?.contractRevision === CONTRACT && profile.status === "authenticated" &&
    profile.installationId === config.installationId && profile.principal?.tenantId === config.tenantId &&
    profile.principal.principalObjectId === expected && profile.accessRevision === stamp.accessRevision &&
    profile.teams?.status === "ready" && profile.teams.selected?.installationId === config.installationId &&
    profile.teams.selected.tenantId === config.tenantId && profile.teams.selected.teamObjectId === config.teamObjectId &&
    same(team?.owner?.profile, profile.teams.selected) &&
    same(team?.owner?.principal, profile.principal) &&
    object(team?.revisions) && team.revisions.configRevision === profile.teams.configRevision &&
    (typeof team.revisions.configRevision === "string" && team.revisions.configRevision.length > 0 ||
      Number.isSafeInteger(team.revisions.configRevision) && team.revisions.configRevision >= 0) &&
    team.revisions.accessRevision === stamp.accessRevision &&
    response.headers["x-sf-contract-revision"] === CONTRACT &&
    response.headers["x-sf-access-revision"] === stamp.accessRevision;
}
function noBusiness(response, config, role, state) {
  const value = json(response)?.value, stamp = value?.stamp, profile = value?.profile;
  return accepted(response, [200], config) && json(response)?.status === "ok" &&
    value.contractRevision === CONTRACT && value.authMode === "microsoft" &&
    stamp?.installationId === config.installationId && stamp.projectId === config.projectId && stamp.hostId === config.hostId &&
    stamp.principalRef === config.actors[role].principalObjectId && stamp.team === undefined &&
    profile?.contractRevision === CONTRACT && profile.status === "authenticated" && profile.installationId === config.installationId &&
    typeof stamp.accessRevision === "string" && stamp.accessRevision.length > 0 && profile.accessRevision === stamp.accessRevision &&
    response.headers["x-sf-contract-revision"] === CONTRACT && response.headers["x-sf-access-revision"] === stamp.accessRevision &&
    profile.principal?.tenantId === config.tenantId &&
    profile.principal.principalObjectId === stamp.principalRef && profile.teams?.status === state &&
    Array.isArray(value.destinations) && value.destinations.length === 0 &&
    Array.isArray(value.availability) && value.availability.length === 0;
}
function refusal(response, config) {
  return accepted(response, [401, 403], config) && ["unauthenticated", "denied"].includes(json(response)?.status);
}

async function nativeProcess(config) {
  // Observe Linux itself; no operator JSON can assert that a restart happened.
  assert(process.platform === "linux" && process.arch === "x64", "NATIVE_LINUX_X64_REQUIRED");
  const expected = "/opt/orchestra-sf/releases/" + config.candidate.sha + "/bin/orchestra";
  const matches = [];
  for (const name of fs.readdirSync("/proc").filter((entry) => /^[1-9][0-9]*$/.test(entry))) {
    const root = "/proc/" + name;
    let group;
    try { group = fs.readFileSync(root + "/cgroup", "utf8"); } catch { continue; }
    if (!group.split("\n").some((line) => line.split(":").slice(2).join(":") === "/system.slice/orchestra-sf.service")) continue;
    const executable = fs.readlinkSync(root + "/exe");
    if (executable !== expected) continue;
    const before = fs.readFileSync(root + "/stat", "utf8").split(") ").slice(1).join(") ").split(" ");
    assert(before.length > 19 && /^[1-9][0-9]*$/.test(before[19]) && before[0] !== "Z", "ORIGINAL_SERVICE_STATE_REQUIRED");
    const uid = fs.readFileSync(root + "/status", "utf8").split("\n").find((line) => line.startsWith("Uid:"))?.trim().split(/\s+/).slice(1);
    assert(uid?.length === 4 && Number(uid[0]) > 0 && uid.every((value) => value === uid[0]), "NONPRIVILEGED_SERVICE_REQUIRED");
    const argv = fs.readFileSync(root + "/cmdline").toString("utf8").split("\0");
    assert(argv.pop() === "" && argv.length === 8 &&
      same(argv.slice(1, 7), ["serve", "--hostname", "127.0.0.1", "--port", "4096", "--installation"]) &&
      fs.realpathSync(argv[0]) === expected &&
      fs.realpathSync(argv[7]) === "/opt/orchestra-sf/releases/" + config.candidate.sha + "/bin/local/entry.mjs",
      "ORIGINAL_SERVICE_FACTORY_REQUIRED");
    const after = fs.readFileSync(root + "/stat", "utf8").split(") ").slice(1).join(") ").split(" ");
    assert(before[19] === after[19] && fs.readlinkSync(root + "/exe") === expected, "PROCESS_CHANGED_DURING_OBSERVATION");
    matches.push({ pid: Number(name), startTicks: before[19],
      bootId: fs.readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim(),
      executable, factorySha256: sha(fs.readFileSync(argv[7])) });
  }
  assert(matches.length === 1, "ONE_ORIGINAL_SERVICE_REQUIRED");
  return matches[0];
}

/** Overrides are test-only and irreversibly classify the receipt as controlled. */
async function runPhase(configInput, phase, options = {}, overrides) {
  const config = validateConfig(configInput);
  assert(PHASES.includes(phase), "PHASE_REQUIRED");
  const controlled = overrides !== undefined;
  const io = { send: (method, route, headers, body) => sendHttps(config, method, route, headers, body),
    read: privateRead, observe: () => nativeProcess(config),
    wait: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    now: () => Date.now(), ...overrides };
  const cases = [], details = [], actorCookies = new Map();
  const cookie = (role) => {
    if (actorCookies.has(role)) return actorCookies.get(role);
    const raw = io.read(config.actors[role].cookieFile, 4096).trim();
    assert(COOKIE.test(raw), "ORIGINAL_COOKIE_REQUIRED"); actorCookies.set(role, raw); return raw;
  };
  const actorHeaders = (role = "requester", team) => ({ Cookie: cookie(role), "x-sf-team-profile": selector(config, team) });
  const contextHeaders = (role = "requester") => ({ Cookie: cookie(role) });
  const send = (method, route, headers = {}, body) => io.send(method, route, headers, body);
  async function check(id, expected, operation) {
    let result;
    try { result = await operation(); } catch { result = { ok: false, code: "OBSERVATION_ERROR" }; }
    cases.push({ id, expected, observed: result.code ?? (result.status === undefined ? "BOOLEAN_CHECK" : String(result.status)),
      status: result.ok === true ? "PASS" : "FAIL" });
  }
  const csrf = [
    ["NO_ORIGIN", {}], ["OTHER_ORIGIN", { Origin: "https://unauthorized.invalid" }],
    ["CROSS_SITE", { Origin: config.origin, "Sec-Fetch-Site": "cross-site" }],
  ];
  if (phase === "preflight") {
    await check("GUEST", "401|403", async () => { const r = await send("GET", contextRoute(config)); return { status: r.status, ok: refusal(r, config) }; });
    await check("MISSING_SELECTORS", "400 without legacy fallback", async () => {
      const r = await send("GET", config.mount + "/api/ui/context");
      return { status: r.status, ok: accepted(r, [400], config) &&
        /^application\/json(?:\s*;|$)/i.test(String(r.headers["content-type"] ?? "")) }; });
    await check("DUPLICATE_SELECTOR", "400", async () => {
      const r = await send("GET", contextRoute(config) + "&tenantId=" + config.tenantId); return { status: r.status, ok: accepted(r, [400], config) }; });
    for (const key of ["installationId", "tenantId", "hostId"])
      await check("BIND_" + key, "400 closed Team selector", async () => {
        const r = await send("GET", contextRoute(config, { [key]: changed(config[key]) })); return { status: r.status, ok: accepted(r, [400], config) }; });
    for (const [id, header] of [["CROSS_ORIGIN_GET", { Origin: "https://unauthorized.invalid" }], ["CROSS_SITE_GET", { "Sec-Fetch-Site": "cross-site" }]])
      await check(id, "400", async () => { const r = await send("GET", contextRoute(config), header); return { status: r.status, ok: accepted(r, [400], config) }; });
    for (const [id, header] of csrf) await check("CSRF_" + id, "403", async () => {
      const r = await send("POST", config.mount + "/auth/logout", header); return { status: r.status, ok: accepted(r, [403], config) }; });
    await check("OIDC_REDIRECT", "303 original confidential code PKCE S256 and exact Teams scopes", async () => {
      const r = await send("GET", config.mount + "/auth/login"), url = new URL(r.headers.location), query = url.searchParams;
      const keys = ["client_id", "response_type", "response_mode", "redirect_uri", "scope", "state", "nonce", "code_challenge", "code_challenge_method"];
      const expectedScopes = ["openid", "profile", "offline_access", "User.Read", "Team.ReadBasic.All",
        ...(config.teamDirectory === "members" ? ["TeamMember.Read.All"] : [])].sort();
      const scopes = (query.get("scope") ?? "").split(/\s+/).filter(Boolean).sort();
      const login = (r.headers["set-cookie"] ?? []).find((entry) => /^__Secure-sucafina_[a-f0-9]{12}_login=/.test(entry));
      const attributes = login?.split(";").map((entry) => entry.trim().toLowerCase()) ?? [];
      return { status: r.status, ok: accepted(r, [303], config) && url.origin === "https://login.microsoftonline.com" &&
        url.pathname.toLowerCase() === "/" + config.tenantId + "/oauth2/v2.0/authorize" &&
        query.get("client_id") === config.clientId && query.get("redirect_uri") === config.origin + config.mount + "/auth/callback" &&
        query.get("response_type") === "code" && query.get("response_mode") === "query" && query.get("code_challenge_method") === "S256" &&
        /^[A-Za-z0-9_-]{43}$/.test(query.get("code_challenge") ?? "") && HASH64.test(query.get("state")) && HASH64.test(query.get("nonce")) &&
        same(scopes, expectedScopes) && keys.every((key) => query.getAll(key).length === 1) &&
        /^[a-f0-9]{64}$/.test(login?.split(";")[0].split("=")[1] ?? "") &&
        ["secure", "httponly", "samesite=lax", "path=" + config.mount.toLowerCase()].every((value) => attributes.includes(value)) &&
        !attributes.some((value) => value.startsWith("domain=")) };
    });
    for (const [id, route] of [
      ["CALLBACK_WITHOUT_CHALLENGE", "?state=" + "a".repeat(64) + "&code=bogus"],
      ["CALLBACK_DUPLICATE_STATE", "?state=" + "a".repeat(64) + "&state=" + "a".repeat(64) + "&code=bogus"],
    ]) await check(id, "403", async () => {
      const r = await send("GET", config.mount + "/auth/callback" + route); return { status: r.status, ok: accepted(r, [403], config) }; });
    await check("NO_TEAM_BUSINESS", "authenticated no-teams and business denied", async () => {
      const r = await send("GET", contextRoute(config, { kind: "selection", teamObjectId: undefined }), contextHeaders("noTeam"));
      const business = await send("GET", config.mount + "/api/ui/pages/CAP25", actorHeaders("noTeam"));
      return { code: "NO_TEAM_CONTEXT_AND_BUSINESS", ok: noBusiness(r, config, "noTeam", "no-teams") && refusal(business, config) };
    });
    await check("ADMIN_NO_TEAM_MAINTENANCE", "original administrator list available; business denied", async () => {
      const r = await send("GET", contextRoute(config, { kind: "administration", teamObjectId: undefined }), contextHeaders("administrator"));
      const list = await send("GET", config.mount + "/api/ui/team-profiles?" + new URLSearchParams({
        contractRevision: CONTRACT, installationId: config.installationId, tenantId: config.tenantId,
      }), contextHeaders("administrator"));
      const business = await send("GET", config.mount + "/api/ui/pages/CAP25", actorHeaders("administrator"));
      return { code: "ADMINISTRATION_IS_NOT_BUSINESS_AUTHORITY", ok:
        noBusiness(r, config, "administrator", "no-teams") && json(r)?.value?.profile?.administration?.status === "available" &&
        accepted(list, [200], config) && json(list)?.status === "ok" && refusal(business, config) };
    });
  }
  if (phase === "actors") {
    const admitted = [];
    for (const role of ["requester", "holder", "denied"]) await check("ACTOR_" + role.toUpperCase(),
      role === "denied" ? "401|403 or authenticated denied/revoked without business" : "200 exact original principal/Team/host/revisions", async () => {
        const raw = cookie(role), r = await send("GET", contextRoute(config), { Cookie: raw });
        const ok = role === "denied" ? refusal(r, config) || noBusiness(r, config, role, "revoked") :
          stampOk(r, config, role);
        if (ok && role !== "denied") {
          admitted.push({ raw, principal: json(r).value.stamp.principalRef });
          details.push({ role, cookieSha256: sha(raw), context: json(r).value.stamp });
        }
        return { status: r.status, ok };
      });
    await check("DISTINCT_ACTORS", "distinct original cookies and exact principals", async () => ({
      ok: admitted.length === 2 && admitted[0].raw !== admitted[1].raw && admitted[0].principal !== admitted[1].principal,
    }));
    for (const key of ["installationId", "tenantId", "hostId"]) await check("AUTH_BIND_" + key, "400 while authenticated", async () => {
      const r = await send("GET", contextRoute(config, { [key]: changed(config[key]) }), contextHeaders()); return { status: r.status, ok: accepted(r, [400], config) }; });
    for (const [id, header] of csrf) await check("AUTH_CSRF_" + id, "403 with original session preserved", async () => {
      const r = await send("POST", config.mount + "/auth/logout", { ...contextHeaders(), ...header }); return { status: r.status, ok: accepted(r, [403], config) }; });
    await check("AUTH_CSRF_SESSION_SURVIVES", "200 original exact owner after rejected CSRF", async () => {
      const r = await send("GET", contextRoute(config), contextHeaders()); return { status: r.status, ok: stampOk(r, config, "requester") }; });
    await check("AUTH_FOREIGN_TEAM", "foreign Team denied without changing the admitted original Team", async () => {
      const r = await send("GET", config.mount + "/api/ui/pages/CAP25", actorHeaders("requester", config.foreignTeamObjectId));
      const original = await send("GET", contextRoute(config), contextHeaders());
      return { status: r.status, ok: refusal(r, config) && stampOk(original, config, "requester") };
    });
    await check("AUTH_FORGED_PRINCIPAL", "400 caller principal cannot become authority", async () => {
      const r = await send("GET", contextRoute(config, { principalObjectId: config.actors.holder.principalObjectId }), contextHeaders());
      return { status: r.status, ok: accepted(r, [400], config) };
    });
    await check("AUTH_FORGED_REVISIONS", "400 caller revisions cannot become authority", async () => {
      const r = await send("GET", contextRoute(config, { configRevision: "claimed", accessRevision: "claimed" }), contextHeaders());
      return { status: r.status, ok: accepted(r, [400], config) };
    });
  }
  if (phase === "producer") {
    assert(options.confirmProducerWrites === true && config.isolated?.approvedForNegativeWrites === true &&
      typeof config.isolated.requestId === "string" && config.isolated.requestId.length > 0, "PRODUCER_APPROVAL_REQUIRED");
    const context = await send("GET", contextRoute(config), contextHeaders());
    assert(stampOk(context, config, "requester"), "CURRENT_TEAM_ADMISSION_REQUIRED");
    details.push({ role: "requester", cookieSha256: sha(cookie("requester")), context: json(context).value.stamp });
    async function snapshot() {
      const r = await send("GET", config.mount + "/api/ui/pages/CAP25?request=" + encodeURIComponent(config.isolated.requestId), actorHeaders());
      const value = json(r), key = "requests:" + config.isolated.requestId;
      assert(accepted(r, [200], config) && value?.status === "ok" && value.value?.capabilityId === "CAP25" &&
        same(value.context, json(context).value.stamp) && Object.hasOwn(value.value.versions ?? {}, key), "ORIGINAL_CAP25_SOURCE_REQUIRED");
      const version = value.value.versions[key], row = value.value.data?.requests?.find((entry) => entry.number === config.isolated.requestId);
      assert(row && object(version) && Number.isSafeInteger(version.version) && version.version >= 0 &&
        typeof version.by === "string", "ORIGINAL_REQUEST_VERSION_RECORD_REQUIRED");
      return { version: version.version, versionRecord: JSON.stringify(version), row: JSON.stringify(row) };
    }
    const before = await snapshot();
    for (const [id, file, status] of [["CAS_409", config.isolated.cas409BodyFile, 409], ["VALIDATION_422", config.isolated.validation422BodyFile, 422]])
      await check(id, "original " + status + " and unchanged Request/versionRecord", async () => {
        const raw = io.read(file, 65536), body = strictJson(raw);
        assert(body.page === "Requests" && body.action === "save" && body.id === config.isolated.requestId &&
          Number.isSafeInteger(body.version) && body.version >= 0 && object(body.values) &&
          (status === 409 ? body.version !== before.version : body.version === before.version), "ORIGINAL_NEGATIVE_BODY_REQUIRED");
        const r = await send("POST", config.mount + "/teams/" + config.teamObjectId + "/procurement",
          { ...actorHeaders(), Origin: config.origin, "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" }, raw);
        const after = await snapshot(), current = await send("GET", contextRoute(config), contextHeaders());
        return { status: r.status, ok: accepted(r, [status], config) && json(r)?.ok === false &&
          same(before, after) && stampOk(current, config, "requester") && same(json(current).value.stamp, json(context).value.stamp) };
      });
  }
  if (phase === "after-revoke") {
    const raw = cookie("requester");
    details.push({ role: "requester", cookieSha256: sha(raw) });
    await check("REVOKE_CONTEXT", "current session may survive but revoked Team has no business authority", async () => {
      const r = await send("GET", contextRoute(config), { Cookie: raw });
      return { status: r.status, ok: refusal(r, config) || noBusiness(r, config, "requester", "revoked") };
    });
    await check("REVOKE_SOURCE", "401|403 original CAP25 source with same session cookie", async () => {
      const r = await send("GET", config.mount + "/api/ui/pages/CAP25", { Cookie: raw, "x-sf-team-profile": selector(config) });
      return { status: r.status, ok: refusal(r, config) };
    });
  }
  if (phase === "logout") {
    assert(options.confirmLogout === true, "LOGOUT_APPROVAL_REQUIRED");
    const raw = cookie("requester");
    await check("LOGOUT_204", "204 application logout clearing both original cookies", async () => {
      const r = await send("POST", config.mount + "/auth/logout", { Cookie: raw, Origin: config.origin, "Sec-Fetch-Site": "same-origin" });
      const cleared = r.headers["set-cookie"] ?? [], prefix = raw.split("=")[0].replace(/_session$/, "");
      return { status: r.status, ok: accepted(r, [204], config) && ["login", "session"].every((name) =>
        cleared.some((entry) => entry.startsWith(prefix + "_" + name + "=") && /(?:^|;)\s*Max-Age=0(?:;|$)/i.test(entry))) };
    });
    await check("REPLAY_AFTER_LOGOUT", "401|403 replay of the exact cookie sent to logout", async () => {
      const r = await send("GET", contextRoute(config), { Cookie: raw }); return { status: r.status, ok: refusal(r, config) };
    });
    details.push({ role: "requester", cookieSha256: sha(raw) });
  }
  if (phase === "after-restart") {
    assert(options.observeRestart === true && !Object.hasOwn(options, "restartReceipt"), "OBSERVED_RESTART_REQUIRED");
    const raw = cookie("requester"), timeout = options.restartTimeoutMs ?? 120000;
    assert(Number.isSafeInteger(timeout) && timeout >= 1000 && timeout <= 300000, "RESTART_TIMEOUT_REQUIRED");
    await check("REPLAY_AFTER_RESTART", "native process change and same revoked cookie denied on fresh host", async () => {
      const initial = await send("GET", contextRoute(config), { Cookie: raw });
      assert(refusal(initial, config), "COOKIE_MUST_ALREADY_BE_REVOKED");
      const before = await io.observe(), deadline = io.now() + timeout;
      let after;
      while (io.now() < deadline) {
        await io.wait(1000);
        try {
          const candidate = await io.observe();
          if (!same(candidate, before)) { after = candidate; break; }
        } catch { after = undefined; /* A service outage is not restart evidence. */ }
      }
      assert(after && before.factorySha256 === after.factorySha256 &&
        before.executable === after.executable &&
        (before.pid !== after.pid || before.startTicks !== after.startTicks || before.bootId !== after.bootId), "NATIVE_RESTART_NOT_OBSERVED");
      const discovery = await send("GET", "/api/sucafina/installations?select=current&contractRevision=sf-team-profile%2F1");
      const entries = json(discovery)?.installations;
      assert(discovery.status === 200 && Array.isArray(entries) && entries.length === 1, "ORIGINAL_DISCOVERY_REQUIRED");
      const observed = entries[0];
      assert(observed.contractRevision === CONTRACT && observed.authMode === "microsoft" &&
        observed.installationId === config.installationId && observed.tenantId === config.tenantId &&
        observed.projectId === config.projectId && observed.publicOrigin === config.origin && observed.mount === config.mount &&
        typeof observed.hostId === "string" && observed.hostId.length > 0 && observed.hostId !== config.hostId, "RESTART_HOST_BINDING_REQUIRED");
      const fresh = { ...config, hostId: observed.hostId };
      const r = await send("GET", contextRoute(fresh), { Cookie: raw });
      const last = await io.observe();
      details.push({ role: "requester", cookieSha256: sha(raw), before, after, freshHost: observed });
      return { status: r.status, ok: refusal(r, config) && same(last, after) };
    });
  }
  assert(same(cases.map((entry) => entry.id), ROSTER[phase]), "EXACT_PHASE_INVENTORY_REQUIRED");
  return { receipt: {
    schema: "sf.az02.teams-proof.v2", phase, status: cases.every((entry) => entry.status === "PASS") ? "PASS" : "FAIL",
    proofClass: controlled ? "CONTROLLED_TRANSPORT" : "OWNER_OPERATED_HTTPS_OBSERVATIONS",
    liveQualified: false, installedTeamsProof: false, g08Closed: false, finalCandidate: false,
    candidate: config.candidate, archiveSha256: config.archiveSha256, invocation: config.invocation,
    source: { legacySha: "687759276c2c9121c2cfd20a5994b277ceb7ee4d", contractRevision: CONTRACT,
      legacyCaseCount: 32, currentCaseCount: 37, legacyMap: LEGACY_MAP, addedCaseIds: ADDITIONS },
    counts: { total: cases.length, passed: cases.filter((entry) => entry.status === "PASS").length,
      failed: cases.filter((entry) => entry.status !== "PASS").length, skipped: 0 },
    cases,
    scope: "Original observed HTTP only. LIVE additionally requires the actual G08 host observer, verified G07 package, reserved host and complete six-phase chain.",
  }, privateDetails: { schema: "sf.az02.private-observations.v2", phase, candidate: config.candidate,
    archiveSha256: config.archiveSha256, invocation: config.invocation, details } };
}

async function bindInstalledPlan(config) {
  // Input equality is a prerequisite, never an observation of a running host.
  const evidence = await import(pathToFileURL(path.resolve(__dirname, "../../../script/sf-ci/g08-private-evidence.mjs")));
  const planRaw = privateRead(config.hostPlanFile);
  const plan = evidence.validatePlan(strictJson(planRaw));
  const root = path.dirname(config.hostPlanFile);
  const packageRaw = privateRead(path.join(root, "package-receipt.json"), 5_000_000);
  assert(sha(packageRaw) === plan.packageReceiptSha256, "G07_RECEIPT_BYTES_REQUIRED");
  const receipt = evidence.validatePackage(strictJson(packageRaw), plan);
  evidence.requireInvocation(plan);
  const host = evidence.validateHost(strictJson(privateRead(path.join(root, "host-before.json"), 5_000_000)), plan, receipt);
  const running = await nativeProcess(config);
  assert(running.pid === host.process.pid && running.startTicks === host.process.startTicks &&
    running.bootId === host.process.bootId && running.executable === host.process.exe &&
    running.factorySha256 === receipt.factory.sha256, "CURRENT_NATIVE_PROCESS_BINDING_REQUIRED");
  const target = plan.target;
  assert(config.hostPlanFile === path.join(plan.scratchRoot, "plan.json") &&
    same(config.candidate, plan.candidate) && config.archiveSha256 === receipt.archive.sha256 &&
    same(config.invocation, plan.invocation) &&
    config.origin === target.publicOrigin && config.mount === target.mount &&
    config.installationId === target.installationId && config.projectId === target.projectId &&
    config.hostId === target.hostId && config.tenantId === target.tenantId && config.teamObjectId === target.teamObjectId &&
    config.actors.requester.principalObjectId === plan.actors.requester &&
    config.actors.holder.principalObjectId === plan.actors.holder &&
    config.actors.denied.principalObjectId === plan.actors.denied &&
    config.actors.noTeam.principalObjectId === plan.actors.denied &&
    config.actors.administrator.principalObjectId === plan.actors.dashboardAdmin,
    "G08_PACKAGE_RESERVATION_BINDING_REQUIRED");
  return sha(planRaw);
}

async function main(argv = process.argv.slice(2)) {
  const allowed = new Set(["--phase", "--config", "--out", "--private-out", "--confirm-producer-writes", "--confirm-logout",
    "--observe-restart", "--restart-timeout-ms"]);
  const flags = new Set(["--confirm-producer-writes", "--confirm-logout", "--observe-restart"]), options = {};
  for (let at = 0; at < argv.length; at++) {
    const key = argv[at]; assert(allowed.has(key) && !Object.hasOwn(options, key), "CLOSED_ARGUMENTS_REQUIRED");
    options[key] = flags.has(key) ? true : argv[++at];
    assert(options[key] !== undefined, "ARGUMENT_VALUE_REQUIRED");
  }
  assert(process.platform === "linux" && process.arch === "x64" && Number(process.versions.node.split(".")[0]) >= 20, "NODE20_LINUX_X64_REQUIRED");
  assert(typeof options["--out"] === "string" && typeof options["--private-out"] === "string" &&
    options["--out"] !== options["--private-out"], "DISTINCT_PRIVATE_OUTPUTS_REQUIRED");
  for (const file of [options["--out"], options["--private-out"]]) {
    assert(path.isAbsolute(file) && path.normalize(file) === file && !fs.existsSync(file), "FRESH_OUTPUT_REQUIRED");
    const parent = path.dirname(file), directory = fs.lstatSync(parent);
    assert(directory.isDirectory() && directory.uid === process.getuid() && (directory.mode & 0o077) === 0 &&
      fs.realpathSync(parent) === parent, "PRIVATE_OUTPUT_ROOT");
  }
  const config = validateConfig(strictJson(privateRead(options["--config"])));
  const hostPlanSha256 = await bindInstalledPlan(config);
  const result = await runPhase(config, options["--phase"], {
    confirmProducerWrites: options["--confirm-producer-writes"] === true,
    confirmLogout: options["--confirm-logout"] === true, observeRestart: options["--observe-restart"] === true,
    ...(options["--restart-timeout-ms"] ? { restartTimeoutMs: Number(options["--restart-timeout-ms"]) } : {}),
  });
  assert(typeof options["--private-out"] === "string" && typeof options["--out"] === "string", "DISTINCT_PRIVATE_OUTPUTS_REQUIRED");
  writePrivate(options["--private-out"], result.privateDetails);
  const publicReceipt = { ...result.receipt, hostPlanSha256, privateEvidenceSha256: sha(JSON.stringify(result.privateDetails) + "\n") };
  writePrivate(options["--out"], publicReceipt);
  process.stdout.write(JSON.stringify(publicReceipt) + "\n");
  process.exitCode = publicReceipt.status === "PASS" ? 0 : 1;
}
module.exports = { CONTRACT, PHASES, ROSTER, LEGACY_MAP, ADDITIONS, strictJson, privateRead, writePrivate, validateConfig,
  target, sendHttps, json, safe, contextRoute, selector, stampOk, noBusiness, refusal, runPhase };
if (require.main === module) main().catch(() => {
  process.stdout.write(JSON.stringify({ schema: "sf.az02.teams-proof.v2", status: "BLOCKED",
    reason: "OWNER_INPUT_OR_EXECUTION_PRECONDITION_UNMET", liveQualified: false, installedTeamsProof: false,
    g08Closed: false, finalCandidate: false }) + "\n");
  process.exitCode = 2;
});
