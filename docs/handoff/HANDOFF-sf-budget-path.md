# HANDOFF — sf-budget-path

## SHA e estado

- Estado: **PARTIAL — correção mínima preparada; qualificação Actions da composição pendente**.
- Branch isolada: `sf-budget-path`.
- Integração observada/base: `45514008d7ce275327003c5d92faaeeab2479739`; árvore `cc58187cbf9671b3e21a7aef18c3edf2cd9595e9`.
- SHA de código: `77fcb5e65c6737d7b53119b32c23af8c36160957`; árvore de código `21088c1bb3470abc51a81570711b339b8ade4f19`.
- Arquivo de código: `modules/sucafina/Sucafinav1/test/native-ui-contract/budget-deviation-projection.test.ts`.
- Blob anterior: `2337a3b7a11e080fb956e8e241fef90a182b113c`.
- Blob corrigido: `b75a837a419dfb791438659de0d55dc2ced6fcff`.
- Este commit documental sucede o SHA de código. Nenhum PR, merge ou gate foi executado por este recorte.

## Causa comprovada

O [run 44672678428](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44672678428), attempt 1, snapshot `b5d3371e6288ba445e2af5480f7b2e052e6f1b68`, terminou failure. O [job 136077072943](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44672678428/job/136077072943) registra o compilador real Sucafina:

`test/native-ui-contract/budget-deviation-projection.test.ts(67,48): TS2322: Type 'string' is not assignable to type 'string & Brand<"AbsolutePath">'.`

O diretório temporário já existe e é criado por `mkdtemp(path.join(await realpath(tmpdir()), ...))`. A variável inferida como string era fornecida a `createSfProductAuthority`, cuja identidade deve satisfazer `SfHostRuntime["identity"]` e `Location.Ref`.

## Feito e motivo

1. Importado `AbsolutePath` de `@orchestra/core/schema`.
2. Aplicado `AbsolutePath.make` ao resultado existente de `mkdtemp`, exatamente como a fixture canônica `summary-settings.test.ts` já faz nesta integração.

A construção usa o diretório absoluto real da fixture. Não introduz um cast nem substitui o diretório, a instalação, a autoridade, o SQLite ou os handlers reais. A causa é exclusivamente a marca de tipo ausente na fronteira da identidade.

## Verificação e limites

- `AGENTS.md` da base foi lido; não há outro AGENTS nos diretórios ancestrais deste teste ou do handoff.
- Conferência textual: desfazer somente a importação e o wrapper reproduz integralmente o arquivo da base.
- As **56 linhas contendo expect** permanecem byte-idênticas e na mesma ordem. Não há alteração de assertion, caso, limite, cleanup ou efeito de produto.
- O predecessor canônico `summary-settings.test.ts` tem blob `f1cb6764a4f99b2c9b8a78ac3a0bafa3ba20c3c4` nesta base.
- Não houve execução local, shell, dispatch Actions, rerun, PR ou merge. Este handoff não declara typecheck verde.
- Os demais diagnósticos do mesmo run pertencem a outros recortes e continuam fora deste patch. Nenhuma declaração de qualificação integral, baseline, pacote ou GO é feita.

## Pendente e como retomar

O root comporá este único blob com os reparos de testes/observers de #431 preparados pelo outro responsável e controlará um gate conjunto. Incluir a fixture Budget real no recorte de testes e a compilação canônica afetada; registrar os resultados reais antes de promover este handoff a complete. Não repetir um gate inalterado nem transportar verde de outro SHA.

A integração pode avançar enquanto este recorte é revisado: verificar o blob Budget no alvo e preservar todos os demais paths. Consumir o delta de código de `77fcb5e65c6737d7b53119b32c23af8c36160957` e este handoff; não fazer um merge implícito de branches parciais de outros responsáveis.
