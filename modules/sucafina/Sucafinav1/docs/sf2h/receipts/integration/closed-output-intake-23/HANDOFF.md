# Missão23 — integração publicada na mesma PR65

Estado: **TERMINAL_BOUNDED_INTAKE_HANDOFF_TO_S0**. A continuação autorizada de S0-C publicou quatro incrementos consumíveis em `sf2-stack` / PR65 e seus checkpoints. O produto fica identificado como **C4, congelado e sem qualificação funcional**. Esta entrega encerra o recorte atual da integradora; não encerra a campanha, as lanes de origem ou os findings obrigatórios.

## Identidade e autoridade

- C4: `253baad3f2ff4af5beac695feae4c2f6372dc2e7`.
- Tree C4: `c3648fca57012f6e6934e207e02c88c75cc6eb3a`.
- Checkpoint de identidade/ACKs/readback de C4: `402a091485e11d60dff433049c7dedd7fcead687`, tree `006339cc3a61de9bf99d2ba17069181bd5d8a02e`.
- Este handoff e seus manifestos finais são uma camada documental posterior. Seu commit deve ser obtido pelo head real da PR65; não é um novo candidato de produto e não é D/G8.
- Head recebido e reconciliado da missão14: `d8ab1d3321a76870ed3092ba043fe1b5781a2c23`.
- Autoridade original23: `233e9acb7c048dda3d8174d87b76f1e8441f4917`; COMMON, missão23, AGENTS, START, WORKFLOW, execution COMMON, pack completo S0-C e appendices obrigatórios lidos conforme os recibos.
- Última autoridade observada no censo de `2026-11-14 21:16:09 UTC`: `sf2-control@86dfe5cd709a4d1701a21b877c2feb92924b08c8`. Reconciliados integralmente COMMON de validation-wave e missões26–32. Continuam preservados o writer exclusivo23 e o dispatcher/aceite finais de S0.
- Planejamento: `dbf9547211d9b0fade619790de7c19c0869b7c7d`; T0: `2026-11-13T04:01:10Z`.
- Escopo integral: **15 WPs, 74 tarefas, 17 contratos, 1610 critérios, 5 perfis e 18 skills**. Digest canônico: `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`. Nada foi dispensado.
- C original `b62c32940d06c15c04f52b88209d5b4930cf1a3e`, C2 `0ce090d7d1d4399d77b435debd59eb7cc903c202` e C3 `9cc27888581a13b55992cdb5dfbd27e43479ac29` permanecem imutáveis e sem aceite transferido.

## Commits materiais e inputs consumidos

| Incremento | Commit integrado | Inputs e recorte |
| --- | --- | --- |
| 01 | `d81dc320a82044009dd4c39f2e5d062ad46719a9` | C12/PR60@`c8a03c4f689025ca70a1c815fd292af22b6261cd` + Finance18/PR42@`d8d586e19c824f75a88494a9c3677faac617e81d`; 36 paths. |
| 02 / C2 | `0ce090d7d1d4399d77b435debd59eb7cc903c202` | Memory13/PR29@`539a3c7f95174190f783debc74e3694d84ca8653`; 56 paths. |
| 03 / C3 | `9cc27888581a13b55992cdb5dfbd27e43479ac29` | Decisions20/PR40@`556079fe2fb97c824504ec60a47798c6e0553539`; 23 paths de origem + montagem HTTP. |
| 04 / C4 | `253baad3f2ff4af5beac695feae4c2f6372dc2e7` | Portfolio21/PR67@`ac7d29397db0f639237cdb39fb0754d59c1a929d`: 88 artefatos + seis destinos P01. Operations24/PR23@`0042a95967ad651fe65ac0da216db6af86ed804c`: 23 paths de origem + dois seams compartilhados. |

O manifesto consolidado contém **235 paths de origem/montagem**: 13 arquivos de produto, 32 testes/helpers e 190 artefatos originais. Os 235 blobs selecionados foram conferidos no candidato; para o arquivo CLI de Memory, a identidade foi conferida em C2 e a ausência de alterações posteriores foi confirmada pelos diffs completos. Os modos e diffs de cada incremento foram conferidos por GitHub MCP. Esses números excluem os recibos próprios desta missão e as cópias inertes da revisão Operations ainda não consumida.

[Manifesto integral de proveniência](provenance-manifest.json) · [ACKs consolidados](consumer-acks-final.json) · [Pendências por owner](pending-owners-final.json) · [Censo de fontes](source-census-final.json) · [Identidade C4](candidate-C4.json).

Os ACKs detalhados de cada incremento registram source SHA, integrated SHA/tree, paths, blobs, consumidores, limites e findings. Os originais continuam em `consumer-acks-01.json` até `consumer-acks-04.json`.

## Montagem realizada e preservação

**C12/Finance.** Apply recebeu os quatro hunks publicados sobre o executor Finance, gerando `6ad51e47b22eca073a0a81731575c463d98673e4`. Permanecem o CAS normal, reserva e reconciliação atuais, OPS-REV02, o vínculo exato do recibo e a recusa de redispatch sem recibo original. Os dois produtores Finance18 foram integrados sem substituir o provider, o local-store ou as fixtures mais recentes.

**Memory.** Os dois produtores fechados, seis testes/helpers e 48 recibos foram admitidos. O case-port atual, mais estrito, foi preservado após conferência dos contratos usados. A implementação focada não fecha MI07, C17, X29, restart→recall→UI nem provas nativas.

**Decisions.** A UI de alternativas iniciais e o estado de edição foram compostos preservando os comportamentos PR43 e os três casos nominais anteriores. A montagem HTTP usa os três hunks publicados; o arquivo de edição foi reconciliado por 22 hunks sobre o preimage real. A proposta opcional de coverage-read continua inerte.

**Portfolio.** P01 entrou atomicamente: finalizador, verificador e quatro destinos de teste, com nove hunks e postimages exatos. Finance18 e os 19 KEEP_CURRENT permanecem preservados. P02 está retido pela incompatibilidade da fixture de recibo com o contrato atual C12; P03/P04 ficam retidos pelas dependências declaradas de P02. Todos os 88 artefatos foram preservados, inclusive os patches retidos.

**Operations.** O pacote parcial0042 transfere explicitamente sua montagem à sessão23 e foi consumido com os cinco fontes/testes, host e selector. Os seis hunks e os 17 bindings diretos conferiram; os cinco corpos nominais não foram alterados. O inventário direto e os 723 paths delimitados da origem não são apresentados como prova transitiva exaustiva.

## Revisão Operations49: pronta para reconciliação, sem ACK de consumo

O censo encontrou `49d29bf4d6512d130307f46e145885949f213ea8`. Seu patch compartilhado está READY, mas o README e a ordem de aplicação exigem as identidades do handoff terminal dos fontes; o teste corrigido ainda contém `source_commit: "Pinned by terminal handoff after this fix is committed"`. Esse handoff não apareceu no censo. A integradora **não substituiu essa condição pela simples localização dos bytes no Git**.

Os três deltas incrementais sobre C4 já estão completos e verificados em [operations24-revision-disposition.json](operations24-revision-disposition.json):

- Host: `8ba8d97ec138265454507852a5ab50b600b96c60` → `8230eb28f322dde255382b74280192f39844724d`.
- Teste mount-boundary: `508f4580d0decb1d5c97208fed650f51d8566045` → `eddc60289524c374f970ea226632a030fc9b994d`.
- E2E tsconfig: `8364221434311400cae3007ea74cc67ddcfde765` → `fd63fd70922e9cc243626b52302ecd7774e4b478`.

Host/teste configuram o limite de16MiB pelo Settings/save real; o tsconfig acrescenta três includes Operations. Selector e helper de instalação já coincidem. **Nenhum desses três deltas foi aplicado em C4 e nenhum C5 foi publicado.** As 18 alterações de origem49 estão preservadas como cópias inertes sob `observed/operations24-49/`, com hashes e caminhos originais.

Owner24 deve publicar o handoff exigido ou uma liberação parcial explícita independente dele. A próxima integração deverá revalidar o head e aplicar a unidade inteira como novo candidato, sem reaplicar o patch antigo completo sobre o host já composto. Os includes de Operations não encerram a missão26, que cobre as três specs e o gate canônico.

## Pendências que impedem aceite

O registro [pending-owners-final.json](pending-owners-final.json) preserva os IDs herdados e contém20 itens atuais. Principais ações:

| Owner | Pendência e ação concreta |
| --- | --- |
| Finance22 / PR42 | FIN-IND-005 continua OPEN_IMPLEMENTED_NOT_CLOSED. A jornada longa falhou na origem sob180000ms antes de15000/15001, histórico/replay/reabertura. Entregar provider/case-port fechado, hunks compatíveis e fixture legacy explícita; o head observado22 `1a656f1f7251de8c104e5b03a43b457e80437181` não foi consumido. |
| C12 continuação32 / PR60 | Reproduzir a incompatibilidade estática dos oráculos legados com a reconciliação Finance atual. Qualquer mudança de oracle exige contrato canônico e par positivo/negativo discriminante. Não regredir o executor nem trocar409 por200 sem prova. First-save/lost-register continuam abertos salvo prova específica. |
| Portfolio21/WP13 + C12 | Reconciliar o produtor de recibos da fixture P02. **A mesma incompatibilidade também existe no preimage preservado**: proof de receipts isolado versus cases+receipts+domainSurface. Reter P02–P04 não elimina o finding do C4. Preservar sucesso, unicidade e budgets; não forjar scopeDigest. |
| Finance/WP11 + WP10 | CurrentChoice/PR35@`ec052c2c3bef96f492512f3d5f663919580f25c8` continua HELD. P01 não o resolve. |
| Memory / S0 | Completar MI07, C17 entre observações, X29 e provas instaladas/nativas, sem elevar225000/240000 nem transferir passes focados. |
| Operations24 + ambiente/S0 | Resolver a identidade terminal49; scanner real aprovado ainda ausente. A origem informa que o workflow não o provisiona e a allowlist atual não aceita SF_OPERATIONS_CLAMD_PORT. Qualificar regressões e cinco jornadas após composição/recursos reais. |
| Decisions31 / PR40 | A continuação explícita usa a UI/montagem já publicadas; concluir jornada humana, cobertura histórica/CAS, Apply/recovery e reabertura. Não recriar a UI nem substituir ações humanas por POST/seeds. |
| Reports25 / PR27 | Head `bc587cebc9f2e46e48a3e828b83fe15cfaf2fc45` contém código ativo, sem novo fechamento25 observado. Entregar pacote coerente C05/Work/export/reopen/revogação, patches compartilhados e quatro resultados nominais. |
| Tooling26 / PR32 | Head segue `5c41125e7ef17a6c7eff9c9fb2329fe8f85ce982`, preparação anterior. Entregar cobertura real das três specs e helpers transitivos no gate canônico. |
| Routines30 / PR30 | Adapter nativo real e montagem completa de host-context ainda pendentes; não inventar admissão/run nem segundo ledger. |
| S0 + reviewers27/28/29 | Reconciliar as revisões preparadas sobre C2 com C4 ou futuro candidato. Obter três verdicts FINAL independentes no mesmo C aceito, além de todas as provas obrigatórias. |

## Verificação efetuada e limites

A integradora fez leitura, comparação de árvores/blobs, reconstrução textual de hunks e readback remoto dos commits. **Não executou testes locais, typechecks, guards, CI, epic, AM ou reviews finais; não alterou refs de workflows.** Nenhum resultado de origem foi transferido ao bundle.

Permanecem explícitos os resultados desfavoráveis de origem: Finance S3 FAIL; Memory MI07/CHECK36 FAIL; checks Decisions FAIL e nominal NOT_RUN; Operations nominal antigo5FAIL/0ações de negócio e boundary posterior2PASS/3FAIL sobre0042. O check Operations SUCCESS sobre0042 também não qualifica C4 nem49.

Continuam obrigatórias as oito seleções CI-SF, CI-CLI, CI-APP-SRC, CI-APP-BROWSER, CI-ATLAS-BUSINESS, CI-UI-OPERATIONS, CI-UI-DECISIONS e CI-UI-REPORTS; geração, cinco typechecks, spawn/guards; AM01–AM06;39operações/8packs;18skills/5perfis; Atlas/scanner/restart/consumidores quando exigidos; C/G7 e D/G8. Nenhuma seleção foi disparada aqui.

Todas as publicações usaram exclusivamente GitHub MCP, expected-head e force=false, na mesma PR65. Não houve merge em dev, novo supervisor/dispatcher, escrita nas branches de origem/controle, Goal resume, engine/política financeira alterada, instalação de serviço, deploy, restart ou mensagens a terceiros.

## Retomada e responsabilidade final

S0 recebe este candidato e suas pendências pelo handoff escrito; conserva o dispatcher e o aceite finais. A próxima continuação da integração deve ler este handoff, conferir o head real da PR65 e qualquer autoridade posterior, preservar os registros anteriores e usar CAS sem force. Fonte ativa não deve ser substituída nem considerada encerrada por silêncio.

Qualquer admissão material após C4 exige **novo candidato explícito**, com novos ACKs/proveniência e rechecks pertinentes. Uma camada documental não transforma o C4 em produto aceito. **GLOBAL_RELEASE=false.**
