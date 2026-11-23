function buildSf613ClosureMarkdown(bases, templates, closure, input = {}) {
  const expected = {
    "WAVE-FIVE.md":"1b6141f5090ba1af92598ac2c7c7aac6de768429",
    "README.md":"e129fa75fdf51e9412cd38b492120a01c6969cf1",
    "wave-five/SOURCE-INTEGRATION.md":"d89b86b99c77ffdb1539e9f691060fa081ad1382",
    "wave-five/analytics/SCOPE.md":"cd3d6a8c4759bf6a90777005775f57aa22f1e9d8",
    "wave-five/collab/SCOPE.md":"26dbd5cf1853834586e568026d4ad597b27231d7",
    "wave-five/collab/HANDOFF.md":"2918dadf48f4ed5ac2c741dfeb53a74ad83e5a39",
    "wave-five/collab/REVIEW-GALLERY.md":"e876d310d655ee80134774ffc830e28f4617a44f",
    "wave-five/reviews/SCOPE.md":"c00ebb8d40ea6d8fa7e056f621cd0ed478ec32ab",
    "wave-five/reviews/HANDOFF.md":"3295f82f4f2cbd96d15ca1e40e1703bf9fceda31",
    "wave-five/reviews/REVIEW-GALLERY.md":"eed4189e8b168ab1fe5c90e05b86172c2d7a16ba"
  };
  const status = closure.scope.status, source = closure.scope.source;
  const qualified = status === "QUALIFIED_PENDING_MERGE" || status === "MERGED_QUALIFIED";
  const merged = status === "MERGED_QUALIFIED";
  if (!qualified && status !== "PREPARATION_ONLY_NOT_QUALIFIED") throw new Error("Unknown closure status");
  if (closure.totals.references !== 75 || closure.totals.paths !== 66 ||
    closure.totals.changedReferences !== 62 || closure.totals.changedPaths !== 53 ||
    closure.totals.changedAreas !== 59 || closure.totals.changedAreasOutsideWaveFive !== 44)
    throw new Error("Unreconciled component provenance");
  const receipts = closure.scope.verification.receipts;
  const repo = "https://github.com/gustavomhss/Orchestra-SF";
  const directory = "docs/qa/sucafina/design/";
  const marker = "<!-- sf613-current-closure:v4-rebuilt -->";
  const pending = key => "{{" + key + "}}";
  const safePath = value => typeof value === "string" && /^[A-Za-z0-9_./-]+$/.test(value) &&
    !value.startsWith("/") && !value.split("/").some(part => part === ".." || part === "." || part === "");
  const relative = (from, to) => {
    if (!safePath(to)) throw new Error("Expected an actual repository path");
    const a = (directory + from).split("/").slice(0, -1), b = to.split("/");
    while (a.length && b.length && a[0] === b[0]) { a.shift(); b.shift(); }
    return "../".repeat(a.length) + b.join("/");
  };
  const link = (from, path, label, token) => path ? "[" + label + "](" + relative(from, path) + ")" : pending(token);
  const cell = value => String(value).replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
  const receiptLink = (key, token) => {
    const receipt = receipts[key];
    return receipt && Number.isSafeInteger(receipt.run) && typeof receipt.snapshot === "string"
      ? "[run " + receipt.run + "](" + repo + "/actions/runs/" + receipt.run +
        "), CI snapshot `" + receipt.snapshot + "`" : pending(token);
  };
  const galleries = input.galleries ?? {};
  if (qualified) {
    if (!safePath(input.finalGalleryPath)) throw new Error("Final gallery manifest is required");
    for (const key of ["analytics","collab","reviews"]) {
      const gallery = galleries[key], receipt = receipts[key];
      if (!gallery || !safePath(gallery.path) || gallery.run !== receipt.run || gallery.snapshot !== receipt.snapshot ||
        !Number.isSafeInteger(gallery.count) || gallery.count < 1 || gallery.reviewedCount !== gallery.count)
        throw new Error("Incomplete actual capture intake: " + key);
    }
    if (source.product !== source.qualifiedSource && !safePath(input.sourceEquivalencePath))
      throw new Error("Source equivalence receipt path is required");
  }
  const suppliedAssets = input.assets ?? [];
  if (!Array.isArray(suppliedAssets) || templates.requiredAssets.length !== 16 ||
    new Set(templates.requiredAssets).size !== 16) throw new Error("Unexpected required asset list");
  const assetRows = templates.requiredAssets.map(name => {
    const matches = suppliedAssets.filter(asset => asset.name === name);
    if (matches.length > 1) throw new Error("Ambiguous final asset: " + name);
    const asset = matches[0];
    if (qualified && (!asset || !safePath(asset.path) || !/^[a-f0-9]{64}$/.test(asset.sha256) ||
      !Number.isSafeInteger(asset.bytes) || asset.bytes < 1 || asset.reviewed !== true ||
      asset.source !== source.qualifiedSource || asset.run !== receipts.analytics.run ||
      asset.snapshot !== receipts.analytics.snapshot || typeof asset.declaration !== "string" ||
      !asset.declaration || !Number.isSafeInteger(asset.occurrence) || asset.occurrence < 1))
      throw new Error("Missing verified original Analytics asset: " + name);
    return { name, asset };
  });
  const captureTable = from => [
    "| Required state | Exact capture and visual intake | Evidence |",
    "| --- | --- | --- |",
    ...assetRows.map(({name,asset}) => asset
      ? "| " + name + " | " + cell(asset.declaration) + " / occurrence " + cell(asset.occurrence) +
        " / " + (asset.reviewed === true ? "reviewed" : "pending") + " | " +
        link(from,asset.path,"asset","ASSET_PATH") + "; " + cell(asset.bytes) + " B; SHA256 `" +
        cell(asset.sha256) + "`; run " + cell(asset.run) + "; snapshot `" + cell(asset.snapshot) + "` |"
      : "| " + name + " | PENDING | No qualifying asset supplied |"),
    "",
    "These 16 required states are a subset of the complete original capture intake, not a total screenshot count."
  ].join("\n");
  const demote = body => {
    let fence, minimum = 0;
    return body.split("\n").map(line => {
      const match = /^(?: {0,3})(`{3,}|~{3,})/.exec(line);
      if (match) {
        if (!fence) { fence = match[1][0]; minimum = match[1].length; }
        else if (match[1][0] === fence && match[1].length >= minimum) fence = undefined;
        return line;
      }
      return !fence ? line.replace(/^(#{2,5}) /, "#$1 ") : line;
    }).join("\n");
  };
  const files = {}, meta = { status, preimages: expected, documentCount: 10,
    primaryInventoryLinks: 0, requiredAssets: templates.requiredAssets,
    completeCaptureIntakeStillRequired: true, mergeReceipt: source.mergeReceipt ?? null };
  for (const [name, expectedSha] of Object.entries(expected)) {
    const base = bases[name], header = templates.headers[name];
    if (!base || base.sha !== expectedSha || typeof base.content !== "string" || typeof header !== "string")
      throw new Error("Missing exact Markdown preimage: " + name);
    if (base.content.includes(marker)) throw new Error("Closure header already applied");
    const firstNewline = base.content.indexOf("\n"), title = base.content.slice(0, firstNewline);
    if (firstNewline < 0 || !/^# [^#]/.test(title)) throw new Error("Expected original H1: " + name);
    let history = base.content.slice(firstNewline + 1).replace(/^\n/, ""), currentInventory = "";
    if (name === "README.md") {
      const start = history.indexOf("## Exact inventory\n");
      const end = history.indexOf("\n## Design sources and review boundaries", start);
      if (start < 0 || end < 0) throw new Error("Missing original inventory section");
      const section = history.slice(start,end), tableStart = section.indexOf("| Order |");
      if (tableStart < 0) throw new Error("Missing original inventory table");
      const oldPreface = section.slice("## Exact inventory\n".length, tableStart).trim();
      const table = section.slice(tableStart).trimEnd();
      const paths = new Set(closure.refs.map(ref => ref.path));
      let count = 0;
      const rewritten = table.replace(
        /https:\/\/github\.com\/gustavomhss\/Orchestra-SF\/blob\/([a-f0-9]{40})\/(packages\/app-shell\/src\/orchestra\/chapters\/sucafina\/[^)\s]+)/g,
        (_all, _commit, path) => {
          if (!paths.has(path)) throw new Error("Unproven primary entrypoint: " + path);
          count++;
          return repo + "/blob/" + source.product + "/" + path;
        });
      if (count !== 70) throw new Error("Expected 70 primary entrypoint links");
      meta.primaryInventoryLinks = count;
      const areas = merged ? 56 : 41, routes = merged ? 140 : 118;
      currentInventory = "\n\n## Exact inventory — current component identities\n\n" +
        "The registry still contains 70 areas, 165 route patterns and 15 native chapters. " +
        "The table has 70 primary entrypoint links; inventory.json carries all 75 component references across 66 files. " +
        "Their source is `" + source.product + "`. Updating an entrypoint or blob identity does not grant personal visual acceptance. " +
        "Confirmed merged coverage remains " + areas + "/70 areas and " + routes + "/165 route patterns. " +
        "Only UI42–UI56 contributes the proposed 15 areas/22 patterns; 56/140 is recorded only after a verified actual merge. " +
        "The 44 changed areas outside Wave Five retain their historical status and source-specific acceptance.\n\n" + rewritten;
      history = history.slice(0,start) + "## Prior inventory source and count note\n\n" +
        oldPreface + "\n\nThe historical primary-entrypoint table was reconciled in the current inventory above; " +
        "its prior component blobs remain in inventory.json provenance.\n" + history.slice(end);
    }
    const gallery = (key, token) => link(name,galleries[key]?.path,key + " gallery and intake",token);
    const sourceLink = source.product === source.qualifiedSource
      ? "[qualified source](" + repo + "/tree/" + source.qualifiedSource + ")"
      : link(name,input.sourceEquivalencePath,"source-equivalence receipt","SOURCE_EQUIVALENCE_LINK");
    const merge = source.mergeReceipt;
    const values = {
      STATUS:status, FINAL_PRODUCT:source.product, FINAL_PRODUCT_TREE:source.productTree,
      QUALIFIED_SOURCE:source.qualifiedSource, EFFECTIVE_DEV:source.effectiveDev,
      MERGED_AREAS:merged ? 56 : 41, MERGED_ROUTES:merged ? 140 : 118,
      QUALIFICATION_SUMMARY:qualified
        ? "Complete clean technical and installed receipts are recorded below for the pinned source and runtimes."
        : "Preparation only: complete clean qualification is still pending; source-specific successes and diagnostics do not qualify the whole block.",
      MERGE_STATE:merged
        ? "Actual merge [" + merge.commit + "](" + repo + "/commit/" + merge.commit +
          "), tree `" + merge.tree + "`, was read back with verified parents and tree equivalence."
        : "No merge receipt is asserted; merged counts remain at the accepted baseline.",
      TECHNICAL_RECEIPT_LINK:receiptLink("technical","TECHNICAL_RECEIPT_LINK"),
      ANALYTICS_RECEIPT_LINK:receiptLink("analytics","ANALYTICS_RECEIPT_LINK"),
      COLLAB_RECEIPT_LINK:receiptLink("collab","COLLAB_RECEIPT_LINK"),
      REVIEWS_RECEIPT_LINK:receiptLink("reviews","REVIEWS_RECEIPT_LINK"),
      RELEASE_TECHNICAL_RECEIPT_LINK:receiptLink("releaseTechnical","RELEASE_TECHNICAL_RECEIPT_LINK"),
      RELEASE_ANALYTICS_RECEIPT_LINK:receiptLink("releaseAnalytics","RELEASE_ANALYTICS_RECEIPT_LINK"),
      FINAL_GALLERY_LINK:link(name,input.finalGalleryPath,"complete gallery manifest","FINAL_GALLERY_LINK"),
      ANALYTICS_GALLERY_LINK:gallery("analytics","ANALYTICS_GALLERY_LINK"),
      COLLAB_GALLERY_LINK:gallery("collab","COLLAB_GALLERY_LINK"),
      REVIEWS_GALLERY_LINK:gallery("reviews","REVIEWS_GALLERY_LINK"),
      COLLAB_CAPTURE_COUNT:galleries.collab?.count ?? pending("COLLAB_CAPTURE_COUNT"),
      REVIEWS_CAPTURE_COUNT:galleries.reviews?.count ?? pending("REVIEWS_CAPTURE_COUNT"),
      SOURCE_EQUIVALENCE_LINK:sourceLink,
      SOURCE_EQUIVALENCE_SUMMARY:qualified
        ? source.product === source.qualifiedSource
          ? "Product and qualified source are identical: " + sourceLink + "."
          : "The later product is connected to the clean qualified source by " + sourceLink +
            "; that receipt identifies the exact deltas and preserved executable/oracle identities."
        : "Final product-to-qualification equivalence remains pending; source and CI snapshot identities must be recorded separately.",
      ANALYTICS_FINAL_CAPTURE_TABLE:captureTable(name)
    };
    const current = header.replace(/\{\{([A-Z0-9_]+)\}\}/g, (token,key) =>
      Object.hasOwn(values,key) ? String(values[key]) : token);
    if (qualified && /\{\{[^}]+\}\}/.test(current)) throw new Error("Unresolved current qualification: " + name);
    const historical = "## Historical source records\n\n" +
      "The records below retain their original source, outcome, images, failures and acceptance scope. " +
      "They are not current qualification of a different product. Heading levels alone were adjusted for this historical section; " +
      "the README inventory reconciliation is identified separately.\n\n" + demote(history).trimEnd();
    files[name] = title + "\n\n" + marker + "\n" + current.trimEnd() +
      currentInventory + "\n<!-- /sf613-current-closure:v4-rebuilt -->\n\n" + historical + "\n";
  }
  return { files, meta };
}