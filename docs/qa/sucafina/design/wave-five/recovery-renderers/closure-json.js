function buildSf613ClosureJson(scopeText, inventoryText, filePack, input = {}) {
  const clone = value => JSON.parse(JSON.stringify(value));
  const oldScope = JSON.parse(scopeText), oldInventory = JSON.parse(inventoryText);
  const mode = input.mode ?? "draft";
  if (!["draft", "qualified", "merged"].includes(mode)) throw new Error("Unknown closure mode");
  const qualified = mode !== "draft", merged = mode === "merged";
  const product = input.product ?? "{{FINAL_PRODUCT}}";
  const productTree = input.productTree ?? "{{FINAL_PRODUCT_TREE}}";
  const qualifiedSource = input.qualifiedSource ?? "{{QUALIFIED_SOURCE}}";
  const effectiveDev = input.effectiveDev ?? "27f04c1cc723e42d5010b8f672a640b4792787ff";
  const inspected = input.inspectedSource ?? "9ba028b0d4d54317aea0d4df239047cbbdffdbe9";
  const nativeTree = input.nativeTree ?? "bf4e55776951cd7d7512a48fd7f0937f6d1cd401";
  const registry = "6e1e711e2ff3a95e460026053cb91772693da572";
  const prefix = "packages/app-shell/src/orchestra/chapters/sucafina/";
  const sha = value => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
  const incoming = {
    pullRequest: 710, mergeCommit: "65349c1c723a8c626135d5b8032b929f5c635193",
    manifestAt: "7c2338ac8bb6569fa39ed99b665a61d067f8cd07",
    manifestSource: "6fb74f4cf7db0aaa172acf4a5a383cdb3e67af44",
    manifestBlob: "e5b4521e38b51620ab90cf90d42543f09d715fca",
    manifest: "https://github.com/gustavomhss/Orchestra-SF/blob/7c2338ac8bb6569fa39ed99b665a61d067f8cd07/docs/qa/sucafina/visual-audit/verification-runs.json",
    qualifiesDesignComposition: false
  };
  const groups = { analytics: ["UI42","UI43","UI44","UI45","UI46"], reviews: ["UI47","UI48","UI49","UI50","UI54"], collab: ["UI51","UI52","UI53","UI55","UI56"] };
  const areaIds = Object.values(groups).flat(), selected = new Set(areaIds);
  const groupOf = id => Object.keys(groups).find(key => groups[key].includes(id));
  const rows = new Map(filePack.map(row => [prefix + row[0], row]));
  if (rows.size !== 66 || oldInventory.surfaces.length !== 70 || oldScope.areas.length !== 15)
    throw new Error("Unexpected inventory preimage");
  const refs = oldInventory.surfaces.flatMap(surface => surface.components.map(component => {
    const row = rows.get(component.path);
    if (!row || !sha(row[1]) || !["C","D","U"].includes(row[2])) throw new Error("Missing component proof: " + component.path);
    const ours = row[3] ?? component.blobSha, dev = row[4] ?? row[1];
    if (!sha(ours) || !sha(dev)) throw new Error("Invalid component ancestry");
    const relation = row[1] === dev ? (ours === dev ? "C" : "D") : row[1] === ours ? "O" : "U";
    if (relation !== row[2]) throw new Error("Component relation mismatch: " + component.path);
    return {
      area: surface.id, path: component.path, blob: row[1], priorInventoryBlob: component.blobSha,
      ours: { source: "9ea7345587465822daabfecb635d48d96f643b19", blob: ours },
      incoming: { source: incoming.mergeCommit, blob: dev }, relation,
      changed: row[1] !== component.blobSha, waveFive: selected.has(surface.id),
      group: groupOf(surface.id) ?? null, inspectedSource: inspected,
      qualificationScope: selected.has(surface.id) ? (qualified ? "QUALIFIED_WAVE_FIVE_WITH_FINAL_RECEIPTS" : "WAVE_FIVE_FINAL_RECEIPTS_REQUIRED") : "COMPONENT_IDENTITY_ONLY",
      inheritsHistoricalVisualAcceptance: false,
      incomingEvidence: incoming.manifest
    };
  }));
  const changed = refs.filter(ref => ref.changed);
  const totals = {
    references: refs.length, paths: new Set(refs.map(ref => ref.path)).size,
    changedReferences: changed.length, changedPaths: new Set(changed.map(ref => ref.path)).size,
    changedAreas: new Set(changed.map(ref => ref.area)).size,
    changedAreasOutsideWaveFive: new Set(changed.filter(ref => !ref.waveFive).map(ref => ref.area)).size
  };
  if (JSON.stringify(Object.values(totals)) !== JSON.stringify([75,66,62,53,59,44]))
    throw new Error("Component reconciliation counts changed");
  const groupRoutes = Object.fromEntries(Object.entries(groups).map(([key, ids]) => [key, {
    areas: ids.length, routePatterns: oldScope.areas.filter(area => ids.includes(area.id)).reduce((sum, area) => sum + area.routes.length, 0)
  }]));
  if (groupRoutes.analytics.routePatterns !== 7 || groupRoutes.reviews.routePatterns !== 8 || groupRoutes.collab.routePatterns !== 7)
    throw new Error("Wave-five route ownership changed");
  const receipts = input.receipts ?? {
    technical: "{{TECHNICAL_RECEIPT}}", analytics: "{{ANALYTICS_RECEIPT}}",
    collab: "{{COLLAB_RECEIPT}}", reviews: "{{REVIEWS_RECEIPT}}",
    releaseTechnical: "{{RELEASE_TECHNICAL_RECEIPT}}", releaseAnalytics: "{{RELEASE_ANALYTICS_RECEIPT}}"
  };
  if (qualified) {
    if (![product,productTree,qualifiedSource,effectiveDev,inspected,nativeTree].every(sha))
      throw new Error("Actual source identities are required");
    for (const key of ["technical","analytics","collab","reviews","releaseTechnical","releaseAnalytics"]) {
      const receipt = receipts[key];
      if (!receipt || receipt.status !== "success" || receipt.qualification !== true ||
        receipt.source !== qualifiedSource || !sha(receipt.snapshot) || !Number.isSafeInteger(receipt.run))
        throw new Error("Missing complete clean qualification: " + key);
    }
    if (receipts.technical.completeOriginalGateSet !== true || receipts.releaseTechnical.completeOriginalGateSet !== true)
      throw new Error("Original technical gates must be complete");
    for (const key of ["analytics","collab","reviews","releaseAnalytics"]) {
      const receipt = receipts[key];
      if (receipt.passed !== 2 || receipt.failed !== 0 || receipt.skipped !== 0 || receipt.retries !== 0 ||
        receipt.allCapturesReviewed !== true) throw new Error("Incomplete installed journey: " + key);
    }
    if (product !== qualifiedSource && input.sourceEquivalence?.status !== "VERIFIED")
      throw new Error("Later product requires explicit source equivalence");
    if (!Array.isArray(input.negativeEvidence) || !input.negativeEvidence.length)
      throw new Error("Preserve the later negative evidence ledger");
  }
  const merge = merged ? input.mergeReceipt : null;
  if (merged && (!merge || ![merge.commit,merge.tree,merge.head,merge.base].every(sha) ||
    merge.treeMatches !== true || !Array.isArray(merge.parents) ||
    !merge.parents.includes(merge.head) || !merge.parents.includes(merge.base)))
    throw new Error("A verified actual merge receipt is required");
  const status = merged ? "MERGED_QUALIFIED" : qualified ? "QUALIFIED_PENDING_MERGE" : "PREPARATION_ONLY_NOT_QUALIFIED";
  const binding = {
    product, productTree, qualifiedSource, effectiveDev, inspectedSource: inspected, nativeTree, routeRegistryBlob: registry,
    sourceEquivalence: input.sourceEquivalence ?? "{{FINAL_SOURCE_EQUIVALENCE}}",
    personalVisualAcceptance: "NOT_ASSERTED",
    mergeAuthorization: "USER_REQUESTED_COMPLETE_GREEN_MERGE",
    mergeReceipt: merge
  };
  const scope = clone(oldScope), inventory = clone(oldInventory);
  scope.historicalImplementation = { status: oldScope.status, branch: oldScope.branch, base: oldScope.base };
  scope.status = status;
  scope.branch = input.branch ?? "sf613-finish";
  scope.base = effectiveDev;
  scope.source = binding;
  scope.incomingPresentation = incoming;
  scope.areaCount = 15; scope.routePatternCount = 22; scope.previouslyMerged = 41; scope.remainingAfterThisBlock = 14;
  scope.groups = Object.fromEntries(Object.entries(groups).map(([key, ids]) => [key, {
    ...oldScope.groups[key], areas: ids, areaCount: 5, routePatternCount: groupRoutes[key].routePatterns,
    status, qualifiedSource, receipt: receipts[key], personalVisualAcceptance: "NOT_ASSERTED"
  }]));
  scope.areas = oldScope.areas.map(area => ({
    ...area, previousStatus: area.status,
    ...(area.qualification ? { historicalQualification: clone(area.qualification) } : {}),
    status, qualification: { status, source: qualifiedSource, receipt: receipts[groupOf(area.id)], personalVisualAcceptance: "NOT_ASSERTED" },
    componentProvenance: refs.filter(ref => ref.area === area.id)
  }));
  scope.relatedComponentUpdates = ["CAP01","CAP14","CAP20","UI57","UI67","UI68"].map(id => {
    const area = oldInventory.surfaces.find(surface => surface.id === id);
    return { id, status: area.status, statusPromoted: false, priorVisualVerification: area.visualVerification,
      componentProvenance: refs.filter(ref => ref.area === id) };
  });
  scope.verification = {
    status, blockFullyQualified: qualified, qualifiedAreas: qualified ? 15 : 0,
    userApproval: "NOT_ASSERTED", merged, inventoryAcceptedAndMergedAreas: merged ? 56 : 41,
    technicalEvidence: "technical-verification.json", receipts,
    historicalCheckpoint: clone(oldScope.verification),
    laterNegativeEvidence: input.negativeEvidence ?? "{{NEGATIVE_EVIDENCE_LEDGER}}",
    diagnosticResultsQualifyProduct: false
  };
  scope.inventoryProjection = { before: { areas: 41, routes: 118 }, block: { areas: 15, routes: 22 },
    afterVerifiedMerge: { areas: 56, routes: 140 }, total: { areas: 70, routes: 165 }, remaining: { areas: 14, routes: 25 } };
  inventory.baselineBeforeWaveFive = {
    counts: clone(oldInventory.counts), target: clone(oldInventory.target),
    candidateSource: clone(oldInventory.candidateSource), integratedSource: clone(oldInventory.integratedSource),
    activeWave: clone(oldInventory.activeWave), inventoryStatusScope: clone(oldInventory.inventoryStatusScope)
  };
  inventory.surfaces = oldInventory.surfaces.map(surface => {
    const next = clone(surface);
    next.components = surface.components.map(component => {
      const ref = refs.find(item => item.area === surface.id && item.path === component.path);
      return { ...component, priorInventoryBlobSha: component.blobSha, blobSha: ref.blob, provenance: {
        oursBlob: ref.ours.blob, incomingBlob: ref.incoming.blob, relation: ref.relation,
        qualificationScope: ref.qualificationScope, inheritsHistoricalVisualAcceptance: false
      } };
    });
    if (selected.has(surface.id)) {
      next.previousWaveFiveInventoryState = { status: surface.status, visualVerification: surface.visualVerification, designWork: clone(surface.designWork) };
      next.status = qualified ? status : surface.status;
      next.visualVerification = qualified ? "REAL_CAPTURES_REVIEWED_WITH_DOCUMENTED_LIMITS" : surface.visualVerification;
      next.designWork = qualified ? { status, productCommit: product, qualifiedSource, wave: 5, personalVisualAcceptance: "NOT_ASSERTED" } : clone(surface.designWork);
      next.integration = { status: merged ? "MERGED" : qualified ? "QUALIFIED_PENDING_MERGE" : "NOT_QUALIFIED", pullRequest: 613,
        ...(merge ? { mergeCommit: merge.commit } : {}) };
    }
    return next;
  });
  inventory.componentProvenance = { ...totals, binding, incomingPresentation: incoming,
    changedOutOfWaveStatusPolicy: "Historical statuses and personal acceptance remain tied to their recorded source; new blobs do not inherit them.",
    referenceSources: { ours: "9ea7345587465822daabfecb635d48d96f643b19", incoming: incoming.mergeCommit, inspected } };
  inventory.candidateSource = { commit: product, tree: productTree, qualifiedSource, nativeTree, routeRegistryBlob: registry, routeRegistryUnchanged: true };
  inventory.activeWave = {
    number: 5, status, pullRequest: 613, branch: scope.branch, runtimeProduct: product, qualifiedSource, effectiveDev,
    areas: [...selected].sort((a,b) => Number(a.slice(2))-Number(b.slice(2))), areaCount: 15, routePatternCount: 22,
    qualifiedAreas: qualified ? areaIds : [], pendingAreas: qualified ? [] : areaIds,
    userVisualApproval: "NOT_ASSERTED", mergeAuthorization: binding.mergeAuthorization, merged,
    receipts, summary: "WAVE-FIVE.md", scope: "wave-five/scope.json",
    verification: "wave-five/technical-verification.json", sourceIntegration: "wave-five/SOURCE-INTEGRATION.md"
  };
  inventory.inventoryStatusScope = {
    interpretation: "Confirmed merged totals remain 41 areas/118 routes until the verified PR613 merge. Component hashes identify the current inspected candidate. Out-of-wave design/visual acceptance remains historical; source refresh does not promote those areas.",
    baselinePullRequest: 588, baselineMerge: "f2a6c23551289ef8705baea03f8cec2425b8445a",
    acceptedMergedAreas: merged ? 56 : 41, personalVisualAcceptanceForWaveFive: "NOT_ASSERTED",
    currentWorkAuthority: "wave-five/scope.json", confirmedMerge: merge
  };
  if (merged) {
    inventory.baselineBeforeWaveFive.verification = clone(oldInventory.verification);
    inventory.counts = { ...oldInventory.counts, implementedAreas: 56, remainingAreas: 14,
      implementedAreaRouteScope: 140, remainingAreaRouteScope: 25, previouslyMergedAreas: 41,
      areasInThisIntegration: 15, acceptedForIntegrationAreas: 56, mergedAreas: 56 };
    inventory.target = { ...oldInventory.target, latestDevInspected: merge.commit, reviewedProductCommit: qualifiedSource,
      pullRequest: 613, userAcceptance: "MERGE_REQUEST_AUTHORIZED_PERSONAL_VISUAL_ACCEPTANCE_NOT_ASSERTED",
      integrationBase: merge.base, integrationCandidate: merge.head, integrationMergeCommit: merge.commit,
      reviewedBranch: scope.branch, latestDevInspectionScope: "Actual PR613 merge receipt; qualified runtime source and later source equivalence are recorded separately." };
    inventory.integratedSource = { commit: merge.commit, tree: merge.tree, nativeTree,
      routeRegistryBlob: registry, nativeSourceEquivalentTo: qualifiedSource };
    inventory.verification = { status: "MERGED_VERIFIED", wave: 5, receipts, binding, merge: clone(merge),
      personalVisualAcceptance: "NOT_ASSERTED", previousVerification: "baselineBeforeWaveFive.verification" };
  }
  return {
    scope, inventory, refs, totals, groupRoutes,
    files: {
      "wave-five/scope.json": JSON.stringify(scope,null,2) + "\n",
      "inventory.json": JSON.stringify(inventory,null,2) + "\n"
    }
  };
}