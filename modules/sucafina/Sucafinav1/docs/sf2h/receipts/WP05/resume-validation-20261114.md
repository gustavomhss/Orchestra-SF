# WP05 — retomada e validação de 14/11/2026

**Estado: DRAFT / BLOCKED.** A retomada autorizada pelo usuário foi executada em `astra-wp05`, PR [#24](https://github.com/gustavomhss/Orchestra-SF/pull/24), contra `sf2-stack`. Há correções de produto e novas provas publicadas. A seleção completa termina com **114 PASS / 3 FAIL**; a seleção dirigida dos navegadores termina com **7 PASS / 0 FAIL no mesmo produto**. O typecheck continua bloqueado. Nenhum dos 108 critérios tem aceite integral.

## Identidade e escopo

| Referência | SHA |
| --- | --- |
| Head anterior à retomada | `eff8e9dccae6ed3b2fd7c308d245fa62a11facbd` |
| Handoff | `c4bd6592718b3862afbc7bb601c001365e593c20` |
| Plano | `dbf9547211d9b0fade619790de7c19c0869b7c7d` |
| Seed | `b33541ede0fd715fc0990aebeb3fe484d0991cb7` |
| Produto final verificado W | `8f8a1a72dec4065c4cfb798d6d48ca13ca6d5760` |
| Árvore W | `df075cdff32de5668ad7ec7bcf5798e4a5a8e2c2` |
| Snapshot Full35 S | `e4c521993fc13b3844f5523a4863d1fbff700177` |
| Snapshot Target3 S | `babee8dfb85701fd74a4832d68545b943faae3f7` |
| Base do PR observada no fechamento | `6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0` |

A sessão anterior tinha encerrado com DRAFT/BLOCKED em 13/11/2026 às 22:50:55 UTC; o head anterior estava parado e não havia run WP05 ativo na inspeção inicial. A inspeção não alcançou o backend vivo da sessão anterior e não prova revogação de executor. O único escritor desta retomada usou atualizações de branch com `expected_sha` e `force:false`.

As mudanças ficaram nos arquivos próprios de analytics, testes WP05 e recibos WP05. Não foram integrados deltas de outros owners, alterados contratos, fixture compartilhado, engines ou host comum. A exceção estreita de workflow `.github/workflows/astra-wp05-check.yml` já existia e permaneceu inalterada nesta retomada. Não houve execução local de produto; testes e typecheck foram executados por GitHub Actions.

Este recibo é acrescentado depois de W. Seu commit contém apenas documentação; as execuções aqui citadas verificam W, não o novo commit documental.

## Correções de produto

1. **Seleção aprovada e referências:** `approved-catalog.ts` captura a seleção antes do primeiro await, entrega cópias ao resolvedor e detecta alterações durante resolução e validação final. Referências resolvidas também são capturadas antes do último await. Uma anotação de tipo própria remove o TS7006 anterior.
2. **Contexto e evidência contextual:** `contextual.ts` captura o caso antes de awaits, entrega cópias a callbacks de seleção/verificação, detecta alterações materiais e evita devolver referências compartilhadas com o verificador. A projeção persistida é capturada antes de abrir a tabela.
3. **Sensibilidade disponível:** `view.ts` impede o fallback genérico “Gráfico indisponível” quando existe uma decisão renderizada. A projeção BI11 persistida com valores deixa de apresentar uma mensagem falsa de indisponibilidade.

Os oito novos casos de mutação/TOCTOU passam no Full35 final. Os runs de contraprova anteriores registram os failures no produto antigo: sete negativos falharam no primeiro run; o oitavo precisou de uma mutação aninhada mais forte e falhou no segundo. O primeiro caso de retenção apenas reatribuía arrays e não demonstrava a falha; isso permanece explícito no ledger. Não se atribui ao primeiro run uma falha que ele não observou.

## Provas novas

- Planner real: waterfall com contribuição zero; mesma seleção por clique, Enter e tabela; FTE agregado e custo HC indisponível nos papéis finance/viewer, sem sentinelas de dados pessoais, com período visual comum.
- Procurement real: registry, port e dispatcher restritos reconciliados com todas as linhas/marcas/refs de estoque e aging; ciclo de dez estados abertos por comandos persistidos, incluindo rejeição/ressubmissão sem coorte histórica; pedido mais antigo conhecido e idade ausente mantida.
- Planner e persistência: training zero versus null, revogação específica de fonte com sessão válida, todos os componentes e pontos de sensibilidade conciliados com tabela/marca/ref e seleção por teclado/clique.

O helper próprio `test/product/wp05/browser.ts` reutiliza a página autenticada do fixture real, fecha a instância em finally, aplica limites explícitos de 10s por ação/navegação e prazo interno de 60s por corpo, registra a fase e preserva erro primário e erro de limpeza juntos. O prazo global existente de 180s não foi aumentado. Os asserts reais foram mantidos; não há retry ou conversão de failure em success. O fixture compartilhado não foi modificado.

## Validação final

| Execução | Resultado | Evidência |
| --- | --- | --- |
| Full35, W final | **114 PASS / 3 FAIL**, 117 testes, 35 arquivos, 1148 expects, 266,40s | [run43535162840](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43535162840), job132262274583 |
| Target3, mesmo W | **7 PASS / 0 FAIL**, 3 arquivos, 671 expects, 20,50s | [run43534686609](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534686609), job132260696884 |
| Check canônico, mesmo W | **FAIL por typecheck:** 183 diagnósticos; guards e igualdade de working tree PASS | [run43534688410](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534688410), job132260702673 |

### Três falhas preservadas no Full35

1. **Dashboard:** o produtor do seed omite `milestone:p:undated:date`; o teste exige a linha com valor null/evidência ausente. O assert real continua habilitado. O par compatível scope/port está identificado no owner WP02 e não foi integrado aqui.
2. **Capacidade finance:** o corpo excede 60s na fase `render`, que inclui importar o bundle e executar `renderBiView` por `page.evaluate`, antes das verificações de filtro/capacidade. A limpeza também falha: nenhum processo vivo listado, porém transporte conectado e RPCs de fechamento pendentes. O erro primário foi preservado. **Não foi isolado se a causa é importação, renderer ou transporte; não é conclusivamente um problema externo de infraestrutura.**
3. **Approver/mais antigo:** o fixture compartilhado falha em `context.newPage()` antes do corpo WP05. Não alcança DOM, clique ou `port.read`.

Os casos finance e approver passam no Target3 do mesmo W, com asserts concluídos e limpeza comprovada. Isso demonstra o caminho isolado; **não apaga suas falhas no Full35**. Sete blocos de browser do Full35 registram conclusão dos asserts e limpeza bem-sucedida. Não se fizeram novas repetições para selecionar um resultado verde.

### Typecheck e guards

Os 183 diagnósticos finais compreendem 141 em caminhos externos e 42 em caminhos WP05: quatro exports de contrato ausentes e 38 diagnósticos de cascata já existentes. Comparando a multiplicidade por arquivo e código TypeScript com o baseline184, a única mudança é `approved-catalog.ts / TS7006: 1 → 0`. Isso não equivale a typecheck aprovado; nomes/linhas podem mudar sem alterar o inventário.

Guards: **78 regras, 616 caminhos alterados contra a base configurada, 0 gates, 13 warnings, 0 erros**. Um warning novo próprio, `test-timeout-raised`, vem dos limites explícitos de 10s no helper para diagnóstico e limpeza; o limite global não aumentou. Os outros12 warnings são herdados: dez de dependência, o criteria.json histórico acima de1MB e um doublecast externo. A base de guards foi `origin/dev` em `a1d37698a7bb097c1578f827eba6a19b9917ef07`, merge base `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`.

O [artefato14089316990](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534688410/artifacts/14089316990) foi baixado e inspecionado: product.json, typecheck.log e guards.log. SHA-256 do ZIP: `9c6638c4afb02c1f120b3c5fe1663f11cd4720a65fcc9944599a45f9c62ddc56`. Os hashes de cada arquivo e logs completos estão no ledger JSON.

## Matriz conservadora

| Estado delimitado | Anterior | Retomada |
| --- | ---: | ---: |
| VERIFIED_SCOPED | 43 | **49** |
| PARTIAL | 27 | **22** |
| BLOCKED_EXTERNAL | 38 | **37** |
| Total | 108 | **108** |
| Aceite integral NOT_ACCEPTED | 108 | **108** |

Promovidos apenas com prova positiva no Full35: T01.CMP.01, T01.CMP.02, T03.CMP.01, T03.CHK.01, T03.CHK.04 e T05.CHK.03 (todos prefixados WP05). T03.CMP.02 passa de BLOCKED_EXTERNAL para PARTIAL pela composição real do requester. T02.DOD.02 e T03.SUC.02 permanecem PARTIAL após os resultados divergentes das seleções.

Os 108 IDs e textos foram comparados ao pack canônico sem omissão, acréscimo ou alteração de requisito. O registro histórico103 tem 102 nomes retidos, 15 novos e um nome aposentado: **C034 foi substituído pelos casos finance e viewer**. Não se apresenta seu nome antigo como executado no run117. IDs Fxxx pertencem ao Full35; Txxx ao Target3; Cxxx continuam históricos.

## Dependências e próxima correção concreta

| Item | Responsáveis | Evidência observada / ação necessária |
| --- | --- | --- |
| Contratos / typecheck | WP00 + S0 e owners dos diagnósticos | WP00 `29f40e0f0fafa8d526df9b280151962187f1440d` fornece BiPresentation, SfBiArtifact e sensitivityResultRef. Integrar os deltas compatíveis e fechar typecheck/admissão; não foram copiados para WP05. |
| Marco sem data | WP02 + S0 | WP02 `ae06ed61b7dff57aaf10f7ffdcc348a355374fbb`: integrar scope/port em conjunto preservando identidade de fonte/digest e repetir a prova Dashboard→BI. |
| Composição de browser | WP05 + owner do fixture, via S0 | Isolar lifecycle/import/render/transporte da execução composta e preparação de página. Corrigir a causa observada e revalidar; não atribuir automaticamente ao owner externo. |
| Host e navegação | WP10 | Compor catálogo de produtores reais, destinos C17 exatos e retorno; registrar UI/native/MCP e artefatos persistidos reabertos no mesmo produto instalado. |
| Cobertura e sensibilidade | WP03/WP11/WP13 | Consumo compatível de cobertura completa; resultado integrado ainda condicionado, total/threshold null. A prova55000 cobre apenas solver do subtotal conhecido. |

Os pins dos owners foram observados durante a sessão ou preservados do handoff, conforme discriminado no ledger; não se afirma que sejam heads futuros. Permanecem ainda as provas WP05 de dois painéis de capacidade positivos numericamente e revisão training no mesmo caso com escolha/histórico imutáveis.

## Limites de proveniência

As árvores Git de W e dos snapshots de teste diferem somente por `.ci-run.json`. Isso comprova os inputs Git; o test-ci existente não congela instalação nem comprova igualdade do working tree instalado. A lane check usa `--frozen-lockfile` e verifica `git diff --exit-code HEAD` depois das verificações. Não houve artefato Playwright publicado na lane de testes; as fontes são logs, requests e metadados de run/snapshot.

O verdict Omni do Full35 foi: `omni positive control [aa4bf18c69c0c33b85ad8216157cd026]: not applicable (focused: no declaring test ran); this run made no omni spawn and delegated none, so it proved nothing about omni.`

Não há prova de host instalado, consumidor nativo/MCP/provider ou residência durável a partir desses harnesses. A branch e o PR continuam abertos em Draft; não houve merge ou deploy.

## Recibos desta retomada

- [Ledger de CI e falhas](resume-ci-20261114.json)
- [Matriz legível108](criteria-resume-20261114.md)
- [Matriz completa e registros de casos](criteria-resume-20261114.json)
- [Origem e limites dos discriminantes](resume-proof-notes-20261114.md)

Os recibos anteriores permanecem inalterados e representam seus próprios pins e execuções.
