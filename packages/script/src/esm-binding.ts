import ts from "typescript"

// Check the named binding in a generated Bun helper chunk. Comments and strings carry no evidence.
export function exportsImportMetaRequire(code: string, name: string): boolean {
  const source = ts.createSourceFile("bun-helper.mjs", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  if (!("parseDiagnostics" in source) || !Array.isArray(source.parseDiagnostics) || source.parseDiagnostics.length)
    return false
  const exports = source.statements.flatMap((statement) => {
    if (!ts.isExportDeclaration(statement) || !statement.exportClause || !ts.isNamedExports(statement.exportClause))
      return []
    return statement.exportClause.elements
      .filter((element) => element.name.text === name)
      .map((element) => ({ element, local: !statement.moduleSpecifier }))
  })
  if (exports.length !== 1 || !exports[0]!.local) return false
  const exported = exports[0]!.element.propertyName ?? exports[0]!.element.name
  const declarations = source.statements.flatMap((statement) =>
    ts.isVariableStatement(statement) ? statement.declarationList.declarations : [],
  ).filter((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === exported.text)
  if (declarations.length !== 1) return false
  const declaration = declarations[0]!
  const initializer = declaration.initializer
  if (!initializer || !ts.isPropertyAccessExpression(initializer) || initializer.questionDotToken ||
      initializer.name.text !== "require" ||
      !ts.isMetaProperty(initializer.expression) || initializer.expression.keywordToken !== ts.SyntaxKind.ImportKeyword ||
      initializer.expression.name.text !== "meta") return false

  // The generated helper may call or export the binding. Other uses can change what the stub calls.
  const unexpectedUse = (node: ts.Node): boolean => {
    if (ts.isIdentifier(node) && node.text === exported.text && node !== declaration.name && node !== exported) {
      const parent = node.parent
      if (!(ts.isCallExpression(parent) && parent.expression === node) &&
          !(ts.isExportSpecifier(parent) && parent.name === node && parent.propertyName)) return true
    }
    return ts.forEachChild(node, unexpectedUse) === true
  }
  return !unexpectedUse(source)
}
