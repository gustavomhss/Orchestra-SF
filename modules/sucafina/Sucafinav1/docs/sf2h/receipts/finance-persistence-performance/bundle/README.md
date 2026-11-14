# Missão34 — pacote W3 para sessão33

**Estado do target: NOT_APPLIED_NOT_TESTED.** O pacote contém a composição textual de W3 sobre os preimages observados de PR65, com todos os cinco testes publicados na origem. Não houve aplicação no bundle ou execução de código de produto/teste nesta preparação.

## Origem e destino

- Origem: PR42 / finance-resume, W3 `ebbc90dd3a325e2e8367f4e915ddd193a78b9220`, tree `e1ec7c748bd094585dfdbdf0cfbd019782ade908`.
- Parent real de W3: `17bab9f471a818be1631652d3ec0adcec00d52bf`.
- Base de derivação solicitada: W1 `0b4c633809166ff7165ad8440c3c08b5d25c727d`.
- Target: PR65 / sf2-stack, `bf81f9776b6ba5fb6267828a9a029d7e8d6f5587`, tree `f2027afd2be824ad1bb1a4116044fd1be0760039`.
- Preimages e ausência do namespace foram lidos por GitHub MCP às 22:21:40 UTC de 2026-11-14. A ref foi reconfirmada, no mesmo head, às 22:25:22 UTC.

## Arquivos de consumo

- `product.NOT_APPLIED.patch.txt`: somente o delta de local-store sobre o bundle.
- `composed-with-tests.NOT_APPLIED.patch.txt`: mesmo delta de produto mais cinco adições exatas de testes.
- `manifest.json`: identidades, preimages/postimages, dois estágios de composição, cinco testes, diferenças preservadas, pré-condições e limites.
- `source-W1-to-W3.patch.txt`: proveniência do delta da origem W1→W3.
- `textual-audit.json`: reconstrução de todos os hunks sobre os preimages salvos, conferindo os seis postimages.
- `target-observation.json`: pin de destino e reconfirmação da ref.

Na entrega publicada, os preimages de produto estão em `../preimages/` e os postimages de local-store em `../postimages/`, com extensão `.ts.txt` para não entrarem no typecheck. Contract composto permanece igual a `../preimages/composed-contract.ts.txt`. Os cinco testes exatos estão no patch composto e no commit W3. Caminhos de trabalho locais registrados no manifesto são proveniência da composição, não arquivos executáveis desta entrega. Os scripts e entradas temporárias de reconstrução não integram o patch nem os recibos publicados.

## Produto e diferenças preservadas

| Arquivo | Preimage do bundle | Postimage proposto |
| --- | --- | --- |
| local-store.ts | `b753e3ffbfcdc06de373388845c686afac26dec8` | `e9da289bdce680f2429904c1e83dec60c39aa2a8` |
| contract.ts | `9e9bac976b503409de65868a366f352ca1e65071` | Mesmo blob; KEEP_CURRENT_EXACT |

O local-store publicado na origem tem blob `02365b6a87b4726aefb4292555fc5ae5ac085bb7` e 29961 bytes. O postimage composto tem 31405 bytes e SHA256 `4f16fe7291f763ffba129ba024e6ee0b001d05b6769d0445f049c8869fc54311`; a diferença conserva o trabalho já existente no bundle.

Permanecem byte a byte os corpos de `cloneSnapshot`, `copyValue` e `validateSnapshot`, além de `cloneSnapshot` nas três superfícies de `currentSnapshots`, `cloneSnapshot(staged)` e `validateSnapshot(decode(envelope[2]))`. Em contract, permanecem `Result.fieldErrors`, `Result.currentVersionCAS` e o valor retornado por `conflict`.

O produto foi composto em dois estágios: os seis segmentos originais W0→W1 sobre o bundle, obtendo o postimage histórico `46b9116cc272f8f6760dd1766f9451c7903005b7`; depois os nove segmentos W1→W3. A comparação textual confirmou a preservação integral do delta já existente entre Finance e bundle durante ambos os estágios. O patch final de produto contém seis hunks.

## Cinco testes exatos de W3

A listagem completa do diretório pai `test/product` no target observado tem 32 entradas e não contém `finance-persistence-performance`. Portanto, os cinco preimages abaixo são ausentes. A árvore de testes da origem é `e3e7028c4b6f79319c4907d3046a1fa2467e0714`; todos os arquivos têm modo100644.

| Teste | Postimage exato |
| --- | --- |
| profile.test.ts | `c4fc07221d7273c6f0cd50180180b362dff30cb0` |
| isolation.test.ts | `0492b09ed2c7ef2d56c3ef0a7138dbb922231b46` |
| bounds.test.ts | `5336cce8cf2e61722d6a14c8a9665c6a983b5622` |
| scope-profile.test.ts | `f63caa1f12c5efe8cbfc12067734f4c3c1a30c8b` |
| surface-demand.test.ts | `8a81665075aab6f8afa37105d3174d698f18bb9e` |

Os testes profile e surface-demand coincidem com os candidatos de `mission34/third/`; scope-profile coincide com `mission34/second/`; isolation e bounds conservam os blobs W1. Os arquivos candidatos foram apenas lidos e sua identidade foi reconferida depois da preparação.

## Hashes dos patches

| Artefato | Bytes | SHA256 |
| --- | ---: | --- |
| product.NOT_APPLIED.patch.txt | 8961 | `e06bc8d5cb98e950597813b3c020acbd9df5de2befec4920dceedd5c2953ec19` |
| source-W1-to-W3.patch.txt | 4154 | `8280858c33708339f3d8fce4602c1fc7dfc371cef960a2be2474dd3ed59fc336` |
| composed-with-tests.NOT_APPLIED.patch.txt | 76415 | `f483c07f69b56beb93a600c1ed84fd3100d0f40bb7897de5c05f7b3f4885c1e1` |

O patch composto tem exatamente seis caminhos: um produto e cinco testes. Contract e recibos não aparecem como modificações. A auditoria textual aplicou os hunks em memória aos preimages salvos e reproduziu todos os postimages declarados; isso não executou código de produto nem testes.

## Pré-condições de sessão33

1. Ler o handoff terminal de missão34 e confirmar a identidade final da origem. W3 é um commit publicado; os resultados de CI/jornada são registrados pelo owner em seus recibos.
2. Reobservar PR65/sf2-stack antes da escrita e reconciliar qualquer mudança de head.
3. Exigir os dois preimages exatos de produto/modes e a ausência dos cinco nomes de testes. Uma divergência exige nova composição.
4. Aplicar somente o delta incremental e as cinco adições, mantendo contract e o restante do bundle. Publicar pela autoridade vigente da sessão33 via GitHub MCP, expected-head CAS e force=false.
5. Qualificar o candidato composto pelo dispatcher autorizado. Resultados de origem não qualificam automaticamente o target.

Os pacotes W1 e o resultado desfavorável S2 permanecem como evidência histórica. Este pacote não declara fechamento de FIN-IND-005, não converte checks herdados em PASS e não constitui handoff terminal. Nenhum teste local/remoto, typecheck, guard, servidor, mudança de ref ou escrita remota foi executado na preparação.
