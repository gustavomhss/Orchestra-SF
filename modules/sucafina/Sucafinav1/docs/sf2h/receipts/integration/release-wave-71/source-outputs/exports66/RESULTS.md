# Missão 66 — resultados e handoff terminal

**PR draft [77](https://github.com/gustavomhss/Orchestra-SF/pull/77), de `export-artifact-proof` para `sf2-stack`. Aceitação da missão: HOLD.** As correções próprias e as provas funcionais estão entregues; há uma falha reproduzida fora da lease, além de renderização visual, compiler/guards e integração pendentes.

## Alterações próprias

Somente dois arquivos de produção mudaram: `runtime/artifact.ts` e `product/reports/storage.ts`. A validação agora cobre basename até 255 bytes UTF-8, controles/traversal/bidi/surrogates, extensão/MIME, main parts reais de DOCX/PPTX, limite do base64 antes de decodificar, bytes vazios/corruptos e reconciliação de contagem/evidências com a inclusão canônica. O armazenamento mantém os primeiros bytes e o ref do comando original.

Os oito arquivos novos de testes/helpers ficam em `test/product/export-artifact-closure/`. Nenhum arquivo ativo de Reports48, teste/helper existente, engine, workflow, deploy ou Azure foi alterado. Propostas externas são apenas texto inerte nesta receipt.

Patch completo de produção e testes: [source.patch](source.patch). Preimages: [source-preimages](source-preimages). Identidades e dependências: [SOURCE-MANIFEST.json](SOURCE-MANIFEST.json).

## Execuções reais no Actions

| Execução | W / S | Resultado | Alcance |
|---|---|---|---|
| [R1 — 43667294352](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43667294352) | W75e46959 / Sb382a382 | **32 pass, 2 fail**;34 testes, 8 arquivos, 1.269 assertions | Formatos/privacidade, integridade, autoridade, regressões Reports/Procurement e egress legado |
| [R2 — 43667789028](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43667789028) | W419a00b8 / S35e063d4 | **4 pass, 0 fail**;919 assertions | Apenas composição C08/SQLite, reopen/retry/auth/corrupção, com limite instalado |
| [R3 — 43668383518](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43668383518) | Wb371c1f9 / S46fb76e4 | **1 pass, 0 fail**;686 assertions | Geração nova DOCX/PPTX depois de a fonte corrente mudar110 → 130 |

Bun 1.3.14, runner Ubuntu 24.04. Nenhum teste/typecheck local. Omni declarou “not applicable” nos três runs: nenhuma prova de Omni/native é inferida.

A falha de PPTX em R1 veio da fixture configurada em 1 MiB. O serviço instalado usa 8 MiB. R2 mediu **1.533.773 bytes**, validou o mesmo artefato no limite instalado e manteve todas as asserções e o caso de excesso de tamanho. A produção não foi afrouxada. A outra falha de R1, egress legado, continua aberta.

## Matriz de arquivos efetivamente lidos

| Família | Leitor e observação | Resultado funcional | Limite |
|---|---|---|---|
| DOCX preservado | JSZip/CRC+Saxes; 12.738 bytes; revisão v1, valores/refIds, USD/FY2026, Unicode completo | PASS de conteúdo, persistência, download, reabertura e retry | Renderização visual não executada |
| PPTX preservado | JSZip/CRC+Saxes;1.533.773 bytes; 29 partes XML de slides | PASS dos mesmos controles; primeiros bytes preservados apesar de timestamps ZIP diferentes | 29 slides XML não equivalem a inspeção visual |
| Nova geração após mudança | R3 preservou110 USD, mudou corrente para130 e só então gerou os dois formatos | PASS; arquivos conservaram110 e a fonte continuou130 | Corpus sintético; sem prova de UI nativa |
| Planner XLSX | ExcelJS+JSZip+parseWorkbook;6 abas, versão v66/FY2026, linhas EUR e totais do app USD, zero/ausência, SUM com resultado 24 e fórmula adversarial como texto | PASS do export/reader e privacidade do viewer | Import/Apply roundtrip integral não executado |
| Roster e template XLSX | Abas All Members/Summary by Leader, 1 registro e exclusão de salário; template OPEX com 14 colunas e apenas header | PASS dos arquivos e ACL | Auditoria de leitura de membros é comportamento autorizado existente |
| Registro Procurement CSV | Leitor RFC4180 sobre bytesHTTP; PR/PO identificados; FX submetido 2 preservado apesar de corrente 3; 100 EUR → 200 USD | PASS dos valores, fontes monetárias e escopo | Não fecha toda a WP04 |
| Suppliers CSV | 7 registros; aspas/newline/Unicode preservados; seis prefixos adversariais neutralizados; banco/conta restritos ausentes para buyer | PASS do caso autorizado e conteúdo | Export bancário privilegiado não qualificado |
| PO HTML | HTMLRewriter sobre o arquivo; 21 células, stylesheet, termos/data, zero elementos script, escape do conteúdo adversarial | PASS de parse, conteúdo e escopo | Aparência renderizada não inspecionada |
| Backup JSON | JSON.parse sobre downloadHTTP; registro presente e namespace privado `__sfProductV1` removido inclusive em objetos aninhados | PASS do export e negação ao viewer | Restore/roundtrip integral não qualificado |
| Legado DOCX/PPTX | Leitura de valores mensais/ano/zero/ausência; DOCX real após revogação | Conteúdo PASS; **egress FAIL** | Reprodução no handler legado comSQLite/autenticação reais; não é prova da jornada instalada C28 |

Há **14 arquivos recuperados**, totalizando **3.157.240 bytes**, com conteúdo exato e SHA-256 conferidos no transporte. Índices: [R1](artifacts/R1/index.json), [R2](artifacts/R2/index.json), [R3](artifacts/R3/index.json). Incluem a amostra negativa do vazamento legado; presença de arquivo não significa aprovação.

Os testes existentes de Reports leram 25 registros/notas longas uma vez em cada formato, comentários históricos e série indisponível. Isso constitui prova de extração do componente; inspeção de páginas, sobreposição e clipping permanece NOT_RUN.

A matriz integral de38 critérios/subcritérios e observações está em [RESULTS.json](RESULTS.json). O mapeamento do plano está em [CANONICAL-MATRIX.json](CANONICAL-MATRIX.json); o catálogo não é usado como resultado.

## Armazenamento e autoridade

R2 produziu, armazenou, baixou, fechou e reabriu SQLite. Os bytes e SHA ficaram idênticos; retries da chave original retornaram os mesmos refs sem alterar snapshots, e intenção diferente foi recusada. Foram recusados usuário alheio, destinatário viewer, principal sem grant, sessão ausente/expirada/revogada, lease UI expirada e refs malformados. O criador rebaixado a viewer também perdeu o acesso à captura vinculada ao access revision anterior.

Dezesseis corrupções/tombstones falharam sem liberar arquivo nem reparar estado durante leitura: nome/header/traversal/MIME/formato, vazio, base64 inválido/excessivo, contêiner nãoOffice, digest, revisão, cobertura/evidências e escopo. O limite comprovado é por artefato, 8 MiB na composição instalada; não há alegação de quota agregada.

## Falha aberta e propostas para owners

**EA66-LEGACY-EGRESS:** no handler `runtime/application.ts#serveDownload`, revogar a sessão depois da transação autenticada ainda permitiu HTTP 200 e um DOCX contendo o marcador selecionado. A requisição seguinte retornou 401. O teste mantém a expectativa 403 e não foi invertido, removido ou marcado skip.

O path é externo à lease 66. [Patch/preimage/postimage/manifest](external/runtime-application/manifest.json) propõem reautenticar e conferir a origem após geração, suprimindo bytes em 403/409. A comparação conservadora de toda a superfície pode exigir novo download após uma edição pública não relacionada; esse efeito está declarado. A proposta não foi aplicada ou testada.

Os arquivos atuais imprimem a versão da revisão e refIds das fontes; os manifests retêm versões/incarnações completas. [Proposta para Reports48 de proveniência](external/reports48-provenance/manifest.json) acrescenta carimbos legíveis, com impacto explícito em paginação e versão do renderer/retry. Não foi aplicada nem qualificada visualmente.

[Pedido ao dono de CI](owner-proposals/OWNER-REQUEST.json) contém patch completo para gerar PDFs de inspeção, texto e PNGs com LibreOffice/Poppler, preservando os originais e o FAIL funcional. PDF continua sendo cópia de inspeção, não formato novo do produto. 45 mantém compiler/guards; a interface autorizada não foi observada. Nenhuma ref 45/48 foi tomada.

## Entrega ao 60 e autoridade terminal

Código final: **`b371c1f9e7015a78d292baadef3e6cdeed781dc7`**, tree **`9d1b501dd6a919acf24df4a24bf69c8308d90b0e`**. O commit que contém esta receipt acrescenta apenas evidências/documentos ao código testado.

O target observado terminou em `faa30fddb7e7b61696b66fd069f51cf18c51125f`; seu material C28 é `d088708276b48f896ad4e0ecd2a95cb73dc413b1`, qualificação HOLD_NOT_RUN. 60 encerrou sua lease e registrou Reports48 encerrado. [RECONCILIATION.json](RECONCILIATION.json) distingue essas bases: provas da fonte 66 não se transferem à composição C28.

[HANDOFF66.json](HANDOFF66.json) encerra a lease 66 quando publicado por CAS e solicita ACK de 60 na retomada explicitamente autorizada, ou de sucessor autorizado. Não há ACK recebido, retomada presumida, integração, dev merge, deploy ou GLOBAL_RELEASE.

Pendências de aceitação: corrigir/requalificar egress pelo owner designado; obter renderização e inspeção visual reais; executar compiler/guards pela interface de 45; decidir proveniência de Reports48; recompor e qualificar no candidato do integrador. As oito seleções finais, AM/reviews e gates C-G7/D-G8 permanecem com os respectivos owners.

