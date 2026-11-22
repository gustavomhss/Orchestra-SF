"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  PHASES, ROSTER, LEGACY_MAP, ADDITIONS, strictJson, privateRead, writePrivate, validateConfig,
  target, stampOk, noBusiness, runPhase,
} = require("./az02-proof.cjs");

const uuid = (n) => n.repeat(8) + "-" + n.repeat(4) + "-4" + n.repeat(3) + "-8" + n.repeat(3) + "-" + n.repeat(12);
const root = "/private-controlled-inputs";
function configuration() {
  return {
    schema: "sf.az02.teams-plan.v2", origin: "https://controlled.example.test", mount: "/sucafina",
    tenantId: uuid("1"), clientId: uuid("2"), installationId: "controlled-installation",
    projectId: "controlled-placement", hostId: "controlled-host", teamObjectId: uuid("4"),
    foreignTeamObjectId: uuid("5"), teamDirectory: "members", hostPlanFile: root + "/plan.json",
    candidate: { sha: "a".repeat(40), tree: "b".repeat(40) }, archiveSha256: "c".repeat(64),
    invocation: { id: "d".repeat(32), runId: "12345", runAttempt: "1", workflowSha: "e".repeat(40) },
    actors: {
      requester: { principalObjectId: uuid("3"), cookieFile: root + "/requester.cookie" },
      holder: { principalObjectId: uuid("6"), cookieFile: root + "/holder.cookie" },
      denied: { principalObjectId: uuid("7"), cookieFile: root + "/denied.cookie" },
      noTeam: { principalObjectId: uuid("7"), cookieFile: root + "/noTeam.cookie" },
      administrator: { principalObjectId: uuid("8"), cookieFile: root + "/administrator.cookie" },
    },
    isolated: { approvedForNegativeWrites: true, requestId: "PR-0001",
      cas409BodyFile: root + "/cas.json", validation422BodyFile: root + "/invalid.json" },
  };
}
function response(status, value, extra = {}) {
  return { status, headers: { "cache-control": "no-store", "content-type": "application/json", ...extra },
    body: value === undefined ? "" : JSON.stringify(value) };
}
function context(config, role, teams = "ready", hostId = config.hostId) {
  const principal = { tenantId: config.tenantId, principalObjectId: config.actors[role].principalObjectId };
  const profile = { installationId: config.installationId, tenantId: config.tenantId, teamObjectId: config.teamObjectId };
  const accessRevision = "controlled-access-" + role;
  const stamp = { installationId: config.installationId, projectId: config.projectId, hostId,
    principalRef: principal.principalObjectId, policyVersion: "controlled-policy", accessRevision,
    ...(teams === "ready" ? { team: { owner: { profile, principal }, revisions: { configRevision: 4, accessRevision } } } : {}) };
  return response(200, { status: "ok", value: {
    contractRevision: "sf-team-profile/1", authMode: "microsoft", stamp,
    profile: { contractRevision: "sf-team-profile/1", status: "authenticated", installationId: config.installationId,
      principal, accessRevision, administration: { status: role === "administrator" ? "available" : "denied" },
      teams: teams === "ready" ? { status: teams, choices: [{ profile, displayName: "Controlled Team" }], selected: profile, configRevision: 4 } : { status: teams } },
    destinations: [], availability: [],
  } }, { "x-sf-contract-revision": "sf-team-profile/1", "x-sf-access-revision": accessRevision });
}
function fixture(config = configuration(), mutate) {
  const values = { requester: "a", holder: "b", denied: "c", noTeam: "c", administrator: "d" };
  const cookies = Object.fromEntries(Object.entries(values).map(([role, char]) => [role, "__Secure-sucafina_012345abcdef_session=" + char.repeat(64)]));
  const bodies = {
    [config.isolated.cas409BodyFile]: JSON.stringify({ page: "Requests", action: "save", id: "PR-0001", version: 99, values: { pr: { title: "Do not publish" } } }),
    [config.isolated.validation422BodyFile]: JSON.stringify({ page: "Requests", action: "save", id: "PR-0001", version: 7, values: { constructor: "invalid original form field" } }),
  };
  const state = { requests: [], loggedOut: false, revoked: false, clock: 0, restarted: false, restartEnabled: true, probes: 0 };
  const roleFor = (headers) => Object.keys(cookies).find((role) => cookies[role] === headers.Cookie);
  async function original(method, route, headers, body) {
    const url = new URL(config.origin + route), role = roleFor(headers);
    const cross = headers.Origin && headers.Origin !== config.origin || headers["Sec-Fetch-Site"] === "cross-site";
    if (url.pathname.endsWith("/api/ui/context")) {
      const keys = [...url.searchParams.keys()];
      const required = ["contractRevision", "installationId", "tenantId", "hostId", "kind"];
      if (cross || required.some((key) => !url.searchParams.has(key)) ||
          keys.some((key) => ![...required, "teamObjectId"].includes(key) || url.searchParams.getAll(key).length !== 1) ||
          url.searchParams.get("installationId") !== config.installationId ||
          url.searchParams.get("tenantId") !== config.tenantId ||
          url.searchParams.get("hostId") !== (state.restarted ? "fresh-controlled-host" : config.hostId)) return response(400);
      if (!role || state.loggedOut && role === "requester") return response(401, { status: "unauthenticated" });
      const teamState = role === "denied" ? url.searchParams.get("kind") === "team" ? "revoked" : "no-teams" :
        role === "administrator" ? "no-teams" : state.revoked ? "revoked" : "ready";
      return context(config, role, teamState, state.restarted ? "fresh-controlled-host" : config.hostId);
    }
    if (url.pathname.endsWith("/auth/logout")) {
      if (cross || headers.Origin !== config.origin) return response(403, { status: "denied" });
      state.loggedOut = true;
      return response(204, undefined, { "set-cookie": ["login", "session"].map((name) =>
        "__Secure-sucafina_012345abcdef_" + name + "=; Max-Age=0; Secure; HttpOnly; SameSite=Lax; Path=/sucafina") });
    }
    if (url.pathname.endsWith("/auth/login")) {
      const q = new URLSearchParams({ client_id: config.clientId, response_type: "code", response_mode: "query",
        redirect_uri: config.origin + config.mount + "/auth/callback",
        scope: "openid profile offline_access User.Read Team.ReadBasic.All TeamMember.Read.All",
        state: "1".repeat(64), nonce: "2".repeat(64), code_challenge: "x".repeat(43), code_challenge_method: "S256" });
      return response(303, undefined, { location: "https://login.microsoftonline.com/" + config.tenantId + "/oauth2/v2.0/authorize?" + q,
        "set-cookie": ["__Secure-sucafina_012345abcdef_login=" + "3".repeat(64) + "; Secure; HttpOnly; SameSite=Lax; Path=/sucafina"] });
    }
    if (url.pathname.endsWith("/auth/callback")) return response(403, { status: "denied" });
    if (url.pathname.endsWith("/api/ui/team-profiles")) return response(200, { status: "ok", profiles: [] });
    if (url.pathname.endsWith("/api/ui/pages/CAP25")) {
      const selected = strictJson(headers["x-sf-team-profile"]);
      if (!role || ["denied", "administrator"].includes(role) || state.revoked || selected.profile.teamObjectId !== config.teamObjectId)
        return response(403, { status: "denied" });
      return response(200, { status: "ok", context: JSON.parse(context(config, "requester").body).value.stamp,
        value: { capabilityId: "CAP25", versions: { "requests:PR-0001": { version: 7, by: config.actors.requester.principalObjectId } },
          data: { requests: [{ number: "PR-0001", status: "draft", pr: { title: "Original private request" } }] } } });
    }
    if (url.pathname === config.mount + "/teams/" + config.teamObjectId + "/procurement" && method === "POST") {
      const command = strictJson(body); return response(command.version === 99 ? 409 : 422, { ok: false });
    }
    if (route === "/api/sucafina/installations?select=current&contractRevision=sf-team-profile%2F1")
      return response(200, { installations: [{ contractRevision: "sf-team-profile/1", authMode: "microsoft",
        installationId: config.installationId, tenantId: config.tenantId, projectId: config.projectId,
        hostId: "fresh-controlled-host", publicOrigin: config.origin, mount: config.mount }] });
    throw new Error("Unexpected controlled request");
  }
  const io = {
    read(file) {
      const role = Object.keys(config.actors).find((key) => config.actors[key].cookieFile === file);
      if (role) return cookies[role];
      assert(Object.hasOwn(bodies, file)); return bodies[file];
    },
    async send(method, route, headers = {}, body) {
      state.requests.push({ method, route, headers, body });
      const result = await original(method, route, headers, body);
      return mutate ? mutate({ method, route, headers, body, result, state }) ?? result : result;
    },
    now: () => state.clock,
    async wait(ms) { state.clock += ms; state.restarted = state.restartEnabled; },
    async observe() {
      state.probes++;
      return { pid: state.restarted ? 901 : 900, startTicks: state.restarted ? "200" : "100", bootId: "controlled-boot",
        executable: "/opt/orchestra-sf/releases/" + config.candidate.sha + "/bin/orchestra", factorySha256: "f".repeat(64) };
    },
  };
  return { config, cookies, bodies, state, io };
}

test("the complete CHANGE_CONTRACT inventory retains 32 originals and adds five explicit Team obligations", () => {
  assert.deepEqual(PHASES, ["preflight", "actors", "producer", "after-revoke", "logout", "after-restart"]);
  assert.deepEqual(Object.values(ROSTER).map((entries) => entries.length), [16, 14, 2, 2, 2, 1]);
  assert.equal(new Set(Object.values(ROSTER).flat()).size, 37);
  assert.deepEqual(LEGACY_MAP, { BIND_projectId: "BIND_tenantId", AUTH_BIND_projectId: "AUTH_BIND_tenantId" });
  assert.equal(ADDITIONS.length, 5);
});

for (const phase of PHASES) test("controlled transport exercises every " + phase + " obligation without producing LIVE evidence", async () => {
  const f = fixture();
  f.state.revoked = phase === "after-revoke";
  f.state.loggedOut = phase === "after-restart";
  const result = await runPhase(f.config, phase, { confirmProducerWrites: true, confirmLogout: true, observeRestart: true }, f.io);
  assert.equal(result.receipt.status, "PASS", JSON.stringify(result.receipt.cases));
  assert.equal(result.receipt.counts.total, ROSTER[phase].length);
  assert.equal(result.receipt.counts.skipped, 0);
  assert.deepEqual(result.receipt.cases.map((entry) => entry.id), ROSTER[phase]);
  assert.equal(result.receipt.proofClass, "CONTROLLED_TRANSPORT");
  for (const field of ["liveQualified", "installedTeamsProof", "g08Closed", "finalCandidate"]) assert.equal(result.receipt[field], false);
  const publicText = JSON.stringify(result.receipt);
  for (const secret of [...Object.values(f.cookies), ...Object.values(f.config.actors).map((actor) => actor.principalObjectId),
    f.config.origin, f.config.hostId, "Original private request", "controlled-access-requester"])
    assert(!publicText.includes(secret), "Public receipt leaked a private observation");
});

for (const [name, alter] of [
  ["principal", (v) => { v.stamp.principalRef = uuid("9"); }],
  ["tenant", (v) => { v.profile.principal.tenantId = uuid("9"); }],
  ["Team", (v) => { v.stamp.team.owner.profile.teamObjectId = uuid("9"); }],
  ["host", (v) => { v.stamp.hostId = "foreign-host"; }],
  ["numeric revision coercion", (v) => { v.stamp.team.revisions.configRevision = "4"; }],
  ["access revision", (v) => { v.stamp.team.revisions.accessRevision = "forged"; }],
  ["contract", (v) => { v.contractRevision = "sf-native-ui/1"; }],
]) test("an observed " + name + " mismatch fails exact original Team admission", () => {
  const config = configuration(), r = context(config, "requester");
  assert.equal(stampOk(r, config, "requester"), true);
  const body = strictJson(r.body); alter(body.value); r.body = JSON.stringify(body);
  assert.equal(stampOk(r, config, "requester"), false);
});

test("no-Team and administration projections cannot carry a hidden business owner or destination", () => {
  const config = configuration(), r = context(config, "administrator", "no-teams");
  assert.equal(noBusiness(r, config, "administrator", "no-teams"), true);
  const value = strictJson(r.body);
  value.value.destinations.push({ capabilityId: "CAP25" });
  r.body = JSON.stringify(value);
  assert.equal(noBusiness(r, config, "administrator", "no-teams"), false);
});

test("producer uses the unchanged original body and exact original Team command; snapshots retain versionRecord objects", async () => {
  const f = fixture();
  const result = await runPhase(f.config, "producer", { confirmProducerWrites: true }, f.io);
  assert.equal(result.receipt.status, "PASS");
  const writes = f.state.requests.filter((entry) => entry.method === "POST");
  assert.equal(writes.length, 2);
  for (let index = 0; index < writes.length; index++) {
    const request = writes[index];
    assert.equal(request.route, "/sucafina/teams/" + f.config.teamObjectId + "/procurement");
    assert.equal(request.headers.Cookie, f.cookies.requester);
    assert.equal(request.headers.Origin, f.config.origin);
    assert.equal(strictJson(request.headers["x-sf-team-profile"]).profile.teamObjectId, f.config.teamObjectId);
    assert.equal(request.body, f.bodies[index === 0 ? f.config.isolated.cas409BodyFile : f.config.isolated.validation422BodyFile]);
  }
});

for (const [name, mutate] of [
  ["version integer substituted for the original versionRecord", (body) => { body.value.versions["requests:PR-0001"] = 7; }],
  ["foreign owner on CAP25", (body) => { body.context.principalRef = uuid("9"); }],
]) test("producer refuses " + name + " before any negative write", async () => {
  const f = fixture(configuration(), ({ route, result }) => {
    if (!route.includes("/api/ui/pages/CAP25")) return;
    const body = strictJson(result.body); mutate(body); return { ...result, body: JSON.stringify(body) };
  });
  await assert.rejects(runPhase(f.config, "producer", { confirmProducerWrites: true }, f.io));
  assert.equal(f.state.requests.filter((entry) => entry.method === "POST").length, 0);
});

for (const change of ["row", "version", "by"]) test("negative producer fails if " + change + " changes despite a refusal status", async () => {
  let wrote = false;
  const f = fixture(configuration(), ({ method, route, result }) => {
    if (method === "POST") wrote = true;
    if (wrote && route.includes("/api/ui/pages/CAP25")) {
      const body = strictJson(result.body);
      if (change === "row") body.value.data.requests[0].pr.title = "Unexpected effect";
      else body.value.versions["requests:PR-0001"][change] = change === "version" ? 8 : "changed-actor";
      return { ...result, body: JSON.stringify(body) };
    }
  });
  const result = await runPhase(f.config, "producer", { confirmProducerWrites: true }, f.io);
  assert.equal(result.receipt.status, "FAIL");
  assert(result.receipt.cases.every((entry) => entry.status === "FAIL"));
});

test("missing isolated write approval blocks before any HTTP observation or mutation", async () => {
  const f = fixture();
  await assert.rejects(runPhase(f.config, "producer", {}, f.io), /PRODUCER_APPROVAL_REQUIRED/);
  assert.equal(f.state.requests.length, 0);
});

test("revocation checks the same original cookie for context and CAP25 and accepts no empty success", async () => {
  const f = fixture(configuration(), ({ route, result }) => route.includes("/api/ui/pages/CAP25") ? response(200, { status: "ok", value: [] }) : result);
  f.state.revoked = true;
  const result = await runPhase(f.config, "after-revoke", {}, f.io);
  assert.equal(result.receipt.status, "FAIL");
  assert.equal(result.receipt.cases[0].status, "PASS");
  assert.equal(result.receipt.cases[1].status, "FAIL");
  assert(f.state.requests.every((entry) => entry.headers.Cookie === f.cookies.requester));
});

test("logout replays the exact raw session cookie and rejects clearing another installation's cookies", async () => {
  const f = fixture(configuration(), ({ route, result }) => route.endsWith("/auth/logout") ?
    { ...result, headers: { ...result.headers, "set-cookie": result.headers["set-cookie"].map((entry) => entry.replace("012345abcdef", "fedcba543210")) } } : result);
  const result = await runPhase(f.config, "logout", { confirmLogout: true }, f.io);
  assert.equal(result.receipt.cases[0].status, "FAIL");
  assert.equal(result.receipt.cases[1].status, "PASS");
  assert.equal(f.state.requests[0].headers.Cookie, f.state.requests[1].headers.Cookie);
});

test("a manual restart receipt is not an observation and cannot enable the restart phase", async () => {
  const f = fixture();
  await assert.rejects(runPhase(f.config, "after-restart", { restartReceipt: { restartObserved: true } }, f.io), /OBSERVED_RESTART_REQUIRED/);
  await assert.rejects(runPhase(f.config, "after-restart", { observeRestart: true, restartReceipt: {} }, f.io), /OBSERVED_RESTART_REQUIRED/);
  assert.equal(f.state.requests.length, 0);
});

test("restart fails if the original service was not observed changing", async () => {
  const f = fixture(); f.state.loggedOut = true; f.state.restartEnabled = false;
  const result = await runPhase(f.config, "after-restart", { observeRestart: true, restartTimeoutMs: 2000 }, f.io);
  assert.equal(result.receipt.status, "FAIL");
  assert.equal(f.state.requests.filter((entry) => entry.route.startsWith("/api/sucafina")).length, 0);
});

test("restart uses fresh discovery host identity and exactly the revoked original cookie", async () => {
  const f = fixture(); f.state.loggedOut = true;
  const result = await runPhase(f.config, "after-restart", { observeRestart: true }, f.io);
  assert.equal(result.receipt.status, "PASS");
  assert.equal(f.state.requests.length, 3);
  assert.equal(f.state.requests[0].headers.Cookie, f.cookies.requester);
  assert.equal(f.state.requests[1].headers.Cookie, undefined);
  assert.equal(f.state.requests[2].headers.Cookie, f.cookies.requester);
  assert(new URL(f.config.origin + f.state.requests[2].route).searchParams.get("hostId") === "fresh-controlled-host");
});

test("errors cannot leak raw provider text, cookie, tenant or Request content to a public receipt", async () => {
  const f = fixture();
  f.io.send = async () => { throw new Error("secret " + f.cookies.requester + " " + f.config.tenantId); };
  const result = await runPhase(f.config, "actors", {}, f.io);
  assert.equal(result.receipt.status, "FAIL");
  const text = JSON.stringify(result.receipt);
  assert(!text.includes("secret"));
  assert(!text.includes(f.config.tenantId));
  assert(!text.includes(f.cookies.requester));
  assert(result.receipt.cases.filter((entry) => entry.observed === "OBSERVATION_ERROR").length > 0);
});

test("strict JSON refuses duplicate and escaped duplicate authority keys, trailing tokens and excessive nesting", () => {
  for (const raw of ['{"tenant":1,"tenant":2}', '{"tenant":1,"\\u0074enant":2}', '{"a":1} false',
    '{"a":1,}', "[1,]", "[".repeat(45) + "0" + "]".repeat(45)]) assert.throws(() => strictJson(raw));
  assert.deepEqual(strictJson('{"value":["x",true,null,-12.3e2]}'), { value: ["x", true, null, -1230] });
  assert.deepEqual(strictJson('{"constructor":"negative producer field"}'), { constructor: "negative producer field" });
});

test("credentials stay inside the exact configured HTTPS mount and discovery is credential-free", () => {
  const config = configuration();
  for (const origin of ["http://controlled.example.test", "https://controlled.example.test:444", "https://localhost", "https://127.0.0.1"])
    assert.throws(() => validateConfig({ ...config, origin }));
  for (const route of ["/different/path", "//foreign.example.test/sucafina/x", "/sucafina/../different", "/sucafina/x#secret"])
    assert.throws(() => target(config, route, true));
  assert.throws(() => target(config, "/api/sucafina/installations?select=current&contractRevision=sf-team-profile%2F1", true));
  assert.equal(target(config, "/sucafina/api/ui/context", true).origin, config.origin);
});

test("config cannot claim LIVE or omit immutable source/tree/tar/invocation binding", () => {
  const config = configuration();
  assert.throws(() => validateConfig({ ...config, liveQualified: true }));
  assert.throws(() => validateConfig({ ...config, restartReceipt: { restartObserved: true } }));
  for (const key of ["sha", "tree"]) assert.throws(() => validateConfig({ ...config, candidate: { ...config.candidate, [key]: "" } }));
  assert.throws(() => validateConfig({ ...config, archiveSha256: "" }));
  assert.throws(() => validateConfig({ ...config, invocation: { ...config.invocation, workflowSha: "" } }));
});

test("private files reject symlinks, hard links, exposed modes, oversized inputs and overwrite", () => {
  const directory = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "az02-private-controls-"));
  fs.chmodSync(directory, 0o700);
  const file = path.join(directory, "source.json");
  try {
    fs.writeFileSync(file, '{"controlled":true}', { mode: 0o600 });
    assert.equal(privateRead(file), '{"controlled":true}');
    assert.throws(() => privateRead(file, 2));
    fs.symlinkSync(file, path.join(directory, "link.json"));
    assert.throws(() => privateRead(path.join(directory, "link.json")));
    fs.linkSync(file, path.join(directory, "hard.json"));
    assert.throws(() => privateRead(file));
    fs.unlinkSync(path.join(directory, "hard.json"));
    fs.chmodSync(file, 0o644);
    assert.throws(() => privateRead(file));
    fs.chmodSync(file, 0o600);
    const output = path.join(directory, "receipt.json");
    writePrivate(output, { safe: true });
    assert.equal(fs.statSync(output).mode & 0o777, 0o600);
    assert.throws(() => writePrivate(output, { safe: false }));
    fs.chmodSync(directory, 0o755);
    assert.throws(() => privateRead(file));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  assert.equal(fs.existsSync(directory), false);
});
