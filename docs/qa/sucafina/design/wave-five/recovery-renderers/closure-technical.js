function buildSf613TechnicalClosure(preimage, ledger, input = {}) {
  const path = "docs/qa/sucafina/design/wave-five/technical-verification.json";
  const originalBlob = "4b19546f379d5b35047cf7e5bdb6bc8a7d943996";
  const inspectedSource = "9ba028b0d4d54317aea0d4df239047cbbdffdbe9";
  if (preimage.sha !== originalBlob || typeof preimage.content !== "string") throw new Error("Technical preimage mismatch");
  const old = JSON.parse(preimage.content), copy = value => JSON.parse(JSON.stringify(value));
  if (old.schemaVersion !== 2 || old.gates?.length !== 14 ||
    old.focusedRegressions?.length !== 16 || old.installedEvidence?.length !== 6)
    throw new Error("Unexpected historical matrix");
  const mode = input.mode ?? "draft";
  if (!["draft","qualified","merged"].includes(mode)) throw new Error("Unknown technical closure mode");
  const qualified = mode !== "draft", merged = mode === "merged";
  const sha = value => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
  const validPath = value => typeof value === "string" && /^[A-Za-z0-9_./-]+$/.test(value) &&
    !value.startsWith("/") && !value.split("/").some(part => part === "." || part === ".." || part === "");
  const fromLedger = key => {
    if (!validPath(key) || !Object.hasOwn(ledger,key) || !ledger[key] ||
      typeof ledger[key] !== "object" || Array.isArray(ledger[key])) throw new Error("Missing ledger object: " + key);
    return copy(ledger[key]);
  };
  const product = input.product ?? { commit:"{{QUALIFIED_PRODUCT}}", tree:"{{QUALIFIED_PRODUCT_TREE}}" };
  const effectiveDev = input.effectiveDev ?? "27f04c1cc723e42d5010b8f672a640b4792787ff";
  const finalHead = input.finalHead ?? null, merge = merged ? input.mergeReceipt : null;
  const keys = ["technical","analytics","collab","reviews","releaseTechnical","releaseAnalytics"];
  const cleanReceipts = {}, missingClean = [];
  const runtimes = {
    normal:{ version:"1.3.14", revision:"0d9b296af33f2b851fcbf4df3e9ec89751734ba4" },
    release:{ version:"1.4.1", revision:"4661e494f052c83c80dade1318e5710238340be6" }
  };
  for (const key of keys) {
    const ledgerPath = input.cleanReceiptPaths?.[key];
    if (!ledgerPath) { cleanReceipts[key] = null; missingClean.push(key); continue; }
    const receipt = fromLedger(ledgerPath);
    if (!sha(product.commit) || receipt.source !== product.commit)
      throw new Error("All clean receipts must test the exact same product P: " + key);
    if (!sha(receipt.snapshot) || !Number.isSafeInteger(receipt.run) || receipt.run <= 0)
      throw new Error("Missing actual CI identity: " + key);
    const runtime = key.startsWith("release") ? runtimes.release : runtimes.normal;
    if (qualified && (receipt.status !== "success" || receipt.qualification !== true || receipt.diagnostic === true ||
      receipt.runtime?.version !== runtime.version || receipt.runtime?.revision !== runtime.revision))
      throw new Error("Clean success/runtime receipt required: " + key);
    if (qualified && (key === "technical" || key === "releaseTechnical") &&
      (receipt.completeOriginalGateSet !== true || receipt.gateCount !== (key === "technical" ? 15 : 5)))
      throw new Error("Complete original 15/5 technical gate set required: " + key);
    if (qualified && key !== "technical" && key !== "releaseTechnical" &&
      (receipt.passed !== 2 || receipt.failed !== 0 || receipt.skipped !== 0 || receipt.retries !== 0 ||
        receipt.allCapturesReviewed !== true)) throw new Error("Complete original installed declarations required: " + key);
    cleanReceipts[key] = { ledgerPath, receipt };
  }
  if (qualified && (missingClean.length || !sha(product.commit) || !sha(product.tree) || !sha(effectiveDev)))
    throw new Error("Complete same-P qualification is not available");
  const supportKinds = ["campaign-negatives","sql-diagnostic","acl-focal","budget-probe","bi-trace","cpu-diagnostic"];
  const supportingEvidence = (input.supportingEvidence ?? []).map(item => {
    if (!supportKinds.includes(item.kind)) throw new Error("Unknown supporting evidence class");
    return { kind:item.kind, ledgerPath:item.ledgerPath, qualifiesWholeBlock:false, receipt:fromLedger(item.ledgerPath) };
  });
  const missingSupport = supportKinds.filter(kind => !supportingEvidence.some(item => item.kind === kind));
  if (qualified && missingSupport.length) throw new Error("Historical/supporting ledger coverage incomplete: " + missingSupport.join(","));
  const headEquivalence = input.headEquivalence ?? null;
  if (finalHead && (!sha(finalHead.commit) || !sha(finalHead.tree))) throw new Error("Invalid actual head");
  if (qualified && finalHead && finalHead.commit !== product.commit &&
    (headEquivalence?.status !== "VERIFIED" || headEquivalence.source !== product.commit || headEquivalence.head !== finalHead.commit))
    throw new Error("Later head requires explicit P-to-H equivalence");
  if (merged && (!finalHead || !merge || !sha(merge.commit) || !sha(merge.tree) ||
    merge.head !== finalHead.commit || merge.base !== effectiveDev || merge.treeMatches !== true ||
    !Array.isArray(merge.parents) || !merge.parents.includes(merge.head) || !merge.parents.includes(merge.base)))
    throw new Error("Observed M, H, base, parents and tree equivalence are required");
  const status = merged ? "MERGED_QUALIFIED" : qualified ? "QUALIFIED_PENDING_MERGE" : "PREPARATION_ONLY_NOT_QUALIFIED";
  const result = {
    schemaVersion:3, status, repository:"gustavomhss/Orchestra-SF", pullRequest:613,
    branch:input.branch ?? "sf613-finish",
    sources:{ product:copy(product), effectiveDev, inspectedSource, finalHead:copy(finalHead),
      headEquivalence:copy(headEquivalence), actualMerge:copy(merge) },
    environment:{ workflow:"test-ci", os:"ubuntu-24.04", channel:"prod", omni:"strict", localTests:false,
      expectedRuntimePairs:runtimes, actualRuntimeProof:"Each clean receipt records its observed version and revision." },
    qualification:{
      complete:qualified, sameProductRequired:true, originalGateCounts:{ technical:15, releaseTechnical:5 },
      requiredReceiptKeys:keys, missingCleanReceipts:missingClean,
      cleanReceipts, areaCount:15, routePatternCount:22, areas:"UI42-UI56",
      interpretation:"A clean receipt qualifies only its exact product and snapshot. All six final receipts must identify the same product P. Later H and actual merge M have separate observed identities."
    },
    supportingEvidence,
    supportingEvidenceCoverage:{ requiredKinds:supportKinds, missingKinds:missingSupport,
      interpretation:"Focused checks, budget controls, BI traces and CPU/SQL diagnostics retain their exact outcomes. They do not replace complete clean qualification or erase a prior failure." },
    history:{
      previousMatrix:{ repositoryPath:path, readAt:inspectedSource, blob:originalBlob, matrix:old },
      preservation:"The complete schema2 matrix is retained unchanged here, including its 14 gates, 16 focused regressions, six installed entries, source identities, pending deltas and historical acceptance."
    },
    externalReviews:copy(input.externalReviews ?? []),
    userAcceptance:"NOT_ASSERTED",
    mergeAuthorization:"USER_REQUESTED_COMPLETE_GREEN_MERGE",
    merged, inventoryAcceptedAndMergedAreas:merged ? 56 : 41,
    inventoryAcceptedAndMergedRoutePatterns:merged ? 140 : 118,
    limits:[
      "Runtime Release qualification does not qualify a packaged tarball, installer, deployment or go-live.",
      "Passing focal or diagnostic runs do not establish full-block qualification or causal performance improvement.",
      "Agent capture inspection is recorded as evidence; personal visual acceptance is not asserted.",
      "Before an actual merge readback, no M or final-head self-reference is fabricated and merged totals remain at the historical baseline."
    ]
  };
  return { result, content:JSON.stringify(result,null,2)+"\n", path };
}