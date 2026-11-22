# Registro de execução — frente go-live — 22/11/2026

**Este é um índice de provas observadas e integrações. Não é aprovação dos gates finais.** Os recibos originais permanecem nos artefatos de Actions. [status.json](status.json) distingue campos finais ainda nulos dos candidatos de trabalho abaixo.

Observação do consolidado: `2026-11-22T14:22:35Z`. Dev observado após os três complementos: `a71033f21b2c0f7da508c96f302506a9e73fd145`, árvore `d86fa6c35359fd1437504435a48b0a4363ac8122`; referência de integração, não candidato final confirmado.

## Identidade das entregas iniciais

| Gate | Dono da entrega | Fonte testada | Árvore | PR / integração |
| --- | --- | --- | --- | --- |
| G05 | Astra go-live | `db896193346305fb1fee2d0d389cfc0b73077a01` | `027c26022afe0ef74ae61f40c21e8e5b0b3995c6` | [#637](https://github.com/gustavomhss/Orchestra-SF/pull/637) / `48768330ce2bdd6dc6673cd0b4926b61778e3bd4` |
| G06 | Astra go-live | `9a6b7323bb35463005c978af5257f4107f7e62d1` | `b189a570fd57ce9cc6a39c1c41dbb321de9cdb2d` | [#638](https://github.com/gustavomhss/Orchestra-SF/pull/638) / `babc660b2cda3e20ed6b68ecab86b973110652cb` |
| G07 | Astra go-live | `b7edac10a2e9bbe10fec6ec1318f568ccde74813` | `fa8734cdf99883488183b5ef423c48d608ba116e` | [#640](https://github.com/gustavomhss/Orchestra-SF/pull/640) / `f07690a41ccf090a39a76ce2733323a98c75c326` |
| G08 | Astra go-live | `aa928b6ae4a5944e5dad4b5bd206d5c123d2238e` | `36794c205023010cf43dc29d6856340f4ed325ea` | [#644](https://github.com/gustavomhss/Orchestra-SF/pull/644) / `ab54723003859c01251617716272ad7ebd834fb6` |
| G10 | Astra go-live | `f5b22050bbe04c228576dbe5ca1356cafbe1f431` | `28a6d7cd0cbecaf6d3f3d364c81cda1bca9ca5c0` | [#639](https://github.com/gustavomhss/Orchestra-SF/pull/639) / `e1ed546cac909208959f60734d601723d3101662` |

Os merges integram ferramentas e controles revisados. Migração e Release ainda não confirmaram um C/T final contendo essas entregas e G01–G04/pool. O estado de dev observado não substitui esse pin. Revisões independentes de assistentes foram registradas como comentários técnicos; não são uma aprovação formal por outra conta nem um aceite operacional dos donos.

## Complementos integrados nesta revisão

| Gate | Fonte testada / árvore | PR / merge confirmado |
| --- | --- | --- |
| G05/G06 | `c7d90669f3b2b7fd3c6a35c9ec2fc5322d9f8898` / `ef239daab90453d69d678ddabc5e2de921d8be74` | [#660](https://github.com/gustavomhss/Orchestra-SF/pull/660) / `ca490e9802248ad2f7bf71f9b4daef5790415bbf` |
| G08 | `0c40f0c26c4a9a56c3825d9bb4538fffb104ade4` / `449b0d99afaf8d84aa4066fb255a88f040260e49` | [#659](https://github.com/gustavomhss/Orchestra-SF/pull/659) / `a71033f21b2c0f7da508c96f302506a9e73fd145` |
| G10 | `9714cd1819e2f0f5158210076268ac2bb0e5f9fb` / `25139019a6152f771dfdcb977267f1c5d6b9146a` | [#658](https://github.com/gustavomhss/Orchestra-SF/pull/658) / `1773fe7fcff1e291e7f15786f42262af3bb40d3c` |

O readback do GitHub confirmou as três PRs fechadas por merge. As comparações fonte → merge preservam os blobs revisados; os deltas adicionais são de outras integrações de `dev`. Nenhum workflow efêmero de validação de G10 nem snapshot `.ci-run.json` de G06 foi incluído nesses merges.

## G05 — prova HTTP e Team

[Run 45024901473, tentativa 1](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45024901473), fonte `db896193346305fb1fee2d0d389cfc0b73077a01`. **Estado do replay: success, 5/5 jobs.** Coverage/auth/effect: 409/409 cada, zero fail/skip/missing/extra; Team: 11 controles/123 asserções; Server/Sucafina types e 78 guards aprovados.

| Bundle | Artefato | SHA-256 do ZIP |
| --- | --- | --- |
| effect | [14756065892](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45024901473/artifacts/14756065892) | `d12edf58b1ef8365cb0de9e3f8bcc9a3c8cffcc6a1b8bde2df33f1c3769bdf2e` |
| validation | [14755800231](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45024901473/artifacts/14755800231) | `f622c6a7228de0d06281f914a78dcf30f4ecd161fb5bc9205df27f335eef3aa1` |
| teams | [14755382665](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45024901473/artifacts/14755382665) | `077c56778054225b2423cbeabb007a0c39e87dba3e2f4d533cd4c9e9e23eec74` |
| coverage | [14755013627](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45024901473/artifacts/14755013627) | `693773f32f5cc2440a6388c0c1bbf31158b2f05815538cbd9cf8837592e1f4fe` |
| auth | [14754728044](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45024901473/artifacts/14754728044) | `b87ffb8edf45c698934bdd925d9baf82e9ce4db8aa90af14e7b962fc0d011fe6` |

Os cinco bundles foram baixados e conferidos por digest/tamanho. Foram verificados **39 hashes internos** (10 em coverage, 10 em auth, 10 em effect e 9 em Teams), além da identidade C/T/run/attempt, status, cleanup e logs de validação. Auth observou 819 requisições/respostas e peers do listener; effect observou 642, encerrou 409/409 listeners e registrou 4.789 spawns Omni/zero delegações; Teams observou 16/16 passagens pelo ingresso Microsoft. Coverage é catálogo: não afirma execução de HTTP.

Os recibos têm schemas `orchestra.g05.httpapi/1` e `orchestra.g05.team-http/1`, com `installedTeamsProof:false` e `finalCandidate:false`. A prova Teams usa a factory Microsoft com Entra/JWKS/Graph controlados. A limpeza recusa um global vazio e verifica ausência dos diretórios próprios antes do positivo. O PASS de `5c4cb48a…` no run 44999009678 é referência anterior; não é herdado por este head.

## G06 — scanner e aplicação reais

[Run 44998523282, tentativa 1](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44998523282), job 137134720749, success. Snapshot somente de requisição `a99d4c650c30ae6581d23c7463e1379757778348`; parent/fonte `9a6b7323bb35463005c978af5257f4107f7e62d1`.

| Campo | Evidência |
| --- | --- |
| Controles | 69 do admission/verificador; 8 reais em três arquivos, 218 asserções; zero falha/skip |
| Omni | 4 declarações, 5 spawns reais; sem delegação |
| Artefato | [14744986410](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44998523282/artifacts/14744986410), 25.740 bytes |
| ZIP SHA-256 | `71552dcaa03d1576c6e52047b3f2d6133eca7ebfad98ab931e6337df018bccc8` |
| receipt.json SHA-256 | `7b9098b2af0d097e2ccd9daae4ed75e7176b8a5fa782a577bc7d6f426dad657b` |
| JUnit SHA-256 | `b52e22d0a245c5a362cfa8419d9422d078125e658b63509a3e68797970f631bd` |
| Classe | `COMPONENT_REAL_CLAMD`; `installedTeamsProof:false` |

ZIP e 14 hashes internos conferidos independentemente. Os sete controles originais continuam presentes; o oitavo comprova formato inválido benigno e XLSX truncado, aceitos pelo scanner real e recusados no preview HTTP400/needs-input sem novo efeito durável depois do staging. Cleanup dos quatro fixtures e daemons próprios observado. A identidade privada é local de componente; o resultado não prova a instalação Teams final.

### Complemento G05/G06 — factory Microsoft e scanner real (#660)

[Run 45031531759, tentativa 1](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45031531759), job `137235976665`, **success**. O snapshot `683a1c3a50d869bf7a4d10dcb0fe1f6665f4cf69` tem somente a fonte `c7d90669…` como pai e modifica exclusivamente `.ci-run.json`. Sua árvore é `b5ae74f889138f297acefbcf6625abb27c0d8a1c`; o digest da requisição normalizada é `34c69603a855eb6b85952c53621140803262a70e86a71809257e35da754796de`.

| Campo | Evidência |
| --- | --- |
| Seleção | `controls-with-teams`: oito casos legados intactos, três Microsoft/Team e um caso G05 com seus 11 controles |
| Resultado | 107 controles Node; 12 casos Bun em cinco arquivos; 1.085 asserções; zero falha, erro, omissão ou skip |
| Validação | Typecheck aprovado; Omni: quatro declarações, cinco spawns, zero delegações; 78 guards, zero gate/erro e um aviso |
| Artefato | [14757916479](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45031531759/artifacts/14757916479), 35.388 bytes |
| ZIP SHA-256 | `8fe6d13a8cbe00af4e5a22ff9cac35840576be3787559f2f5d53405607b8e56f` |
| `receipt.json` SHA-256 | `f00b036903238e6c258a224b630097eb429b8997a77cfadc6bf0959d8cdc9526` |
| `microsoft-teams-receipt.json` SHA-256 | `a45ffcf354616bb6d365ccf680ccad9efdc14708b340d16184544922d26988fe` |
| `g05-team-http.json` SHA-256 | `49b8955bcba842e8fd353df6828357a8d786f91fb5ca75b4ba15a35b700cf1b3` |
| JUnit SHA-256 | `96016cedc5f78bcb9ca4d7a860d9d946b1e1fa16da87dde65d369926e75a50fe` |

O root adquiriu os bytes do ZIP, conferiu digest/tamanho/CRC e **todos os 17 hashes internos referenciados pelo agregado**. Os três casos novos atravessam o ingresso original de `createMicrosoftInstallation`, HTTP loopback real, admissão de Team, uploads privados e ClamD real. Observam 26, 21 e 10 requisições, respectivamente, com peer TCP e passagem pelo ingresso conferidos.

Em ambos os Teams: arquivo limpo aceito, EICAR real de 68 bytes recusado com 422 e novo limpo aceito; bytes e versões são conferidos independentemente no SQLite/blobs. O download assinado retorna 200 no Team proprietário e 403 no outro. Instalação, tenant ou seletor/rota divergentes, Team desabilitado e membership revogado retornam 403, preservando os dois estados completos. O daemon secundário pertencente ao job foi parado pelo controle de posse; o suplemento observou `ECONNREFUSED`, recusou uploads com 422 e confirmou o daemon principal saudável.

Os marcadores dos três novos casos Microsoft são emitidos após a limpeza dos respectivos fixtures. O recibo agregado positivo exige também a limpeza dos quatro fixtures legados e dos daemons próprios. O aviso `test-assertions-removed` foi reconciliado: 27 pontos `expect(...)` permanecem no consumidor G05 e oito foram extraídos para o helper compartilhado; os 35 e os 11 IDs originais foram preservados. Não houve waiver.

A prova declara `COMPONENT_REAL_CLAMD`, `MICROSOFT_TEAM_FACTORY` e `CONTROLLED_ENTRA_GRAPH`, com `installedTeamsProof:false`, `finalCandidate:false`, `g06Closed:false` e `teamsPrivateImportProof:false`. O importador nativo `import-admit/import-preview` ainda não está montado em `runTeamBusiness` no código inspecionado. O suplemento de upload não substitui essa obrigação; a prova de importação legada conserva seu alcance local. Coverage/auth/effect de G05 não foram repetidos nessa execução.

## G07 — verificador do tar original

[Run 44999252013](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44999252013), job 137136940722, e [run 44999256028](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44999256028), job 137136954264: **31 controles Node, 18 Python e 78 guards sem findings**. Logs e steps conferidos. Qualificação do pacote **skipped**; nenhum recibo de tar final foi produzido.

A rota admite os dois ACKs reais antes do produtor, vincula C/T/operator/workflow/run/job/ZIP e verifica o tar original pelo instalador de C. Preserva `installation:null`, `g07Closed:false`, `productionCutover:false` até a prova instalada. Não altera o produtor G09 e não gera outro tar. [Rota e procedimento](g07-linux-package.md).

## G08 — histórico do executor privado (#644)

[Run 45003896381, tentativa 1](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45003896381): controls 137151128459 success; installed 137151129591 skipped. **84 controles Node, 28 Python, typecheck, import/list Playwright e 78 guards** aprovados.

| Campo | Evidência |
| --- | --- |
| Artefato | [14746898273](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45003896381/artifacts/14746898273), 4.521 bytes |
| ZIP SHA-256 | `17c1d362a945b23c5b10a3c7c13bffd37ef78a61d49d42e7bbae5c09fc4474a8` |
| inventory.json SHA-256 | `a07736cc9d3467cbeafe71820e8f5524c0e407f71e332697bdb562874def71e4` |
| Recibo | `sf-g08-executor-inventory-v1`, `EXECUTOR_INVENTORY_VERIFIED` |
| Execução instalada | Nove casos `LISTED_NOT_RUN`; `installed:false`, `g08Closed:false` |

ZIP, inventário e listagem foram conferidos independentemente. O executor liga tar/manifesto/current/processo/factory/host/Caddy/HTTPS e observa as respostas das próprias ações de browser. Ele depende dos quatro contextos Microsoft originais e da reserva. A listagem histórica não demonstrava compatibilidade dos seletores com o DOM atual. A correção abaixo preserva essas obrigações e atualiza a seleção executável; os nove registros históricos não são passes nem substituem U15/U39/U40/F04/AZ02. [Matriz e entradas](g08-teams-qa.md).

### Executor reconciliado com os contratos atuais (#659)

[Run 45031917038, tentativa 1](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45031917038), fonte `0c40f0c2…`, job `137237154678`, **success**. O job instalado `137237155856` ficou **skipped**; não houve dispatch nem attach a sessões Microsoft.

| Campo | Evidência |
| --- | --- |
| Controles de ferramenta | 111 Node, 28 Python e typecheck aprovados |
| DOM real com transporte controlado | Quatro casos / 127 asserções |
| Inventário instalado | Sete controles `LISTED_NOT_RUN`; nove obrigações originais e cinco grupos `NOT_RUN` |
| Guards | 78 regras, dez paths versionados, zero gate/erro, três avisos reconciliados |
| Artefato | [14758301449](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45031917038/artifacts/14758301449), 6.819 bytes |
| ZIP SHA-256 | `bbe77eaa6dabaab5df3460815116d8a6e577298543764794f1a38793bd9827da` |
| `inventory.json` SHA-256 | `a6a11a5e79358a283eaae08f0ad1f1cadf7e03f817cadf475d0eb7452db4f657` |
| DOM JUnit SHA-256 | `2632dedd46bc5ff296925e684537a806fd281453a29001e3b20ccd43f5e825f8` |

O root adquiriu o ZIP e conferiu digest/tamanho/CRC, C/T e conteúdo do inventário. O recibo `sf-g08-executor-inventory-v2` declara `CURRENT_CONTRACT_INVENTORY_VERIFIED`, `proofScope:current-teams-subset`, `installed:false`, `g08Closed:false` e `productionCutover:false`. Ele registra dez digests de fontes.

O executor usa o seletor nativo, as respostas originais F02 e a API administrativa observada na integração, com CAS opaco preservado. Mantém quatro contextos Microsoft originais, witness de tar/processo/factory/host/Caddy/HTTPS, restauração de configuração e recibo público por allowlist. A prova DOM exercita o componente real com rede controlada; não é OIDC real nem QA instalada.

Dos nove requisitos originais, cinco têm controles completos implementados, dois têm apenas cobertura parcial (principals não demonstram grants distintos; API não demonstra UI administrativa) e dois ainda não têm controles executáveis por falta de composição chat/rascunho/descarte. U15=6, U39=22, U40=22, F04=3 e AZ02=32 em seis fases são inventários preservados, não execuções.

A revisão independente identificou que arrays vazios poderiam satisfazer o helper de fechamento por `every()`. O código final exige schema, inventários completos/únicos e contagens exatas, com dez controles negativos. Os avisos dos guards conservam a retirada de casos/assertions da seleção executável e a rede global controlada no teste DOM; o ledger mantém todas as obrigações. Os outputs ficam em `RUNNER_TEMP`, sem waiver ou exclusão do guard. Omni declarou `not applicable`, sem spawn/delegação; não foi apresentado como positivo.

As falhas intermediárias de tipo, outputs e contexto do workflow estão registradas na PR. O run verde usa o head final exato. A composição proposta em #654/#655/#657 precisa integrar o candidato e ser observada no host antes de executar o subconjunto; nenhuma aprovação foi herdada dessas branches.

## G10 — backup e clone de arquivos (#639)

[Run 45024293423, tentativa 1](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45024293423), job 137213794907 success. **15 controles reais de arquivos/SQLite**, zero falha/skip, spawn-imports e 78 guards.

| Campo | Evidência |
| --- | --- |
| Artefato | [14755630213](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45024293423/artifacts/14755630213), 1.875 bytes |
| ZIP SHA-256 | `ba3531559a97f82f5a1533c5b2aaa5517aae03f566e9dad90ba052334fd27655` |
| receipt.json SHA-256 | `b6e5932bdc63d759480cfee9c01f6bf6e4d0d8373347839b4d7167917b064d02` |
| Recibo | `orchestra-sf.g10-component-tests.v1`, `FILESYSTEM_COMPONENT_CONTROLS` |
| Alcance | `installedTeamsProof:false`, `releaseQualified:false` |

ZIP e recibo conferidos independentemente. A revisão corrigiu o vínculo de backup pré-corte: observar R instalado sem exigir instalar C primeiro, preservando o destino C/T/tar de G07. O clone verifica os bytes numa VM diferente e não ativa serviço nem substitui dados vivos. Cerca de saída e credenciais desativadas são atestações da reserva a comprovar operacionalmente. Serviço parado/instalação são observações; drenagem é atestação do operador. Presença da chave não prova decriptação. Backup no host, corte, efeito pós-checkpoint, restart/retry e rollback permanecem **NOT_RUN**. [Runbook completo](g10-cutover-rollback.md).

### Recibo operacional com destino do clone observado (#658)

[Run 45030815611, tentativa 1](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45030815611), job `137233784079`, **success**. Workflow efêmero `100be506a886bef64d210fedb0342e38fc5fc044` faz checkout literal da fonte `9714cd18…`/árvore `25139019…`. Somente os três paths do adaptador/teste/README foram mergeados.

| Campo | Evidência |
| --- | --- |
| Controles | 17 testes reais de arquivos/SQLite; zero falha, erro ou skip |
| Validação | Spawn-imports aprovado; 78 guards, três paths, zero findings |
| Artefato | [14758030307](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45030815611/artifacts/14758030307), 2.874 bytes |
| ZIP SHA-256 | `f9a4b0078640013dcc7669766356cc0518bfeab07a6ab55db48960b904ea9513` |
| Recibo SHA-256 | `4b15cc7049220905f95969718dc31aa14ab0dc95c74de815c68a344ec9988062` |
| Inventário de casos SHA-256 | `a5695cca842feeccb759a47fa0f302c96673531014bdbe3c3f184f2712ecbf1e` |

O root adquiriu o ZIP e verificou digest/tamanho/CRC, recibo, identidade da fonte/run, inventário de 17 casos e logs. Os runs anteriores `45030521031` e `45030692679` falharam no driver de CI; o código fonte permaneceu igual. O driver final usa o setup Bun do repositório e não foi mergeado.

O caminho operacional `restore_reserved_clone` emite `orchestra-sf.teams-clone-integrity.v3`: conserva o vínculo da origem e acrescenta resourceId observado por Azure IMDS, horário da observação, SHA-256 dos mesmos bytes da reserva privada admitida e horário de verificação. O helper de arquivos mantém v2 de componente. Isolamento de saída e credenciais desativadas continuam identificados como atestações do operador.

Os dois controles adicionais exercitam um clone real de arquivos e dez variantes negativas de vínculo. **Nenhuma VM Azure reservada foi usada no CI.** O recibo continua `FILESYSTEM_COMPONENT_CONTROLS`, `installedTeamsProof:false`, `releaseQualified:false`.

A inspeção também identificou uma dependência operacional separada: a factory Microsoft monta o consumidor `recover`, mas não expõe a captura do checkpoint lógico que ele consome. A API TS interna e o backup físico não fornecem essa operação ao tar instalado. As etapas 7–9 do [runbook](g10-cutover-rollback.md) permanecem `BLOCKED_BY_CHECKPOINT_OPERATION`, além das reservas/tar ainda pendentes.

## Dependências e decisão

- **Migração:** último agregado G03/G04 inspecionado [44987301540](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44987301540), fonte `b4ba7f595e6b3b5ff10a3379cd91b6771bb1b793`, concluído em falha. Pool, SF4/SF5/SF8, UI operations/decisions e verify têm falhas. A investigação e integração seguem com a sessão proprietária.
- **Integração atual:** #657 observada aberta/draft em `95aa3a01915ebc9543957c267b57ab2ace9ee19f`, árvore `36be087efa65d1ba2c55022126eec02eb46c61c2`, às 14:20 UTC. Não está integrada nem é pin final. Os 64 paths não se sobrepõem aos dez de #659 ou aos seis de #660. A autoridade de Team proposta requer nova prova no candidato combinado.
- **Release:** ainda não há ACK atual de dono, C/T, rota produtora e toolchain. Os pedidos iniciais e as atualizações concretas [Migração/7079652837](https://github.com/gustavomhss/Orchestra-SF/pull/628#issuecomment-7079652837) e [Release/7079656702](https://github.com/gustavomhss/Orchestra-SF/pull/247#issuecomment-7079656702) permanecem sem ACK; uma solicitação não equivale a confirmação.
- **Produtor:** `g09-final.yml` permanece restrito a `g09-final-review`, com `sourceSHA == GITHUB_SHA`. A Release precisa reconciliar esse disparo antes de fixar C/T e produzir o tar original; não reconstruir um candidato histórico nem duplicar o builder.
- **Ambientes:** não foi recebida reserva final de QA/G10 com host/Entra/grants/callbacks e observador externo. Esta frente não modificou um host instalado. As consultas aos canais #628/#247/#657 responderam normalmente e não trouxeram novos ACKs/reservas; isso não demonstra que os ambientes inexistam ou estejam indisponíveis.
- **Compras 222 (2):** aceite 4/4 preservado no QA original, conforme o handoff. Backlink SHA/tar/reserva original ainda não recuperado. Não é reclassificado como falha nem promovido ao tar novo.
- **Outras frentes:** G01–G04/pool, #349, G09/#588 continuam com seus donos. A [#647](https://github.com/gustavomhss/Orchestra-SF/pull/647) registra a atualização técnica de G09; sua avaliação e decisão não são assumidas por esta frente.

Após o pin conjunto, repetir G05/G06 em C e produzir/verificar G07. Com o mesmo tar instalado, G08 e G10 avançam em paralelo nas reservas isoladas. Só então os recibos permitem avaliar o fechamento pedido. **Gates finais qualificados nesta frente: 0/5. Prontidão para go/no-go: NOT_READY.** A virada de produção depende de janela e decisão específicas; nenhuma foi executada.
