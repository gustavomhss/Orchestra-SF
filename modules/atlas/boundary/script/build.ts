import path from "node:path"
import { generateDtsBundle } from "dts-bundle-generator"
import { hits } from "@orchestra/script/spawn-imports"
import ts from "typescript"

const root = path.resolve(import.meta.dir, "../../../..")
const output = path.resolve(import.meta.dir, "../src/generated")
const check = Bun.argv.includes("--check")
if (import.meta.main) await Promise.all(
  (
    [
      ["boundary", "retrieval/src/host-context.ts"],
      ["materialize", "retrieval/src/own-snapshot.ts"],
      // F3 A3: the bound Memory header read alone, for hosts that must not reach recall, fold or write.
      ["native-header", "adapter-io/src/native-header.ts"],
      // F3 A1/A3: the bound Memory composition (recall, exact fold, write, reconcile) for the backend seat's tools.
      ["native-memory", "adapter-io/src/native-bound.ts"],
      ["business-memory-ports", ""],
      // The Atlas screen's read and write API over the composition root (specs/atlas-ui/build D1/D2).
      ["surface", "adapter-io/src/surface/index.ts"],
      // The screen's Genesis mining (specs/atlas-ui/build D39): the CLI's governed pass, driven by the host's models.
      ["mine", "cli/src/surface-mine.ts"],
      // A session's committed context-continuity archive (repo-layout design §3), for the continuity module.
      ["context", "adapter-io/src/context-log.ts"],
      // The PR record, the Attempt trailer and the GitHub PR writer (merge-queue spec §4.5), for the board host.
      ["record", "persist/src/host-adapter.ts"],
      // The record commit's writers (merge-queue spec §4.7): card, attempt, board, logbook and milestone, each redacted
      // on a public repository.
      ["record-log", "adapter-io/src/record-log.ts"],
    ] as const
  ).map(async ([name, file]) => {
    const entry = name === "business-memory-ports"
      ? path.join(root, "modules/atlas/boundary/src/business-memory-entry.ts")
      : path.join(root, "modules/atlas/packages", file)
    let scannerEdges = 0
    const source = name === "business-memory-ports" ? await (async () => {
      const { build } = await import("esbuild")
      const result = await build({
        entryPoints: [entry], bundle: true, platform: "node", format: "esm", write: false,
        minifyWhitespace: true, minifySyntax: true, minifyIdentifiers: false,
        external: ["web-tree-sitter"],
        plugins: [{
          name: "canonical-atlas-build-boundary",
          setup(builder) {
            builder.onResolve({ filter: /^\.\/scanner\.js$/ }, (args) => {
              if (path.resolve(args.importer) !== path.join(root, "modules/atlas/packages/adapter-io/src/memory-emit.ts")) return
              scannerEdges++
              return { path: "@orchestra/atlas-boundary/native-memory", external: true }
            })
            builder.onResolve({ filter: /^@atlas\// }, (args) => ({
              path: path.join(root, "modules/atlas/packages", args.path.slice("@atlas/".length), "src/index.ts"),
            }))
            builder.onResolve({ filter: /^@noble\/hashes\// }, (args) => ({
              path: Bun.resolveSync(args.path, path.resolve(import.meta.dir, "..")),
            }))
            builder.onResolve({ filter: /^@bufbuild\/protobuf(\/.*)?$/ }, (args) => ({
              path: Bun.resolveSync(args.path, path.resolve(import.meta.dir, "..")),
            }))
            builder.onResolve({ filter: /^@c4312\/scip$/ }, (args) => ({
              path: Bun.resolveSync(args.path, path.resolve(import.meta.dir, "..")),
            }))
          },
        }],
      })
      if (result.outputFiles.length !== 1) throw new Error("Atlas business boundary build failed")
      return result.outputFiles[0]!.text
    })() : await (async () => {
    const result = await Bun.build({
      entrypoints: [entry],
      target: "node",
      format: "esm",
      // Bun's cross-module identifier minifier is nondeterministic: repeated builds of the same graph
      // occasionally permute short names, so check:generated flakes. Keep whitespace and syntax minification only.
      minify: { whitespace: true, syntax: true, identifiers: false },
      // The surface's AST module imports the parser at load and only uses it after `initAst()`, which the surface never
      // calls. Kept external, it resolves at run time to this package's pinned dependency, and the emscripten loader's
      // own paths never enter the committed bytes.
      external: ["web-tree-sitter"],
      plugins: [
        {
          name: "canonical-atlas-build-boundary",
          setup(builder) {
            builder.onResolve({ filter: /^@atlas\// }, (args) => ({
              path: path.join(root, "modules/atlas/packages", args.path.slice("@atlas/".length), "src/index.ts"),
            }))
            builder.onResolve({ filter: /^@noble\/hashes\// }, (args) => ({
              path: Bun.resolveSync(args.path, path.resolve(import.meta.dir, "..")),
            }))
            // The SCIP decoder the surface reads `.atlas/index.scip` with: this package's pinned copy, not whichever
            // copy happens to sit above the Atlas sources.
            // The protobuf runtime the decoder and the Atlas sources share: this package's pinned copy too, so a
            // local `npm ci` under modules/atlas cannot change the committed bytes.
            builder.onResolve({ filter: /^@bufbuild\/protobuf(\/.*)?$/ }, (args) => ({
              path: Bun.resolveSync(args.path, path.resolve(import.meta.dir, "..")),
            }))
            builder.onResolve({ filter: /^@c4312\/scip$/ }, (args) => ({
              path: Bun.resolveSync(args.path, path.resolve(import.meta.dir, "..")),
            }))
          },
        },
      ],
    })
    if (!result.success || result.outputs.length !== 1)
      throw new Error(`Atlas boundary build failed: ${result.logs.join("\n")}`)
    return await result.outputs[0]!.text()
    })()
    if (name === "business-memory-ports") {
      admitBusinessBundle({
        edges: scannerEdges,
        emitter: await Bun.file(path.join(root, "modules/atlas/packages/adapter-io/src/memory-emit.ts")).text(),
        entry: await Bun.file(entry).text(),
        source,
        native: await Bun.file(path.join(root, "modules/atlas/packages/adapter-io/src/native-bound.ts")).text(),
        allowlist: await Bun.file(path.join(root, "script/spawn-allowlist.json")).text(),
      })
    }
    const declarations = generateDtsBundle([{ filePath: entry, output: { exportReferencedTypes: false } }], {
      preferredConfigPath: path.join(import.meta.dir, "tsconfig.json"),
    })
    if (declarations.length !== 1 || !declarations[0]?.trim())
      throw new Error("Atlas boundary declaration build was empty")
    const generated = [
      { path: path.join(output, `${name}.js`), content: source },
      { path: path.join(output, `${name}.d.ts`), content: declarations[0] },
    ]
    await Promise.all(
      generated.map(async (file) => {
        if (!check) return Bun.write(file.path, file.content)
        if (!(await Bun.file(file.path).exists())) throw new Error(`Missing generated Atlas boundary: ${file.path}`)
        if ((await Bun.file(file.path).text()) !== file.content)
          throw new Error(`Stale generated Atlas boundary: ${file.path}`)
      }),
    )
  }),
)

/** Shared by the generator and its counterexamples; this checks source, emitted JS and the bound native surface. */
export function admitBusinessBundle(input: { edges: number; emitter: string; entry: string; source: string; native: string; allowlist: string }) {
  if (new Bun.CryptoHasher("sha256").update(input.allowlist).digest("hex") !== "2131adbaf9b4d012543c3e5cbd6c112397cb86a876d30ba6b83f1215cf898278") throw new Error("Spawn allowlist changed")
  if (input.edges !== 1) throw new Error(`Expected one scanner edge, found ${input.edges}`)
  const emitterAst = ts.createSourceFile("memory-emit.ts", input.emitter, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const scannerImports = emitterAst.statements.filter((node) => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "./scanner.js")
  if (scannerImports.length !== 1) throw new Error("Expected exactly one literal scanner source import")
  if (hits("business-memory-entry.ts", input.entry).length || hits("business-memory-ports.js", input.source).length) throw new Error("Spawning import in business memory bundle")
  const ast = ts.createSourceFile("business-memory-ports.js", input.source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  let nativeImport = false
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "@orchestra/atlas-boundary/native-memory") {
      const bindings = node.importClause?.namedBindings
      if (bindings && ts.isNamedImports(bindings) && bindings.elements.some((element) => (element.propertyName ?? element.name).text === "NO_SCANNER_NAME")) nativeImport = true
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) throw new Error("Dynamic import in business memory bundle")
    if (ts.isIdentifier(node) && ["require", "eval", "Function"].includes(node.text)) throw new Error("Dynamic code in business memory bundle")
    if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) && ["globalThis", "global", "module"].includes(node.expression.text)) throw new Error("Computed global access in business memory bundle")
    if ((ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node) || ts.isExportSpecifier(node)) && node.name && ts.isIdentifier(node.name) && ["runScanner", "detectAvailableScanner", "KNOWN_SCANNERS", "NO_SCANNER_NAME"].includes(node.name.text)) throw new Error("Scanner implementation or export in business memory bundle")
    ts.forEachChild(node, visit)
  }
  visit(ast)
  if (!nativeImport) throw new Error("Missing canonical NO_SCANNER_NAME import")
  const nativeAst = ts.createSourceFile("native-bound.ts", input.native, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const values = nativeAst.statements.flatMap((node) => {
    if (!ts.isExportDeclaration(node) || node.isTypeOnly) return []
    if (!node.exportClause || !ts.isNamedExports(node.exportClause)) throw new Error("Native memory must use named exports")
    return node.exportClause.elements.filter((element) => !element.isTypeOnly).map((element) => element.name.text)
  }).sort()
  const expected = ["createNativeMemory", "decideProjectRule", "proposeProjectRule", "detectAvailableScanner", "runScanner", "KNOWN_SCANNERS", "NO_SCANNER_NAME"].sort()
  if (JSON.stringify(values) !== JSON.stringify(expected)) throw new Error("Native memory export surface changed")
}
