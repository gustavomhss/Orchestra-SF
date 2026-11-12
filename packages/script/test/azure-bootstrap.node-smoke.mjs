// Mock I/O reproduces control flow, not physical Azure evidence.
// Safe expectations fail on the current candidate. lsblk TYPE "part" is an
// incomplete check when signature and PTTYPE are absent, not a claim that
// normal GPT disks always bypass the partition refusal.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const uuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const staleUuid = "11111111-2222-3333-4444-555555555555";
const names = ["wipefs", "blkid", "lsblk", "mkfs.ext4", "udevadm", "findmnt", "mount", "umount", "useradd", "id", "install", "caddy", "systemctl", "getent", "chown"];

const mock = String.raw`#!/bin/bash
set -u
name=$(basename "$0")
{ printf '%s' "$name"; for arg in "$@"; do printf $'\t%s' "$arg"; done; printf $'\n'; } >> "$ORCHESTRA_AUDIT_LOG"
case "$name" in
  wipefs)
    for arg in "$@"; do [[ "$arg" == --no-act ]] && exit 0; done
    exit 97 ;;
  useradd) exit 97 ;;
  mkfs.ext4|mount|umount|udevadm|systemctl|caddy|getent|chown) exit 97 ;;
  id) exit 1 ;;
  lsblk)
    [[ "$ORCHESTRA_AUDIT_MODE" == partition-child ]] && printf $'disk\npart\n' || printf $'disk\n'
    exit 0 ;;
  blkid)
    tag=""; prev=""
    for arg in "$@"; do [[ "$prev" == -s ]] && tag=$arg; prev=$arg; done
    [[ "$ORCHESTRA_AUDIT_MODE" == partition-child || "$ORCHESTRA_AUDIT_MODE" == stale-fstab ]] && exit 2
    last=""; for arg in "$@"; do last=$arg; done
    case "$tag" in
      TYPE) printf 'ext4' ;;
      LABEL) printf 'orchsf-data' ;;
      PTTYPE) exit 2 ;;
      UUID)
        [[ "$last" == "$ORCHESTRA_AUDIT_DEVICE" || "$last" == "$ORCHESTRA_AUDIT_FOREIGN" ]] || exit 97
        printf '%s' "$ORCHESTRA_AUDIT_UUID" ;;
      *) exit 2 ;;
    esac
    exit 0 ;;
  findmnt)
    [[ "$ORCHESTRA_AUDIT_MODE" == duplicate-uuid || "$ORCHESTRA_AUDIT_MODE" == known ]] || exit 1
    prev=""
    for arg in "$@"; do [[ "$prev" == --mountpoint && "$arg" != "$ORCHESTRA_AUDIT_STATE" ]] && exit 97; prev=$arg; done
    source_path=$ORCHESTRA_AUDIT_DEVICE
    [[ "$ORCHESTRA_AUDIT_MODE" == duplicate-uuid ]] && source_path=$ORCHESTRA_AUDIT_FOREIGN
    for arg in "$@"; do
      [[ "$arg" == SOURCE ]] && printf '%s\n' "$source_path" && exit 0
      [[ "$arg" == TARGET ]] && printf '%s\n' "$ORCHESTRA_AUDIT_STATE" && exit 0
    done
    exit 0 ;;
  install)
    for arg in "$@"; do
      case "$arg" in
        -*|0*) ;;
        "$ORCHESTRA_AUDIT_ROOT"|"$ORCHESTRA_AUDIT_ROOT"/*) ;;
        *) printf $'install outside temp: %s\n' "$arg" >&2; exit 97 ;;
      esac
    done
    exit 0 ;;
  *) printf $'unmocked %s\n' "$name" >&2; exit 97 ;;
esac
`;

const shim = String.raw`#!/bin/bash
set -u
name=$(basename "$0")
{ printf '%s' "$name"; for arg in "$@"; do printf $'\t%s' "$arg"; done; printf $'\n'; } >> "$ORCHESTRA_AUDIT_LOG"
root=$ORCHESTRA_AUDIT_ROOT
enforce() {
  local arg p
  for arg in "$@"; do
    [[ "$arg" == *..* || "$arg" == *"/etc/fstab"* ]] && exit 97
    case "$arg" in
      --reference=*|--files-from=*) p=$(cut -d= -f2- <<<"$arg"); [[ "$p" == "$root" || "$p" == "$root"/* ]] || exit 97 ;;
      /*)
        if [[ "$arg" != "$root" && "$arg" != "$root"/* ]]; then
          [[ -e "$arg" || "$arg" == /etc/* || "$arg" == /dev/* || "$arg" == /var/* || "$arg" == /opt/* ]] && exit 97
        fi ;;
    esac
  done
}
case "$name" in
  sync) enforce "$@"; exit 0 ;;
  mv)
    enforce "$@"
    dest=
    for arg in "$@"; do [[ "$arg" == -* ]] || dest=$arg; done
    [[ "$dest" == "$ORCHESTRA_FSTAB" && "$ORCHESTRA_MV_FAIL" == before ]] && exit 97
    /usr/bin/mv "$@"
    status=$?
    [[ "$dest" == "$ORCHESTRA_FSTAB" && "$ORCHESTRA_MV_FAIL" == after ]] && exit 97
    exit "$status" ;;
  cp|awk|chmod|chown|mktemp|rm) enforce "$@"; PATH=/usr/bin:/bin command "$name" "$@" ;;
  *) printf $'unmocked %s\n' "$name" >&2; exit 97 ;;
esac
`;

function tempRoot() {
  return process.env.RUNNER_TEMP || process.env.TMPDIR || "/tmp";
}

function requireHosted() {
  assert.equal(process.env.GITHUB_ACTIONS, "true");
  assert.equal(process.platform, "linux");
  assert.equal(process.arch, "x64");
}

function patch(source, device, state, fstab) {
  const pairs = [
    ["device=/dev/disk/azure/scsi1/lun0", `device=${device}`],
    ['[[ -b "$device" ]]', '[[ -e "$device" ]]'],
    ["state=/var/lib/orchestra-sf", `state=${state}`],
    ["/etc/fstab", fstab],
  ];
  let script = source;
  for (const [from, to] of pairs) {
    if (!script.includes(from)) throw new Error(`anchor missing: ${from}`);
    script = script.replaceAll(from, to);
  }
  if (script.includes("/etc/fstab") || script.includes('[[ -b "$device" ]]') || script.includes("/var/lib/orchestra-sf") || script.includes("/dev/disk/azure/scsi1/lun0")) {
    throw new Error("host path replacement incomplete");
  }
  return script;
}

function readCalls(log) {
  if (!fs.existsSync(log)) return [];
  return fs.readFileSync(log, "utf8").split("\n").filter(Boolean).map((line) => line.split("\t"));
}

function detail(title, ctx) {
  const calls = ctx.calls.map((call) => call.join(" ")).join("\n");
  return [
    title,
    "limitation: mock I/O reproduces control flow, not physical Azure evidence",
    `status=${ctx.result.status} signal=${ctx.result.signal ?? ""} error=${ctx.result.error?.message ?? ""}`,
    `stderr:\n${ctx.result.stderr ?? ""}`,
    `stdout:\n${ctx.result.stdout ?? ""}`,
    `calls:\n${calls}`,
  ].join("\n");
}

function assertDoesNotFormat(calls, message) {
  assert.deepEqual(calls.filter((call) => call[0] === "mkfs.ext4"), [], message);
}

function extractReplaceFstab(source) {
  const start = source.indexOf("replace_fstab() (");
  assert.ok(start >= 0, "missing helper replace_fstab() (");
  const lines = source.slice(start).split("\n");
  const close = lines.findIndex((line, index) => index > 0 && line === ")");
  assert.ok(close > 0, "missing helper replace_fstab() ( close");
  return lines.slice(0, close + 1).join("\n");
}

function withCase(mode, check) {
  let root = "";
  try {
    root = fs.mkdtempSync(`${tempRoot()}/azure-audit-`);
    const device = `${root}/device`;
    const foreign = `${root}/foreign`;
    const state = `${root}/state`;
    const fstab = `${root}/fstab`;
    const bin = `${root}/bin`;
    const log = `${root}/calls.log`;
    fs.mkdirSync(bin);
    fs.mkdirSync(state);
    fs.writeFileSync(device, "");
    fs.writeFileSync(foreign, "");
    const initialFstab = mode === "stale-fstab" ? `UUID=${staleUuid} ${state} ext4 defaults 0 2\n` : "";
    fs.writeFileSync(fstab, initialFstab);
    fs.writeFileSync(`${bin}/mock-cmd`, mock, { mode: 0o755 });
    for (const name of names) fs.symlinkSync("mock-cmd", `${bin}/${name}`);
    const source = fs.readFileSync(new URL("../../../infra/azure/bootstrap.sh", import.meta.url), "utf8");
    fs.writeFileSync(`${root}/bootstrap.sh`, patch(source, device, state, fstab), { mode: 0o755 });
    const result = spawnSync("bash", [`${root}/bootstrap.sh`, "audit.example.com"], {
      timeout: 5000,
      encoding: "utf8",
      env: {
        PATH: `${bin}:/usr/bin:/bin`,
        TMPDIR: root,
        HOME: root,
        LANG: "C",
        LC_ALL: "C",
        ORCHESTRA_AUDIT_LOG: log,
        ORCHESTRA_AUDIT_MODE: mode,
        ORCHESTRA_AUDIT_UUID: uuid,
        ORCHESTRA_AUDIT_DEVICE: device,
        ORCHESTRA_AUDIT_FOREIGN: foreign,
        ORCHESTRA_AUDIT_STATE: state,
        ORCHESTRA_AUDIT_ROOT: root,
      },
    });
    check({ root, device, foreign, state, fstab, initialFstab, result, calls: readCalls(log) });
  } finally {
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
}

function assertRenamed(ctx, contents) {
  const renameAt = ctx.calls.findIndex((call) => call[0] === "mv" && call[call.length - 1] === ctx.fstab);
  assert.ok(renameAt > 0, detail("replace_fstab did not rename onto fstab", ctx));
  const nextPath = ctx.calls[renameAt][ctx.calls[renameAt].length - 2];
  assert.equal(String(nextPath).includes(".next."), true, detail("rename source is the staged next file", ctx));
  assert.deepEqual(ctx.calls[renameAt - 1], ["sync", "-f", nextPath], detail("sync -f of that same next path is the call immediately before rename onto fstab", ctx));
  const referenced = ctx.calls.some((call) => call[0] === "chown" && call.includes(nextPath) && call.some((arg, index) => arg === `--reference=${ctx.fstab}` || (arg === "--reference" && call[index + 1] === ctx.fstab)));
  assert.equal(referenced, true, detail("logged chown --reference of the live fstab onto the staged next file", ctx));
  const preserved = ctx.calls.some((call) => call[0] === "cp" && call.includes("--preserve=mode,ownership") && call[call.length - 2] === ctx.fstab && String(call[call.length - 1]).includes(".backup."));
  assert.equal(preserved, true, detail("logged cp --preserve=mode,ownership from fstab to the backup stage", ctx));
  assert.equal(fs.readFileSync(ctx.fstab, "utf8"), contents, detail("fstab contents", ctx));
  assert.equal(fs.statSync(ctx.fstab).mode & 0o777, 0o640, detail("observed fstab mode is 0640; same-user stat is not the preservation request", ctx));
  assert.equal(fs.statSync(ctx.fstab).uid, ctx.uid, detail("observed fstab uid; same-user stat is not the preservation request", ctx));
  assert.equal(fs.statSync(ctx.fstab).gid, ctx.gid, detail("observed fstab gid; same-user stat is not the preservation request", ctx));
  const backup = `${ctx.fstab}.orchestra-sf.bak`;
  const backupStat = fs.statSync(backup);
  assert.equal(fs.readFileSync(backup, "utf8"), ctx.oldText, detail("backup contents", ctx));
  assert.equal(backupStat.mode & 0o777, ctx.mode, detail("observed backup mode; preservation request is the logged cp --preserve", ctx));
  assert.equal(backupStat.uid, ctx.uid, detail("observed backup uid; same-user stat is not the preservation request", ctx));
  assert.equal(backupStat.gid, ctx.gid, detail("observed backup gid; same-user stat is not the preservation request", ctx));
  const published = `${ctx.fstab.slice(ctx.root.length + 1)}.orchestra-sf.bak`;
  const residue = fs.readdirSync(ctx.root).filter((name) => name !== published && (name.includes(".backup.") || name.includes(".next.")));
  assert.deepEqual(residue, [], detail("staging residue", ctx));
}

function withReplace(failAt, check) {
  let root = "";
  try {
    root = fs.mkdtempSync(`${tempRoot()}/azure-replace-`);
    const fstab = `${root}/fstab`;
    const candidate = `${root}/candidate`;
    const bin = `${root}/bin`;
    const log = `${root}/calls.log`;
    const oldText = `UUID=${staleUuid} ${root}/old ext4 defaults 0 2\n`;
    const newText = `UUID=${uuid} ${root}/new ext4 defaults 0 2\n`;
    fs.mkdirSync(bin);
    fs.writeFileSync(fstab, oldText);
    fs.chmodSync(fstab, 0o640);
    fs.writeFileSync(candidate, newText);
    fs.chmodSync(candidate, 0o600);
    const before = fs.statSync(fstab);
    fs.writeFileSync(`${bin}/shim`, shim, { mode: 0o755 });
    for (const name of ["mv", "sync", "cp", "awk", "chmod", "chown", "mktemp", "rm"]) fs.symlinkSync("shim", `${bin}/${name}`);
    const fn = extractReplaceFstab(fs.readFileSync(new URL("../../../infra/azure/bootstrap.sh", import.meta.url), "utf8"));
    fs.writeFileSync(`${root}/replace.sh`, `#!/bin/bash\nset -euo pipefail\nfstab=$1\n${fn}\nreplace_fstab "$2"\n`, { mode: 0o755 });
    const result = spawnSync("bash", [`${root}/replace.sh`, fstab, candidate], {
      timeout: 5000,
      encoding: "utf8",
      cwd: root,
      env: {
        PATH: `${bin}:/usr/bin:/bin`, TMPDIR: root, HOME: root, LANG: "C", LC_ALL: "C",
        ORCHESTRA_AUDIT_LOG: log, ORCHESTRA_AUDIT_ROOT: root, ORCHESTRA_FSTAB: fstab, ORCHESTRA_MV_FAIL: failAt,
      },
    });
    check({ root, fstab, oldText, newText, mode: before.mode & 0o777, uid: before.uid, gid: before.gid, result, calls: readCalls(log) });
  } finally {
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
}

test("kernel part child refuses without mkfs", () => {
  requireHosted();
  withCase("partition-child", (ctx) => {
    assertDoesNotFormat(ctx.calls, detail(
      "kernel partition mapping is present (lsblk TYPE part, not partition) while wipefs and PTTYPE are absent. Safe behavior refuses and does not format. The candidate grep for partition reaches mkfs.",
      ctx,
    ));
    assert.equal(ctx.result.status, 1, detail("expected partition refusal", ctx));
    assert.match(ctx.result.stderr ?? "", /refusing partitioned data disk/, detail("expected partition refusal", ctx));
  });
});

test("duplicate uuid on a different block device rejects before fstab and useradd", () => {
  requireHosted();
  withCase("duplicate-uuid", (ctx) => {
    assert.notEqual(fs.realpathSync(ctx.device), fs.realpathSync(ctx.foreign));
    const mountCheck = ctx.calls.some((call) => call[0] === "findmnt" && call.includes("--mountpoint") && call.includes(ctx.state));
    assert.equal(mountCheck, true, detail("mount check did not run", ctx));
    assertDoesNotFormat(ctx.calls, detail(
      "matching ext4 TYPE and label orchsf-data keeps mkfs absent. Foreign UUID rejection stands when the target UUID is the same. This case is the refusal, separate from a finished bootstrap.",
      ctx,
    ));
    const fstab = fs.readFileSync(ctx.fstab, "utf8");
    const useradd = ctx.calls.filter((call) => call[0] === "useradd");
    assert.deepEqual(
      { fstab, useradd },
      { fstab: "", useradd: [] },
      detail("safe behavior rejects a different canonical block device before fstab write or account creation when clone/restore UUIDs match", ctx),
    );
    assert.equal(ctx.result.status, 1, detail("expected foreign device refusal", ctx));
  });
});

test("known ext4 label is preserved and useradd guard is reached", () => {
  requireHosted();
  withCase("known", (ctx) => {
    assertDoesNotFormat(ctx.calls, detail(
      "matching ext4 TYPE and label orchsf-data keeps mkfs absent. Reaching the useradd guard is label preservation, separate from a finished bootstrap.",
      ctx,
    ));
    const mountCheck = ctx.calls.some((call) => call[0] === "findmnt" && call.includes("--mountpoint") && call.includes(ctx.state));
    const sourceCheck = ctx.calls.some((call) => call[0] === "findmnt" && call.includes("SOURCE"));
    const targetCheck = ctx.calls.some((call) => call[0] === "findmnt" && call.includes("TARGET"));
    assert.equal(mountCheck && sourceCheck && targetCheck, true, detail("matching mount check did not run", ctx));
    assert.ok(ctx.calls.some((call) => call[0] === "useradd"), detail("useradd guard was not reached", ctx));
    assert.equal(ctx.result.status, 97, detail("useradd guard exits 97", ctx));
  });
});

test("stale fstab rejects conflicting state mount before mkfs", () => {
  requireHosted();
  withCase("stale-fstab", (ctx) => {
    const mkfs = ctx.calls.filter((call) => call[0] === "mkfs.ext4");
    const fstab = fs.readFileSync(ctx.fstab, "utf8");
    assert.deepEqual(
      { mkfs, fstab },
      { mkfs: [], fstab: ctx.initialFstab },
      detail("safe behavior rejects a conflicting state fstab before mkfs. Blank probes with lsblk TYPE disk only still must not format.", ctx),
    );
    assert.equal(ctx.result.status, 1, detail("expected stale fstab refusal", ctx));
    assert.match(ctx.result.stderr ?? "", /fstab already mounts/, detail("expected stale fstab refusal", ctx));
  });
});

test("replace_fstab failure before rename keeps old fstab", () => {
  requireHosted();
  withReplace("before", (ctx) => {
    assert.notEqual(ctx.result.status, 0, detail("injected rename failure must surface", ctx));
    assertRenamed(ctx, ctx.oldText);
  });
});

test("replace_fstab failure after rename keeps new fstab", () => {
  requireHosted();
  withReplace("after", (ctx) => {
    assert.notEqual(ctx.result.status, 0, detail("injected rename failure must surface", ctx));
    assertRenamed(ctx, ctx.newText);
  });
});

test("replace_fstab installs the rendered candidate", () => {
  requireHosted();
  withReplace("", (ctx) => {
    assert.equal(ctx.result.status, 0, detail("replace_fstab success", ctx));
    assertRenamed(ctx, ctx.newText);
  });
});
