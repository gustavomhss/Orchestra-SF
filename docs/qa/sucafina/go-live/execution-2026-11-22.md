# Registro de execução — frente go-live — 22/11/2026

**Este é um índice de provas observadas e integrações. Não é aprovação dos gates finais.** Os recibos originais permanecem nos artefatos de Actions. [status.json](status.json) distingue campos finais ainda nulos dos candidatos de trabalho abaixo.

Observação histórica anterior: `2026-11-22T14:22:35Z`. Dev então observado após os três complementos: `a71033f21b2c0f7da508c96f302506a9e73fd145`, árvore `d86fa6c35359fd1437504435a48b0a4363ac8122`; referência de integração, não candidato final confirmado. A retomada descrita ao fim inclui os merges #666/#671/#668/#670/#669/#674 e a composição testada da #672; o dev observado após G10 é `6beab17e71c246b871b5a7f92c5de5ff2b0477d8`, árvore `3179c5c01ce287353fbef02b698c983a8f845f84`, também sem pin final.

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

A prova declara `COMPONENT_REAL_CLAMD`, `MICROSOFT_TEAM_FACTORY` e `CONTROLLED_ENTRA_GRAPH`, com `installedTeamsProof:false`, `finalCandidate:false`, `g06Closed:false` e `teamsPrivateImportProof:false`. Na fonte da #660, o importador nativo `import-admit/import-preview` ainda não estava montado em `runTeamBusiness`; a #670 abaixo resolve essa lacuna com recibo separado. O suplemento de upload não substitui essa obrigação; a prova de importação legada conserva seu alcance local. Coverage/auth/effect de G05 não foram repetidos nessa execução.

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

As falhas intermediárias de tipo, outputs e contexto do workflow estão registradas na PR. O run verde usa o head final exato. À época dessa prova, a composição proposta em #654/#655/#657 precisava integrar o candidato. A #657 foi posteriormente mergeada; a adaptação #672 abaixo consome os contratos posteriores da #665. Nenhuma aprovação foi herdada dessas branches.

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

A inspeção anterior identificou a falta de captura lógica na factory Microsoft. Essa lacuna foi implementada na #669, complementada pela política corrente da #674 e registrada abaixo. A API TS interna e o backup físico não foram usados como substitutos da rota. As etapas 7–9 do [runbook](g10-cutover-rollback.md) ainda não foram executadas no tar final.

## Dependências observadas às 14:22 UTC — referência histórica

As linhas desta seção preservam a leitura anterior. A situação atual é a da retomada abaixo; os heads e bloqueios históricos não são apresentados como estado vivo.

- **Migração:** último agregado G03/G04 inspecionado [44987301540](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44987301540), fonte `b4ba7f595e6b3b5ff10a3379cd91b6771bb1b793`, concluído em falha. Pool, SF4/SF5/SF8, UI operations/decisions e verify têm falhas. A investigação e integração seguem com a sessão proprietária.
- **Integração atual:** #657 observada aberta/draft em `95aa3a01915ebc9543957c267b57ab2ace9ee19f`, árvore `36be087efa65d1ba2c55022126eec02eb46c61c2`, às 14:20 UTC. Não está integrada nem é pin final. Os 64 paths não se sobrepõem aos dez de #659 ou aos seis de #660. A autoridade de Team proposta requer nova prova no candidato combinado.
- **Release:** ainda não há ACK atual de dono, C/T, rota produtora e toolchain. Os pedidos iniciais e as atualizações concretas [Migração/7079652837](https://github.com/gustavomhss/Orchestra-SF/pull/628#issuecomment-7079652837) e [Release/7079656702](https://github.com/gustavomhss/Orchestra-SF/pull/247#issuecomment-7079656702) permanecem sem ACK; uma solicitação não equivale a confirmação.
- **Produtor:** `g09-final.yml` permanece restrito a `g09-final-review`, com `sourceSHA == GITHUB_SHA`. A Release precisa reconciliar esse disparo antes de fixar C/T e produzir o tar original; não reconstruir um candidato histórico nem duplicar o builder.
- **Ambientes:** não foi recebida reserva final de QA/G10 com host/Entra/grants/callbacks e observador externo. Esta frente não modificou um host instalado. As consultas aos canais #628/#247/#657 responderam normalmente e não trouxeram novos ACKs/reservas; isso não demonstra que os ambientes inexistam ou estejam indisponíveis.
- **Compras 222 (2):** aceite 4/4 preservado no QA original, conforme o handoff. Backlink SHA/tar/reserva original ainda não recuperado. Não é reclassificado como falha nem promovido ao tar novo.
- **Outras frentes:** G01–G04/pool, #349, G09/#588 continuam com seus donos. A [#647](https://github.com/gustavomhss/Orchestra-SF/pull/647) registra a atualização técnica de G09; sua avaliação e decisão não são assumidas por esta frente.

Após o pin conjunto, repetir G05/G06 em C e produzir/verificar G07. Com o mesmo tar instalado, G08 e G10 avançam em paralelo nas reservas isoladas. Só então os recibos permitem avaliar o fechamento pedido. **Gates finais qualificados nesta frente: 0/5. Prontidão para go/no-go: NOT_READY.** A virada de produção depende de janela e decisão específicas; nenhuma foi executada.

## Retomada — mandato de integração, Release e operações

Gustavo atribuiu a esta sessão os itens 1–3: concluir a coordenação da integração, confirmar/produzir a Release admitida e obter as reservas QA/G10. A [coordenação #657/7080753498](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7080753498) preserva os escritores ativos. O mandato não equivale a ACK C/T, reserva, identidade de operador ou decisão de produção.

| Entrega | Fonte e integração | Estado observado |
| --- | --- | --- |
| Base Teams #657 | Fonte `dd8a7ce7cda006ab3a6a23b6cdeb4e633bbc8826`; merge `ad6d245119ef2d69fb96471edd62dd6413ae185f` | Integrada; controles componentes e conclusão focada no [run 45034291003](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45034291003). Não inclui automaticamente Session/Chat posteriores |
| Inventário #666 | Fonte `95330d413fda61f0379171c3df688702c5ab9fa2`; merge `4b62fa9f8ef2e29d1b0e2470045c459487b9c0cc` | Workflow somente leitura integrada |
| Correção de inventário #671 | Fonte `86923bff80869af3a84d0e255af6be754a1de3ac`; merge `c3d7f8eb6716db2e05ec33f4269b734793bd3d9e` | Variáveis resolvidas no contexto de step; metadata coletada mesmo com preflight falho |
| Release #668 | Fonte `37f67919c4e6345760cd2dafdea1a07977e1eb4d`; merge `0df66a7929168ccc98e3a5b2e6c45f574801902e` | Rota B/C/T/Q e admissão antes do build integradas; tar final não produzido |
| Imports #670 | Fonte `39cbd8f4505d45c4b5014f280cb4413c47603bbb`; merge `84ec2655cfbe9d138d8b61d7a025c62df05946cc` | Composição Microsoft/Team original e controles reais integrados |
| Checkpoint #669 e política #674 | Produto testado `32f06e47407e31c98d84babb31a1565d8aedbd4c`; merge dependente `f84f9c0fbdf8d93ede8c0d14eeed270771bbd519`; merge final em dev `6beab17e71c246b871b5a7f92c5de5ff2b0477d8` | Sete caminhos preservados byte a byte; ensaio instalado não executado |
| Executor G08 #672 | D `0b68b5d5cae2dc17267558702caa6536b45bc6d7`; composição testada C `90a8fced96f6cf0dfd408b0e3c393308fd5d50ce` | Revisada; merge aguarda #665. Nove controles apenas listados |

### G05/G06 — Imports nativo Microsoft/Team (#670)

[Run 45037391139](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45037391139), tentativa 1, job `137254063616`, **SUCCESS**. C `39cbd8f4505d45c4b5014f280cb4413c47603bbb`, T `3b07c51dbdfa88821881eb139badcef8062453ce`. S `d247cd3acb6e4cfbe67a906b914096fa31afa5b3`, árvore `7258270b8e9cd201602ba31f4856e4f3d95c6b30`, é filho único de C com apenas `.ci-run.json` alterado.

**162 controles Node, 16 casos Bun/126.359 asserções, zero falha/skip/TODO**, tipos CLI/Sucafina e 78 guards/dez paths/zero findings. Seleção v3 `controls-with-imports`: oito legados, três Microsoft/Team, um G05 com 11 controles e quatro Imports, em seis arquivos. Nonce Omni novo, quatro declarações, cinco spawns e zero delegações. Coverage/auth/effect de G05 não foram repetidos.

| Artefato/recibo | Identidade |
| --- | --- |
| ZIP [14760321903](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45037391139/artifacts/14760321903), 46.721 bytes | `ccec82ebf0f6ac466ad79d8bf1027dedcd1f0a01ec93d281eeae709ae1f72b74` |
| Agregado `receipt.json` | `f4ae4d7920e49ef6300d4e06be02f9a96105006c0a34f70aeca1d5b3808eec34` |
| Microsoft/Imports | `214a468892fb61b54a9580079504f4efb9e47df4427df3512b2b503e5ea9c1a4` |
| Microsoft/Team upload | `066961ee071ff64c644e9da14d140ffac57fcb50e658afcd808ce7b73eb4c7a6` |
| G05 Team | `19d0fce0d41444cf74782de655bd1c48ec3f3e0c55afeb228671bab114e04fe3` |
| JUnit | `37660759194be83784d8a20869b06901aa9370feda1fd85b0325fe36c93d13fc` |
| Request normalizado | `7a677934d05907fda7d1e718360be7b2ec1ed31966ec90fa767778cdd9368023` |

A coordenação baixou e conferiu tamanho/digest/CRC, **18 hashes internos**, JUnit, C/T/S e cleanup. A composição usa a factory Microsoft, HTTP, ClamD, parser, authority e stores originais. Os quatro casos provam clean/EICAR/clean, teto de dois intakes com TCP real, payloads benignos inválidos após staging, negativas de owner/grants e daemon indisponível, com igualdade durável A/B e limpeza. A classe é `COMPONENT_REAL_CLAMD / MICROSOFT_TEAM_NATIVE_IMPORT / CONTROLLED_ENTRA_GRAPH`; `componentPrivateImportProof:true`, `installedTeamsProof:false`, `finalCandidate:false`, `g06Closed:false`.

Os runs 45036662670 e 45036971290 permanecem falhos por fixture PID e entrada antecipada no fence de preview. Seus ZIPs são, respectivamente, `6273eaa2648d5cf916095bb7018cda231f0ccfaf21c712c119154d8d199b019b` (artefato 14759933470/29.426 bytes) e `ea0d02ad9d401a758d4fcbfd0e86302157537a7d7fb1189913352742551f888b` (artefato 14760525441/30.654 bytes). As correções não relaxaram schema, decoders ou autoridade. [Detalhes e reexecução final](g05-g06-controls.md).

### G07 — admissão e disparo Release (#668)

D `37f67919c4e6345760cd2dafdea1a07977e1eb4d`, T `e54fdd06a76a3042c01594331e6ca69af1bde2cf`. [Run 45035835391](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45035835391), job `137249288305` **SUCCESS**, qualificação `137249472312` **SKIPPED**: 68 Node, 18 Python, 78 guards/quatro paths/zero findings.

Artefato [14759253519](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45035835391/artifacts/14759253519), 3.997 bytes; ZIP `5cd87310a51b13c00de99ee4092ff5a208602bfc690e7cd37ab501e6647e3e9e`; recibo `97dd0f59461e223c5de8978aaab022a356be411541c45f3eee097baef6519d23`. ZIP/CRC, três logs e sete fontes conferidos independentemente. O merge de evento `00b2435b0e7153779b81b90ffddab1cc0df26a7a` não é D.

B contém o pedido de build e os dois ACKs reais e é distinto de C. `release-build-<B>` aponta exatamente C; antes de build/tar são conferidos fonte, árvore, papéis, textos originais, operador real e checkout limpo. Após o artefato, Q contém o pedido de qualificação e `g07-qualify-<Q>` em C consome os bytes originais. O builder/toolchain e três jobs posteriores G09 permanecem originais. **Nenhum B/Q final, ACK, tar ou instalação foi produzido por esse run.** [Contrato](g07-linux-package.md).

### G08 — nove oráculos, composição de teste explícita (#672)

D `0b68b5d5cae2dc17267558702caa6536b45bc6d7`, árvore `ca3b800f3ba6ab97e280e87d2768d29f0090e339`. Produto S da #665 `fde191dfc1970d37021d82370cccac657efac246`. Checkout testado C `90a8fced96f6cf0dfd408b0e3c393308fd5d50ce`, T `53f0d767b4b90bd64004ec2789c9803d43bc361f`: S mais exatamente nove blobs G08 de D, conferidos por compare API. Não é uma prova do head puro da PR nem do dev.

[Run 45038080944](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45038080944), job `137256156567` **SUCCESS**; instalado `137256157449` **SKIPPED**. 134 Node, 28 Python, oito DOM/243 asserções, tipos e nove Playwright **LISTED_NOT_RUN**. Guards: 78 / 105 paths da composição/zero gates e erros/**um WARN** `js-empty-catch` em `tooling/httpapi-codegen/src/index.ts:517`; não foi convertido em zero findings.

Artefato [14760243491](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45038080944/artifacts/14760243491), 7.689 bytes; ZIP `b415fd156b11b75b8bf4afe55aa11264ff5a71666e8a49c26cdcabeac4b033ce`; inventário `c148adbff0fa05a204cd3aa021c4a2147a38a54ace8dd125cbcf99c3b874df65`; DOM JUnit `0d1dab53d24556ca167b584a8f1e6f63f0056bfd210805bf5e6d07d619442f84`. Aquisição/CRC/digests e relatórios conferidos pela coordenação; revisão técnica `6013022868`.

Os nove oráculos estão implementados, incluindo grants efetivos por create/read/401/igualdade/cleanup, UI administrativa real sem Team e PromptInputV2 com cancelamento/descarte. O recibo v3 conserva `installed:false`, `g08Closed:false` e nove obrigações **NOT_RUN**. U15=6, U39=22, U40=22 e F04=3 são obrigações diretas G08; AZ02=32/seis fases é prova LIVE transversal obrigatória. O quinto papel nativo é recovery/G10. Os cinco grupos continuam **NOT_RUN**; a adaptação não fecha o agregado G01–G10. #672 está revisada e aguarda #665. [Matriz completa](g08-teams-qa.md).

### G10 — captura lógica e recuperação por política corrente (#669/#674)

D/T de produto testado `32f06e47407e31c98d84babb31a1565d8aedbd4c` / `4d01afacc5287eea5f6fd8a81c523ec83c484c7f`; snapshot S `237f9bec632e1aeb6b7e6559f2451ca81f989ee7`, pai único D e runner efêmero. [Run 45038388189](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45038388189), job `137257131236` **SUCCESS**: **41 PASS, um skip preexistente de ownership/root**, zero falha, 403 asserções e oito novos casos aprovados; tipos e 78 guards/sete paths/zero findings.

Artefato [14760886449](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45038388189/artifacts/14760886449), 6.863 bytes; ZIP `6d51d4e9e7d2303395dc3081aeb111f9071961cb197252248cff9257cbf9cb24`; recibo `748b66fbd215b243f62ebcef992f34eec19f89287bada04a237a934da3aa2875`. Root conferiu CRC/nove hashes internos/relatórios/fontes.

A fonte final #669 `f84f9c0fbdf8d93ede8c0d14eeed270771bbd519`, árvore `d9d329d4d55a08ca3c969c2565d11665b85f5b05`, difere de D apenas no guia. [Guard final 45038822594](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45038822594), job `137258474958`, S `60ca68083b83660c46a6286a5494a23b21b85f7e`: 78 regras/sete paths/zero findings. Artefato [14760034604](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45038822594/artifacts/14760034604), 1.892 bytes; ZIP `919b291c31c4a609a990eab49b1415bd18b75c29a437a806ce5b13a757502e49`; recibo `9e84040c5fe47e458d77b7ecff5a3dfc9f9e2ce9b0f421d0a295e0cfe1b8d4ea`; quatro hashes e CRC conferidos.

#674 foi mergeada na dependência em f84f9c0f; #669 entrou em dev em `6beab17e71c246b871b5a7f92c5de5ff2b0477d8`/árvore `3179c5c01ce287353fbef02b698c983a8f845f84`, preservando os sete blobs. Revisões #674/`6013028788` e #669/`6013043654`. Run inicial 45038117675 falhou no typecheck do fixture; produto e 41 testes já passavam, sem apagar o skip.

HTTP, SQLite, backups/blobs e mutação de política são reais; Microsoft, seed e observador externo do pin são fixtures. As rotas de captura não criam aprovação independente. O restore exige política corrente e a mesma revisão antes de commit, sem usar o seed como autoridade. O decoder #675 já foi integrado na branch #665; o candidato final ainda precisa incorporar essa composição e preservar os hooks/política. Não houve ensaio instalado, clone Azure, prova da chave, corte, restart real ou rollback. [Runbook e entradas exatas](g10-cutover-rollback.md).

### Inventário operacional #666/#671 — execução bloqueada antes do login

#666 foi validada no [run 45035892320](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45035892320), job `137249451432`, snapshot `982898ce60e6d9fcc7a8e2700da15b315a0743f6`: parse da workflow/três programas Python e 78 guards/um path/zero findings. Artefato 14759074375/1.186 bytes, ZIP `8ee9f86daac048a984291f69c0115a3d1f998395ebc8473eb9d3847506f977b2`. A primeira versão falhou no driver 45035540926; foi corrigida antes do merge.

#671 corrigiu a observação de variáveis no contexto de step. Fonte `86923bff80869af3a84d0e255af6be754a1de3ac`, árvore `1cfc6886e1b06b616576752155b511f2a80d9fea`; [run 45036567797](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45036567797), job `137251525645`, S `a5f66ed6d2341393fcec09997fd045719801d447`: parse/três programas e 78 guards/um path/zero findings. Artefato 14759996647, ZIP `1f8e345b5a396e14bb8b32dede5a97d45b3fc38ebdca7c7921570c1b9dcc1fa1`. São controles de ferramenta; não fazem login Azure.

O inventário após merge [45036787201](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45036787201), job `137252212765`, observou:

- Environment `azure-mvp` existente; resposta sem políticas de proteção.
- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` e `AZURE_RESOURCE_GROUP` vazias no preflight. Nenhum valor privado foi publicado.
- Autenticação Azure **SKIPPED**; nenhum login ou comando ARM executado.
- Consulta de runners e nomes de variáveis: **403 / NOT_OBSERVABLE**; branch-policy: **404 / NOT_OBSERVABLE**.
- Consulta UI de GitHub Settings deslogada; inventário Desktop Commander com somente um Mac offline, sem ação no host.

Artefato [14760385059](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45036787201/artifacts/14760385059), **877 bytes**; ZIP `672b98c1718bd66d97375571724981108db9fdbabcba08d634b13764dce01a64`; recibo `4ec3f609af032496424ad7bd76c37828e157b4d848ff1a02a4a4f5dd20b72864`; metadata `d4f3caee711ec59696ab32a27fb7c206f8118bc45637bacd6c5ac51dc96f028f`. Root adquiriu bytes, conferiu tamanho, digest e CRC. A tentativa anterior 45036258206 também ficou antes do login e permanece histórica.

**O bloqueio é de observabilidade/autenticação pelo caminho tentado. Não demonstra ausência de infraestrutura, reserva ou dono.** Nenhuma reserva foi inventada, parâmetro privado antigo reaproveitado ou host alterado. `reservationConfirmed:false`, `guestObserved:false`, `installedQualification:false`.

## Complementos finais desta consolidação

### #665 — reparos focados e composição verificados, novos achados abertos

Os logs originais foram lidos pela coordenação e por revisão independente. A fonte testada difere do snapshot efêmero de execução; nenhuma aquisição nova de ZIP é afirmada para estes dois recibos de log.

| Prova | Fonte D/T e snapshot S | Resultado observado |
| --- | --- | --- |
| [45039523637](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45039523637), job `137260633773` | D `d4daba81866166c1363563faa2b6156db0765b63`; T `a41c9c7b859b30ab1d4d8cf0284a871cf8a2b7fe`; S `5117581495d7ece34d96b5d5a79be9f79d5b0f80` | HTTP 25/204 asserções, factory 1/3, Chat 29/272, zero falha; typechecks Server/CLI/App-shell, geração canônica e guards 78/97 paths/zero findings |
| [45039881113](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45039881113), job `137261724555` | D `51278d55623f69f950785a9de8b8f1d0082bf62a`; T `a64eb0f6d173036ea9b380ce81e80efbaec730f0`; S `7c8e4cbffcbb4c192f6167e657d115e91d769c38` | Composição Microsoft Chat/checkpoint/recovery: 21 PASS/4.601 asserções; typechecks SF/CLI e guards 78/97 paths/zero findings; Omni uma declaração/três spawns/zero delegações |

Os recibos de log são `sf-teams-focused-closure-proof-v1` e `sf-teams-concurrent-composition-proof-v1`. O segundo vincula a composição ao dev `6beab17e…`; mantém `liveMicrosoftProof:false`, `installedQualification:false`, `migrationExecuted:false` e `productionChanged:false`.

O replay histórico fde191/45037362513 de 19/22 gates continua registrado. Seus reparos HTTP/SSE/gerador têm os positivos focados acima. Permanecem dois achados estáticos com regressões dirigidas solicitadas ao writer: [bytes reais do body Web sem Content-Length confiável, corte no teto e 413](https://github.com/gustavomhss/Orchestra-SF/pull/665#issuecomment-7081547510), e [corpo JSON vazio com SyntaxError próprio do handler deve conservar 500](https://github.com/gustavomhss/Orchestra-SF/pull/665#issuecomment-7081586708). Os logs verdes não demonstram que esses novos casos tenham passado. Não houve replay G05 completo nessa sequência.

### #673 — segundo intake completo, pool e SF5 verdes

Fonte `532a7e7958a9a8932076532cab93cf3ce61fb85e`, árvore `bd93e2a0431b8ec465c81c0715237dcd79891b75`; driver `9c53dce33afad3ea4896b0441ec4b5bd84577640`, árvore `e8b89d938102fba0b9247153bf979976216c8aab`. [Run 45038699571](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45038699571), tentativa 1, **failure**. Fonte do registro: [recibo oficial do dono](https://github.com/gustavomhss/Orchestra-SF/pull/673#issuecomment-7081513410).

| Job | Resultado e alcance | Artefato / hash informado pelo dono |
| --- | --- | --- |
| SF4 `137258101534` | 79 PASS, uma falha, 671 asserções/12 arquivos; SQLITE_PROTOCOL no SELECT de secrets.get em parity-polling-browser | `14761066352`; execution SHA-256 `c298fcbaae9129a4aeb5c011d9b9757296697a549ae2d556d11937eee00eea7a` |
| SF5 `137258101511` | 64 PASS, zero falha/skip/TODO, 411 asserções/13 arquivos | `14760975837`; recibo `17c25d38864e21bc450dbf99687cd087e6bf0621579cc7a14823d5e621ed7ea6` |
| SF8 `137258101699` | 97 PASS, uma falha, 4.855 asserções/13 arquivos; Omni EBADF no stdout do filho antes do PID Chromium; finalizador recusa prova incompleta | `14761330134`; execution `0f829169d9da1c2219df06c8c57ac0a7fa23a098e13a68513852f32875a761c0` |
| Decisions `137258101315` | 0/5, todas param na discovery: private root selecionado em lugar do workspace privado; nenhuma jornada alcançada | candidate `14760249977`, failure `14760633257`; execution `41ceca3dc73ef652d492eab49322ce2e9315654cfe4e4436a47a52c42bd40dd6` |
| Operations `137258101503` | 2/5, zero skip/flaky; sourcing, justificativa somente leitura e sourceVersion4vs3 em análise | candidate `14761510074`, failure `14760504500`; execution `41ceca3dc73ef652d492eab49322ce2e9315654cfe4e4436a47a52c42bd40dd6` |
| Pool `137258101465` | **206/206**, 40 fontes, 3.122 asserções, 48 aquisições/liberações, um Chromium, um Omni/zero delegações, finalização verificada | `14760668799`; recibo `ca5d54a11be3717b1caf1942051af4a5e46c786cc83843a040b69ea236170cdd` |

O dono registrou aquisição/conferência de nove ZIPs e CRC, relatórios e hashes canônicos. Esta consolidação leu essa fonte; não afirma download próprio desses nove artefatos. O pool é `COMPONENT_BROWSER_REGRESSION`, `installedTeamsProof:false`. SF4/SF8/Decisions/Operations e os próximos slices — retry mensal após restore, montagem mensal e fixtures de workspace — mantêm #673 **IN_PROGRESS_NOT_QUALIFIED**. O verde do pool não fecha os demais gates.

### #675 — decoder integrado na branch #665, ainda não em dev

D `a675a5792b9260054d043624dc45d60a5adb8dbf`, T `b3614391f2d6a7a4f89bd298aa861be3a469a972`, S `9709e78f39f0ec0449e2319242f1b37aec335911`. [Run 45040408446](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45040408446), job `137263353207`, **SUCCESS**: 46 PASS, um skip preexistente de ownership/root, zero falha, 481 asserções; typecheck SF e 78 guards/97 paths/zero gate/warn/erro.

Artefato [14761970496](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45040408446/artifacts/14761970496), **12.387 bytes**; ZIP SHA-256 `58965ccb1590817ecce89d438c7b645b151091f5da951cd9efe30d9ad5fe403c`; recibo SHA-256 `f8eaf43472da823e05ebb654017a0c71efac9d2f16513dfab5c2d7159be53cca`. Root adquiriu bytes e conferiu CRC, nove hashes internos, JUnit e dois digests de fontes. Revisão `6013130249`; [handoff #665/7081657071](https://github.com/gustavomhss/Orchestra-SF/pull/665#issuecomment-7081657071).

O merge `4bee9c656034bb6771929a3d1eb893bc65af6a7a` preserva a mesma árvore T e tem como destino **session-http-integrated/#665**. Não entrou em dev nesta observação. O decoder admite checkpoint independentemente de recover e normaliza somente namespaces/operations omitidos para arrays vazios; não concede operações ou Session implicitamente. O primeiro run 45040173632 passou 46 testes e falhou apenas no tipo TS2769 do fixture; `as const` corrigiu o teste, sem mudança no produto. Esse histórico não foi apagado.

## Dependências atuais e decisão ainda pendente

- **#665:** integração posterior ativa. Os focais 45039523637 e 45039881113 comprovaram os reparos anteriores e a composição; o replay fde191/19 de 22 continua histórico. Limite Web de bytes reais e corpo vazio permanecem achados abertos. #675 foi mergeada somente nessa branch. Os focais não fecham G05 completo ou a qualificação instalada.
- **#673:** o intake f382029/205 paths e o run anterior 45035419728 permanecem no [manifesto histórico](https://github.com/gustavomhss/Orchestra-SF/blob/f382029d7be3f4e31440814f7b3e16038ad65329/docs/qa/sucafina/go-live/migration-intake.json), que esta consolidação não altera. O último focal completo 45038699571 passou pool 206/206 e SF5 64; SF4/SF8/Decisions/Operations falharam. O dono focal_migration mantém os slices corretivos e o estado IN_PROGRESS_NOT_QUALIFIED.
- **G05/G06:** rota de replay pronta; nenhum replay longo foi disparado somente para repetir uma prova antiga. Reconciliar catálogo atual e executar completo no C integrado confirmado.
- **Release:** rota #668 disponível; C/T, dois ACKs, operador e artefato final ainda nulos. Não reexecutar uma branch histórica para aparentar produção do candidato novo.
- **Operações:** reservas QA/G10, atores/grants/callbacks, observador, R retido, dados e chave ainda não confirmados. A descoberta bloqueada não é prova de inexistência.
- **222 (2):** aceite QA 4/4 original preservado; backlink SHA/tar/reserva não recuperado, sem promoção para outro candidato.
- **Outras frentes:** #349, G09 e #588 preservam seus donos. Recovery do plano é G10; a prova LIVE AZ02 é transversal e não substitui esses gates.

Após C/T e os pré-requisitos, G05/G06 devem qualificar o candidato; Release produz e G07 verifica o tar original; G08/G10 consomem os mesmos bytes em reservas separadas. **Gates finais qualificados: 0/5. Go/no-go: NOT_READY.** Nem os componentes verdes nem a cobertura G08 isolada fecham o agregado G01–G10. A decisão e a janela de produção continuam sem aprovação específica.

### Integração fixada nesta edição

A #665 incorporou dev em `51278d55623f69f950785a9de8b8f1d0082bf62a`, árvore `a64eb0f6d173036ea9b380ce81e80efbaec730f0`, incluindo #670 e #669/#674. O [run 45039881113](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45039881113) aprovou a composição de componente nesse source, sem aprovação instalada.

A [#675](https://github.com/gustavomhss/Orchestra-SF/pull/675) entrou **na branch #665, ainda não em dev**, no merge `4bee9c656034bb6771929a3d1eb893bc65af6a7a`; sua árvore `b3614391f2d6a7a4f89bd298aa861be3a469a972` é idêntica à fonte testada `a675a5792b9260054d043624dc45d60a5adb8dbf`. Admite `checkpoint` separado de `recover` e normaliza apenas namespaces/operations omitidos para listas vazias, sem ampliar autoridade Session/negócio. O [run 45040408446](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45040408446), job `137263353207`, passou 46 casos/481 asserções e preservou um skip anterior de ownership/root; tipos SF e guards 78/97 paths/zero findings. Snapshot `9709e78f39f0ec0449e2319242f1b37aec335911`. Nenhum ACK final ou qualificação instalada é inferido.

## Consolidação de componentes integrados — 22/11/2026, 17:39:16 UTC

Esta seção atualiza o estado corrente; todas as seções anteriores são observações históricas preservadas. Fonte de coordenação: mandato [#657/7080753498](https://github.com/gustavomhss/Orchestra-SF/pull/657#issuecomment-7080753498), lease documental de três arquivos [#628/7082653276](https://github.com/gustavomhss/Orchestra-SF/pull/628#issuecomment-7082653276). Hora local correspondente: 14:39:16 America/Sao_Paulo.

### Merges recebidos e identidade observada

Último dev observado: **`9db779820a54d251890b399c7f97ed99b333e228` / `b0e17cdcc1a88348399e1d1254bd306ac8235504`**. Essa base inclui #665 (5ba961), #677 (5d0d39), #685 (0fa477), #689 (428cb9), #690 (d9194f), #688 (2fdc76), #692 (51d187) e #695 (9db779). O status estruturado contém os SHAs completos, árvores conhecidas e escopos.

A #665 é o caminho único que consumiu os contratos anteriores de Teams/Session/Chat/admin e G08. #677 integra política privada corrente em F02/business/import/checkpoint/recovery, explicitando grants e digest da configuração; a resposta terminal de EOF é resolvida antes do cleanup. #689 liga as folhas originais ao shell; #690 monta os readers/writers originais na mesma factory Microsoft/Request/Application/Team. #688 preserva o wrapper Web integrado e corrige apenas overflow tipado e o handler sem consumo de corpo.

A #685 havia sido integrada em ba521 antes da correção de seus dois oráculos AZ02. A branch alterada depois não modificou esse merge. A correção segue exclusivamente pela **#695**, com review 6013531094 e CI no head 9f5198; o merge preserva os três paths de ledger/verificador #692. A fonte executada e a árvore do merge são distintas e assim permanecem registradas.

### Provas adquiridas por esta coordenação

| PR / prova | Fonte / árvore executada | Run / job | Artefato / SHA-256 ZIP | SHA-256 recibo principal |
| --- | --- | --- | --- | --- |
| #677 / current-private-policy-corporate-composition | `edadc608f10fd52c79197028f2b47de65fdfa7eb` / `94241727e5eb88aaf4d985d2acf7f38105bdd566` | [45047908103](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45047908103) / 137286430454 | 14764880116; `8ef78577b5d660acca9ddfea02ef123b906ca1e95ab2f5592836b9b3ec8d9d5f` | `44568b5fa3b30c4721dcb4111580f2788ea3557bdc4e0595fa34a66e947986b6` |
| #677 / current-private-policy-real-clamd | `b4d1315876cd03c358741bbe2e6438569c843e47` / `8a551f69e77e91cce1eee5a3d4696aaa4ab9bcf0` | [45046401550](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45046401550) / 137281860414 | 14763722617; `ab78e1b1224227c371e21cc1a83f477b45d4930a3b5e7e235a33c516e43d6d86` | `56d361fa989e9e7b538270d868789079787c7d925165848372713fbecaf00f32` |
| #688 / web-boundaries-final-component | `33ba3d151bf523b17767e7030e7e6c0670d4b361` / `271bce30b5694c96eac4b9d96a888a23104ba64c` | [45049241686](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45049241686) / 137290475676 | 14764559020; `7df37dfbc2a685137de84a8121abeab0f1907376a7c9fd9a5df21fc486158880` | `6c835f585e047dfd60ff65b76db819c00562198d9e283d2693f684e43317c7d6` |
| #689 / native-team-ui-hooks | `0f0373159f04528ed74bf500b55dd311ae0c23d9` / `427647475aef83d71be1ec2487bd2ee94e79cb74` | [45048002949](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45048002949) / 137286711222 | 14764297130; `0bee905530b93177aac201d866a4a766b9e0db6d0de20546d5d73dcac3159617` | `907665dc6b456667ad32fde3b6d98225c4441caf050a85e443bca1f42427eb2b` |
| #690 / native-team-microsoft-factory | `482367ec13c073f73bec859a676e05d14e8f319b` / `1aea8ae8f5538b16d6a973b693d1d161e9a99936` | [45049032082](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45049032082) / 137289843955 | 14764712883; `56b465a685906644c29986daad3540e01d4ce658121846ab6a3a6ee76daebd53` | `aec5a8e205c929b07eb048a309688715e74429c673718808a75f72f1b1aa4899` |
| #695 / az02-refusal-repair | `9f5198e176eeac817bd0f3fa153a26c5f2a42743` / `5e8d2d8341803ace203bf8a12426777a56298538` | [45050173497](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45050173497) / 137293323169 | 14765530273; `9b91ec653990e06e99c783fc9149b9787a8fabeca421289f40b4942fb8e76bdb` | `9ad7e0d2dae215ca4e1db665ea41f8d0a4f57a9b45124cb727e14a9a1d544ed8` |

A aquisição local limitou-se aos bytes dos artefatos e sua inspeção; todos os testes, typechecks, guards e builds de fixture foram executados em Actions. Conferências: ZIP/tamanho/SHA-256/CRC; #677 composição58, onze vínculos internos; ClamD B4, dezoito; #688, treze; #689, sete; #690, quatro hashes de relatórios/recibo G05; #695, nove. Inventários JUnit correspondentes conferidos. Não há alegação adicional de reaquisição de todos os blobs-fonte dos escritores externos.

- **#677 / 45047908103:** 58/58, 5.537 asserções: oito unidades de corpo, 31 HTTP checkpoint/recovery, 17 Microsoft e dois Application. Tipos CLI/SF e 78 guards/17 paths limpos; onze spawns Omni/zero delegados. A árvore do merge 5d0d é idêntica à fonte edad. O run anterior 45047399040 falhou porque o driver esperava12 casos onde a seleção preservada executava17; todos os17 passaram e os dois Application não foram alcançados. Somente o inventário do driver foi corrigido, sem reduzir casos ou mudar asserções.
- **ClamD B4 / 45046401550:** 172 Node, 16 Bun/146.538 asserções, scanner real e base oficial; cinco negativos da política corrente, 11 obrigações internas G05, quatro fixtures limpas, cinco spawns Omni/zero delegados. Esse run pertence a B4, anterior à composição final #677. Recibos auxiliares: Imports `5a7953526064f5ed056a74ebebcc2787dcc558be677c6c36d3309c9d17799400`, G05 `55ebc21fbcce56d731479e470109559cd41850f6eb3d2f0abdd91c7ca6639f25`.
- **#688 / 45049241686:** 33 Server +1 factory CLI, zero skips/falhas, dois typechecks e78 guards limpos. O Request e wrapper originais permanecem; overflow tipado413 e erro de handler sem nova leitura foram acrescentados aos controles anteriores. Um spawn real CLI; Server sem declaração Omni, corretamente não aplicável. O run45047341648 interrompido por LFs finais herdados permanece histórico.
- **#689 / 45048002949:** 60 DOM/1.227 asserções, oito controles novos e52 originais, tipos app-shell/78 guards limpos. O run45047344289 teve60 casos verdes, mas falhou no inventário esperado37; não foi reclassificado como sucesso.
- **#690 / 45049032082:** oito HTTP/32.469 asserções, 28 Microsoft/9.348 asserções, um caso G05 com11 obrigações/228 asserções, oito fixtures nativas limpas, tipos CLI/SF e78 guards limpos. Entra/JWKS/Graph permanecem controlados; não é instalação Microsoft real.
- **#695 / 45050173497:** 42 Node e10 Bun/123 asserções; sete readers CAP25 e três projeções originais preservados. Exatamente três paths, tipos CLI e78 guards sem findings. Nenhum processo declarado pelo teste: Omni não aplicável. Fonte9f5198 não inclui o delta de#692; o merge9db preserva esse delta sem promover o run a replay conjunto.

A prova anterior da correção AZ02, **45049330296** em61ec, também foi adquirida: artefato 14764653577, ZIP `dd8a24fb6ae63cf8b3ed8088dd52900dad29f2272f493d7150ca941680540000`, recibo `daea4c9e456fb32d4b9a0b383efe53e3790fb80393e1d837814e7819d1bafa3a`, CRC e nove hashes. Ela continua vinculada à fonte anterior.

### Ledger AZ02 e dependências de G08

[#692](https://github.com/gustavomhss/Orchestra-SF/pull/692) qualifica aff2fead/T5322d9, run45049839950/job137292304473, com183 Node/78 guards/zero findings. A frente proprietária adquiriu artefato 14764923150: ZIP `8737208f3f68ff39342101137524cb541bef681dc77b3e2eae85411c3cd090c6`, recibo `6b1e18d08dfbeea5d14e400a48128a19529c155371d396737e23705e06c10e6c`; esta coordenação leu a fonte primária da PR, sem afirmar aquisição independente desse ZIP.

O contrato histórico mantém32 casos e seus IDs. O contrato operacional atual exige37, com dois remapeamentos projectId→tenantId e cinco adições Team; fases16/14/2/2/2/1. A correção#695 acrescenta nove controles de oráculo, portanto os183 testes da fonte#692 não representam a nova suíte agregada. Nenhum caso AZ02 foi executado LIVE nesta frente.

CAP03/Budget original segue em [#691](https://github.com/gustavomhss/Orchestra-SF/pull/691), UI/seleção/retorno, e [#693](https://github.com/gustavomhss/Orchestra-SF/pull/693), produtor/client/factory/OIDC; não há alias de mutação CAP03. As jornadas [#694](https://github.com/gustavomhss/Orchestra-SF/pull/694) preservam U15:6, U39:22 e U40:22, além de F04:3; não são substituídas por listagem. As nove obrigações Teams, esses quatro grupos e AZ02 permanecem NOT_RUN na instalação. Tar, reserva e contextos reais não existem como prova recebida.

### Migração: recebimento completo antes dos próximos deltas

Os seis jobs do focal original 45035419728 foram recebidos, com identidade1c7070/T7bbe9a preservada. O focal45045269481, fonte385b13/T787d1e, passou SF4:80, SF5:64, SF8:98 e pool209; Decisions e Operations permaneceram3/5. Sua recepção completa está em [7082411093](https://github.com/gustavomhss/Orchestra-SF/pull/673#issuecomment-7082411093).

O último focal **45048445274**, fonte `c9a9b0b3a85ea7f663b50d16527f45e977ccd3b5` / árvore `8e6d5f3113dd0fc3149877f0f2846302866a0956`, driver4697cee/T2289d06, terminou FAIL:

| Job | Resultado |
| --- | --- |
| SF4 /137288068223 | 97/97 PASS |
| SF5 /137288068208 | 156/156 PASS, incluindo planner-runtime52 |
| SF8 /137288068324 | 140/140 PASS |
| Decisions /137288068187 | 3/5; navegação real Planner/Procurement pendente nos helpers |
| Operations /137288068062 | 3/5; CAP25 GET200 sem corpo retido pelo Chromium |
| Pool /137288068302 | 208/209; resposta tardia401 não observada em5s; hook recusa recibo positivo |

A frente proprietária adquiriu os11ZIPs, conferiu SHA256/CRC, cinco execution e a admissão do pool **antes** de novos deltas. O [registro primário7082886558](https://github.com/gustavomhss/Orchestra-SF/pull/673#issuecomment-7082886558) contém IDs/hashes dos onze artefatos e dos recibos positivos; a coordenação leu esse registro. Pool: um Chrome,48 aquisições/48 liberações, zero leases ativos e PID encerrado. Limpeza bem-sucedida não transforma a falha funcional em PASS.

Os seletores dos jobs foram preservados; a distribuição por arquivo mudou pela composição canônica do manifesto. Os novos97/156/140 não substituem retroativamente80/64/98. Nenhum timeout, asserção, retry ou skip foi relaxado. Reports11/11 de44987301540 continua histórico e só pode ser reutilizado onde sua fonte permanecer aplicável.

### #613: doze áreas preservadas, três ainda abertas

Fonte atual observada `0a1247db9a16f9eead04788a76d25723672c7e6a` / árvore `1b8155081dbfd2c94649f701c275d32b70bd15f6`. O run45042892840 passou cinco controles/225 asserções e tipos CLI/SF para a correção de escopo. UI44 em45043532716/job137272992582 falhou no prazo original120s; artefato 14763330927, ZIP `2eabc5ae9d5f0fafb0e4199dcfc46cf7352e5c7038dd87765b6135d38a5a5d9e`, CRC35entradas. A imagem de falha mostra conexão com servidor perdida, sem estabelecer a causa. UI42/UI43 seguem sem qualificação de preview.

O coletor45045175421/job137278106754 continuava em execução às17:31:41UTC, mais de50min após iniciar, sem logs recuperáveis ou artefato; o limite declarado45min não havia produzido recibo. Causa não determinada; nenhum cancelamento por canal alternativo ou diagnóstico duplicado foi realizado.

A tentativa C17 fonte6bec7f15/T3e4a82e, run45049352072/job137290808542, foi recebida por inteiro: seis de sete gates PASS; ancestry FAIL105s. Canonical10/140, UI authority/context27/221, subtotal1/55, tipos eguards verdes; o outer consumiu101,281s/1.952 leituras. Ancestry persistida/ciclo/recuperação/revogação não terminaram. Artefato 14764813414/ZIP `6b84fb258cd24f18313c18ceb9b668ef35521c6bd51bd5d7f7a90bf8dd2466ad`, adquirido pela frente proprietária com11vínculos de recibo/log. [Registro primário](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7082905911). A tentativa foi retida, não aceita para composição em#613; os prazos e oráculos permanecem.

### Bloqueios operacionais e decisão

O inventário#666/#671 permanece bloqueado antes do login: AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID e AZURE_RESOURCE_GROUP vazios no environmentazure-mvp. Um administrador pode restaurar a configuração existente e repetir a descoberta somente leitura. Operadores QA/Entra e recuperação/backup/chave/observador precisam confirmar reservas e atores reais. A limitação de acesso não comprova ausência de infraestrutura.

Migração e Release ainda não confirmaram um mesmo C/T final. O produtor G07 só executará após os ACKs reais e a admissão de B; Q verificará o tar original. Os mesmos bytes serão usados em G08 e G10, sem rebuild entre gates. Não foi produzido tar final, alterado host reservado, executado ensaio instalado ou autorizado corte de produção.

**Veredito desta observação: NOT_READY; zero dos cinco gates finais qualificados.** O fechamento técnico#349/#588/G09 permanece preservado. Go/no-go e janela de produção serão apresentados após as provas; qualquer virada continua dependente de aval explícito de Gustavo.

## Consolidação das rotas completas e recebimento operacional — 22/11/2026 às 19:01:12 UTC

Esta edição substitui o estado corrente da observação17:39:16UTC, sem alterar seus recibos históricos. Último dev observado: `b7776698e61934ed2cb820658408ff8a8207ec62`, T `364344c376a4feb35245d8089bde1941d025ebf9`. As ferramentas foram integradas; o candidato final permanece sem C/T/ACK/tar e os cinco gates sem aceite final.

### Integrações concluídas

| PR | Fonte efetivamente qualificada | Árvore da fonte | Merge em dev |
| --- | --- | --- | --- |
| [#693](https://github.com/gustavomhss/Orchestra-SF/pull/693) | `821b7eb010a5010c0e642b08f03096cefd4c1b4d` | `442cd93456a74daf16e36264a6d17387aaa839ff` | `70e3228cf2dbbe2ba1723ea4044ed855864dd516` |
| [#691](https://github.com/gustavomhss/Orchestra-SF/pull/691) | `ba91c39e5cd2f9fdbe3851007f7e3b4915477bbe` | `8025be39e4893eebafd6586e08de3dc1a052b386` | `7e3e5e2bfd24f2efe8f424a298e31e071763061f` |
| [#694](https://github.com/gustavomhss/Orchestra-SF/pull/694) | `4c717ad9cda1af474802728248e3b9a2129ad134` | `029b696c9d68d59abebc86564818a6d9b895e778` | `9804ee30848580787cc7e556d4a26269b3960656` |
| [#697](https://github.com/gustavomhss/Orchestra-SF/pull/697) | `5b9e1734130792e3ad33b43689c69785596344ad` | `55b151e7176bdbc807e01c4f34130761e374caf7` | `19fbe6542cdcc27139082c28acbc01bf070d60bd` |
| [#700](https://github.com/gustavomhss/Orchestra-SF/pull/700) | `9991d8bb4df736f6d4abcab195a4f4138d7c339c` | `fe76ef383c9bc379a8fd75372cf190a8259252f9` | `327e95d552fa6edc742f8b87bc19efb0ca6a1dd6` |
| [#701](https://github.com/gustavomhss/Orchestra-SF/pull/701) | `7800bec785c859580aec8e043ae5f18ab33ec8f3` | `e410878956c9dbee907bb624d21b7578e70e225c` | `5cf8419032b544b3252b00bdee39afdbb366ffa6` |
| [#699](https://github.com/gustavomhss/Orchestra-SF/pull/699) | `217e9806f08491b6f286a8a5a3c36891bb17ae6a` | `88a02263d9d2cfceb299b92f00664d46e44438c0` | `47fa6b594ce91058671d55a7104e1ed0264975c2` |
| [#698](https://github.com/gustavomhss/Orchestra-SF/pull/698) | `03a8c8ab88d3dddff6524a4c3ccd39ac1250140e` | `4e425fa9278be05e0018bc64d25c06f5417363b2` | `b7776698e61934ed2cb820658408ff8a8207ec62` |

Na #691, o head entregue é `894c291bf6ddd47b49eaa886682f58d6b0fa9e68`, T `26a9596704f116d404638c2231ba75289e0c1486`. O checkout qualificado acima é uma composição explícita desse head com o Client exato integrado pela #693. O snapshot `fb4241a7c56d97b4aba87e4245b9aeafb86dafa1` contém apenas o driver sobre essa composição.

Na #700, o snapshot `584280d79db91ffe7b1680ff4a8fd1a826575616` é filho direto da fonte9991d8bb e só acrescenta o workflow. O preflight compara literalmente a extração de SfExecutiveRecord, os dois imports type, o tipo de período e os três Pick. A alteração funcional de CAP14 é o Edit original passando pela rota existente, coberta por clique/reabertura DOM. Os quatro blobs de adapter/CLI/schema/leitor foram revisados independentemente e preservados no head final.

O readback de #699 sobre #700 confirmou24 dos 25 blobs de #700 iguais. O único compartilhado, `response-faults.ts`, contém todo o runtime da #699 mais o Pick de tipo da #700, blob `cd2d599b6ee3d14fda83bb7986cca5f72ea16fa2`. O import original de SfUiState em producer.ts é `0ceceb218a6b88d27bc4304f1c7b863a012b40a6`. O contrato histórico v2 permanece `122a31917565d2de51ba63e646cc20000c239670`. Essa conferência é estática, sem execução conjunta presumida.

A #698 foi qualificada sobre #700/#701 integradas, com snapshot `c4074d907f93d7c35f7dfbf109c70ef7103408b4`, T `5bbad2d5c618a224e4acfbadc8aec252c689a41d`. O checkout literal foi03a8c8ab/T4e425fa9. Seu merge sobre47fa6b59 conserva os paths de #699. O C/T futuro de release ainda exigirá sua qualificação final.

### Artefatos e recibos originais

| PR | Run / job | Artefato / tamanho | ZIP SHA256 | Receipt SHA256 |
| --- | --- | --- | --- | --- |
| #693 | [45051010616](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45051010616) / `137295893621` | `14766250203` / 15734 bytes | `703e236eb96aff4a395e8cf0897a82e1f50b4312dd119463eb7a14063a8b7445` | `e3b100fc77df82f9741e0fc6ce1c0360475f58878dae095919775a9af8721c87` |
| #691 | [45050299263](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45050299263) / `137293705151` | `14765380985` / 12110 bytes | `56e6304778605ae849ecbb78135cf86c0d608d835388076a1c75f057c36c3cde` | `6ad8476ddabbfca922a172b4256802601a23f9fdb90ea42e508c55cd08c4b6db` |
| #694 | [45051200489](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45051200489) / `137296482968` | `14765527423` / 9884 bytes | `9a6f4ea5233a1c43a9360e1751b49acd50cc70111280dbc945b9b280be82f198` | `8ff1f5d7e94b7789c4d9c35e607ad09b9a3aaaf99d128de7b7832b07919d54fd` |
| #697 | [45052572893](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45052572893) / `137300735185` | `14766247497` / 5420 bytes | `4060ee76c4587b39823541325d1cd2191cf49e57977363e6e320b36b8571cca5` | `ad79f5f70e23cca71f2e5ae8255a490c468c6e47bb5062d8df6b9b01ffa2bc86` |
| #700 | [45055263348](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055263348) / `137308970818` | `14767152786` / 15581 bytes | `76f4d9de9adac066d3af4bd8140d48797b859d01cd7b709d1b136ac6e9b9ea3d` | `7c6d0db484ffc444e19befff9fdb8af834e94cc2802c9e7decd6406584a9c7cc` |
| #701 | [45055493019](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055493019) / `137309680512` | `14767462255` / 7906 bytes | `bf6dd3642e07f2f5bcb46549e29c53650a2e4ccaaffcf0f1189d6fbe1f2d1fe7` | `034fa8f81a7d6fe3dc6bcaf1f4aabb10df37b17fe8dd48efb183707fde35a0fb` |
| #699 | [45055028234](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055028234) / `137308231059` | `14766813193` / 11339 bytes | `6a45164f265f3f7e939ae5af20a744eac4a9ce7f85bc3fe6e5614d75aded7bd8` | `eb55a4598da125a61b3a9891d4a5f6f332ae23ea0a5d77e5374022eb360d8b42` |
| #698 | [45055970646](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45055970646) / `137311147143` | `14767840186` / 9994 bytes | `2ce21877b759f1d4b0c3ae8ef824cc6ae5decbe8582544adfc1e7e4337414cf4` | `b2f2edf093dc584d6a74a3aeab65d49af47c6cc808ee914b1437b8099434f586` |

| PR | Controles positivos da fonte | Guards da fonte | Aquisição |
| --- | --- | --- | --- |
| #693 | 67 bun | 78 regras; 9 paths; 0 gate/warn/errors | ZIP original adquirido e conferido nesta frente |
| #691 | 79 bun | 78 regras; 7 paths; 0 gate/warn/errors | ZIP original adquirido e conferido nesta frente |
| #694 | 40 node + 25 bun | 78 regras; 30 paths; 0 gate/warn/errors | ZIP original adquirido e conferido nesta frente |
| #697 | 42 node + 49 python | 78 regras; 3 paths; 0 gate/warn/errors | ZIP original adquirido e conferido nesta frente |
| #700 | 40 node + 42 bun + 21 dom | 78 regras; 25 paths; 0 gate/warn/errors | ZIP original adquirido e conferido nesta frente |
| #701 | 128 bun | 78 regras; 3 paths; 0 gate/warn/errors | ZIP original adquirido e conferido nesta frente |
| #699 | 40 node + 54 bun | 78 regras; 4 paths; 0 gate/warn/errors | ZIP conferido pelo owner original; fonte/metadata/reviews e merge relidos por esta frente |
| #698 | 254 node + 5 bun | 78 regras; 7 paths; 0 gate/warn/errors | ZIP original adquirido e conferido nesta frente |

Todas essas execuções têm zero falha/skip na seleção positiva final, mas não compartilham uma fonte única. Os21 DOM e42 Bun da #700 têm332 e 151 asserções, respectivamente. #693 tem67.031 asserções; #691 tem1.501. Os50 casos Playwright permanecem LISTED_NOT_RUN e F04 NOT_RUN nas provas de tooling.

A aquisição da #698 confirmou CRC, nove hashes de relatórios, sete blobs alterados e18 fontes vinculadas;254 Node e5 Bun únicos, sem falha/skip. O parser real de #701 validou o YAML canônico real de #698, e os exports reais de #700 foram importados sem executar registro. A #701 também verificou um ZIP produzido e baixado pelo serviço original Actions, artefato 14766579861,218bytes, SHA256 `3c120f6bab3a8b736699c6970b4e9dacbc0163fa5e074058826f1a95e8e09fa9`; isso é controle do formato/proveniência, não uma execução instalada.

Revisões independentes/técnicas desta recepção:  #691: 6013568757/6013591884; #693: 6013557636/6013588969; #694: 6013574321/6013595065; #697: 6013658815; #700: 6013743307/6013758503; #701: 6013758249/6013765513; #698: 6013676046/6013780071/6013786667. São COMMENTs técnicos pela conta compartilhada; não representam aceite humano presumido.

### Tentativas anteriores preservadas

- **#693 / [45049761737](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45049761737) — failure:** Five oracle/seeding expectations against the original producer.
- **#693 / [45050387628](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45050387628) — failure:** 67 tests/types/guards passed; receipt refused the omitted original Client Omni preload. Artefato 14765168886.
- **#691 / [45049910608](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45049910608) — failure:** Two stale test locators; corrected to the original details.code, product blobs unchanged.
- **#694 / [45050117406](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45050117406) — failure:** Node and Bun controls passed; eight type errors.
- **#694 / [45050931067](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45050931067) — superseded_success:** Superseded by the complete owned-page cleanup/detach correction.
- **#697 / [45052237890](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45052237890) — failure:** Controls and guards passed; receipt expected TAP while Node reporter was spec.
- **#700 / [45053544699](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45053544699) — failure:** Original controls passed; new adapter tests could not resolve @playwright/test from script root. Artefato 14766556642.
- **#700 / [45053821703](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45053821703) — failure:** 40Node/42 Bun/21 DOM and AppShell/Client types passed; native types failed from literals and type-only UI graph. Artefato 14767165149.
- **#700 / [45054388379](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45054388379) — failure:** Native type-only barrel still reached UI ambient declarations; literal contract extraction repaired it. Artefato 14766597996.
- **#701 / [45053828016](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45053828016) — superseded_success:** 89 controles na fonte anterior. Artefato 14766259816.
- **#701 / [45054963632](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45054963632) — superseded_success:** Admission was updated to accept the original pending API state with null timestamps; previous result not inherited. Artefato 14767560351.
- **#699 / [45053502100](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45053502100) — failure:** 40Node/54Bun passed; native type imports failed; inventory/guards skipped.
- **#698 / [45052772637](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45052772637) — superseded_success:** 223 controles na fonte anterior. Artefato 14765339185.
- **#698 / [45053365211](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45053365211) — failure:** Driver-only literal tree typo failed before tests/output; no artifact.
- **#698 / [45053404197](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45053404197) — superseded_success:** 240 controles na fonte anterior. Artefato 14766119628.

Os resultados anteriores nunca substituem o recibo da fonte corrigida. Em particular, o driver 45053365211 não chegou aos testes nem produziu artefato; o erro era um literal de árvore no driver, sem alterar o C/T de produto. Na #701, os controles125 são anteriores à compatibilidade pending observada na API real; o positivo128 possui identidade e artefato próprios.

### G08: cadeia disponível, execução instalada ainda ausente

O coordenador reúne99 obrigações em11 produtores separados: Teams 9, U15 6, U39 22, U40 22, F04 3 e AZ02 37 nas fases 16/14/2/2/2/1. O registro concreto observa contextos Microsoft originais e discovery/F01/F02/UI, sem criar identidade, copiar sessão ou aceitar callback manual. O schema G08 é aditivo; o v2 da Migração continua estrito.

A autorização original deve preceder started_at real. O helper exige os seis steps e o driver canônicos, além do run/tentativa/job concluído e ZIP original. O check-run é vinculado pelo check_run_url exposto no job, sem alegar consulta independente à API de check-runs. O agregador posterior relê todos os bytes privados e recusa mistura de C/T/tar/reserva/VM, falta/repetição de casos, quebra de fases ou troca do cookie revogado. O after-restart observa a transição real; não reinicia o serviço.

A limpeza do dataset é uma atestação original posterior ligada ao recibo privado, explicitamente classificada como tal. Ela não é inferida do parser, e o helper mantém processObservation=false e cleanupExecutionVerified=false. Nenhum recibo instalado dessa cadeia foi produzido. [Runbook atual](g08-installed-execution.md).

### Migração: intake independente do run 45055109181

Fonte `9612e7db0319c41ea0161e3924f332d9d76b0f9b`, T `b1dc4bdc3b4a73667e9ee8011667616565d2f9bc`, S `f0b23434280e368f221cf43bd9709c0303d4326d`, tentativa 1. Os dois jobs terminaram FAILURE; o [recebimento independente e a coordenação](https://github.com/gustavomhss/Orchestra-SF/pull/673#issuecomment-7083841900) preservam quatro ZIPs, CRC e oito hashes internos.

| Job | Resultado real | Consequência |
| --- | --- | --- |
| Static137308483355 | Inclusão E2E com96 entradas/6.323 arquivos e dois diagnósticos | BuildWeb posterior SKIPPED; não há recibo estático limpo |
| Decisions137308483582 |3 PASS,2 timeouts de 180 s,0 skip | Os fluxos de comparação/escolha ainda não fecharam; não há ACK final |

A prontidão de page.route em operations-support/procurement.ts recebe Promise<Disposable>, mas seu contrato diz Promise<void>. O segundo diagnóstico é a ausência da declaração original de Window.api no tsconfig.sf-e2e.json; o env.d.ts já é incluído no tsconfig E2E geral. #699/#700 não modificam esses paths/configs. Os deltas sugeridos preservam rejeições, lifetime da rota e declaração original, sem cast, ambient novo ou remoção da inclusão.

Em Decisions, ambos os casos chegaram às alternativas reais. O primeiro terminou a regra numérica; o segundo mostrou comparação indisponível/fontes alteradas depois das propostas120/140USD. O observador clickCommand espera apenas Fetch.requestPaused de resposta, sem evidência terminal de falha/fechamento. Não há suporte para atribuir a causa exclusivamente ao produto ou CDP, aumentar prazo ou sintetizar resposta. Os próximos deltas permanecem com o writer da Migração.

Guards do focal: código zero e nenhuma anotação de erro, porém47 warnings contra origin/dev e69 contra a base histórica. Isso não é zero findings. Artefatos:

| Artefato | Bytes | ZIP SHA256 |
| --- | ---: | --- |
|14767512752 — candidato Decisions |14.133 | `d2a4e7f3ff8f398dbfeabc0316a287ec502b1af71ff104610da020757683fbde` |
|14767093444 — guards |4.170 | `ed4e9efc787f50af5322070bab3705bf9d236283728f93774c5e7d8038b598fa` |
|14766784241 — inclusão E2E |536.566 | `b0125538d2c26f8b65e1047ac23224cf09a0dd766c90bff7ff3b38a7a0d0e5a7` |
|14766749952 — falhas Decisions |150.090 | `3d0d12083f981eec210654207a1b589a93ee7719d6681e0944df4a5e9bcb0297` |

Operations 5/5 do bf1 já está entregue em45051170458, mas não é prova do9612 ou do candidato futuro. O pool requer o replay original sem overlay na composição final; seu diagnóstico 209/209 permanece diagnóstico. Os shards e Reports mantêm suas fontes anteriores.

### #613 e acesso operacional

#613 conserva 12/15 áreas. O focal 255c35c6 recebeu 8/10, e a correção de driver de tipos45054387720 passou 3/3. C17 / 105 s continua aberto. O diagnóstico 45054997790 terminou FAILURE com cleanup SUCCESS e publicou14766639145,542.421bytes, ZIP `75217788b017b726545282f834f0dc5a94bc705e7dfeee103cfd9f052c48584d`. Esta frente conferiu metadata, não o conteúdo do perfil. O coletor anterior 45045175421 sem artefato é outro run, preservado no histórico.

O inventário original 45036787201 foi repetido, sem alteração de código ou escopo, na tentativa 2/job137315104950. Às18:49:36UTC, as quatro variáveis Azure continuavam vazias no preflight de azure-mvp; login e ARM ficaram SKIPPED. Artefato 14766939588,876 bytes, ZIP `d9bb7a22cafa22777560af42821dbb11ea643a35458f5dc07858d4fc83bc36c7`, receipt `ee9d5d941754ae9da9804e2fa569ef89712a8aafa7ee7f64a4189b276dc02de5`; download e CRC conferidos. Metadata `d4f3caee711ec59696ab32a27fb7c206f8118bc45637bacd6c5ac51dc96f028f`: environment existe, runners/nomes de variáveis 403 e branch-policy 404 permanecem não observáveis. A tentativa 1 (artefato 14760385059,877 bytes, ZIP672b98c1718bd66d97375571724981108db9fdbabcba08d634b13764dce01a64) permanece histórica. O Desktop Commander foi relido e continua offline, último contato 110 h antes. A observação não demonstra ausência de infraestrutura; configurações e acesso precisam ser disponibilizados no contexto correto. Não houve reserva confirmada, host mutado, grant concedido, tar final ou ensaio G10.

A coordenação e execução de Release pertencem a Astra. O ator GitHub observado é gustavomhss; B vinculará o operador efetivo e os ACKs ao C/T final. Esse registro de conta não é ACK antecipado nem atribuição a uma pessoa independente.

### Estado de fechamento

| Gate | Dono | Estado do candidato/artefato/recibo final | Entrada restante |
| --- | --- | --- | --- |
|G05 | Astra go-live | Nulos | Composição final e replay completo HTTP/isolamento |
|G06 | Astra go-live | Nulos | Seleção completa com ClamD real no mesmo C/T |
|G07 | Astra go-live | Nulos | Dois ACKs, B/operador vinculados, produção e qualificação do tar original |
|G08 | Astra go-live | Nulos | Tar instalado/reserva/Microsoft reais,11 produtores completos e agregação |
|G10 | Astra go-live | Nulos | Reserva/clone/R/chave/observador e ensaio real de backup/corte/retomada/rollback |

**0/5 gates finais; NOT_READY; decisão de produção nula.** Os componentes entregues não são reabertos como lacunas de código. Compras 222 (2) conserva 4/4 no QA original. G08/G10 podem executar em paralelo após G07 nas reservas isoladas autorizadas. A virada de produção ainda exige a janela específica e a decisão de Gustavo.

## Atualização coordenada após o #702 — 2026-11-22T19:18:45Z

A base integrada desta observação é `f2b129b1610a218b7104dbc2c4bf6b07befae5af` / T `ca3c05964718b20e96561102dc6b07b0207bf856`, merge documental do #702 sobre o #703. Os oito arquivos e registros do #702 são preservados. A sobreposição dos três documentos do #704 foi recebida em [7084239845](https://github.com/gustavomhss/Orchestra-SF/pull/704#issuecomment-7084239845); o caminho único de follow-up foi registrado em [#628/7084241639](https://github.com/gustavomhss/Orchestra-SF/pull/628#issuecomment-7084241639).

### Admissão do agregador G08

O #703 entrou em dev pelo merge `f5132fabfa265ba6bef17b0e0aa2ebe2c2beafdc`, com árvore idêntica à fonte `b6c643546c57fca820a8e4db935815a64f2af58c` / T `4462e8f53b3fca019d9c5f5fbbf71cb4c04f56b4`. Revisões técnicas 6013881242 e 6013911106, [recebimento 7084117853](https://github.com/gustavomhss/Orchestra-SF/pull/703#issuecomment-7084117853), [fechamento 7084150856](https://github.com/gustavomhss/Orchestra-SF/pull/703#issuecomment-7084150856).

Run 45058460020, tentativa 1, job 137318837279, driver `8ca8e72e9f1a738ee09a550df341cf44bd6369ef`: **280 Node + 5 Bun adapters + 205 proveniência = 490**, sem falhas/skips; 387 controles anteriores preservados. Guards: 78 regras, seis paths, zero gate/warn/error. ZIP 14768532152, 20.246 bytes, SHA-256 `0ed89a6942a40d1c4b0fdce6967f4146d7b9f7bc37da8afa80e78c84aefe1e53`; CRC dos 16 membros, 15 hashes internos e sete fontes Git/SHA-256 conferidos. Recibo `42ff6208f8d0431167a65afdb58168316ecaa6b6e5780d6e49ab4e2abaa85a51`. Roundtrip ZIP 14768083611, 218 bytes, SHA-256 `2a51da2d7a49c008a388722a384b33d5ee8e53936c93588942941bb561658b2f`, CRC e recibo conferidos. O workflow instalado permanece no blob `6035b60476c4fce49b83ce7503ef03367ffc2d28`.

O agregador observa seu próprio checkout, árvore, limpeza tracked, contexto Actions, evento, run/attempt/job, runner e cadeia original de steps. A leitura é retrospectiva e não cria nova autorização ou reserva ativa. Os produtores originais preservam suas próprias janelas, autorizações e limpeza. Flags do focal: instalado, candidato final, fechamento G08 e produção **false**.

### #613: C17 completo e seletivo ainda reprovado

[Recibo primário 7084208298](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7084208298): fonte `a7b428197efe7ccf45381d04ba03f233b392fbf3` / T `f353769b1d4ec3ac2336dfda4760544860f22a96`; snapshot `5e6f8dc3625cdb7f2f84306679cf038c205b9499` / T `e28df9a637c20ec7985a7fd232e2d63747f62c10`. Run 45058938554, principal 137320282399 FAILURE, cleanup 137321456133 SUCCESS; sem artefatos. Log primário conferido: 106.486 bytes UTF-8 com BOM, SHA-256 `0cf50d47173a332cd2c1b91cfe3ec0ff304e2ae36b1ebb7917422328b0f7e4b5`; subprocessos sem truncamento.

| Gate seletivo | Resultado na fonte a7 |
| --- | --- |
| Identidade | PASS |
| Captura e bytes canônicos | FAIL, 17/18, 141 assertions; import com query não estabeleceu módulo distinto |
| Seleção C08 e proof-order | PASS, 15/15, 175 assertions |
| Autoridade e integridade | PASS, 27/27, 221 assertions |
| C17 original | PASS, 1/1, 19 assertions, 101.269,75 ms dentro de 105 s |
| CLI types | PASS |
| Sucafina types | PASS |
| Guards reais origin/dev | PASS, 78 regras, 787 paths, 38 warnings, zero erros/waivers |

C17 completou 1.952/1.952 leituras externas em 71.736 ms, reopen em 19 ms, ancestry em 27.905 ms, recusa do ciclo em 13 ms e recuperação/revogação em 440 ms, sem abort. Esse PASS pertence à fonte a7. O dev observado nos guards foi `f2b129b1610a218b7104dbc2c4bf6b07befae5af`, merge-base `4b62fa9f8ef2e29d1b0e2470045c459487b9c0cc`; Omni: oito controles, 14 spawns, zero delegados.

O [finding estático 7084196985](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7084196985) impede a promoção: um map stateful instalado antes do helper pode ser tratado como baseline, permitindo convergência dos dois digests tardios para dados alterados. A próxima fonte precisa de admissão ancorada antes do hook e de prova real da ordem de carregamento. Não houve relaxamento do prazo ou de assertions. O #613 permanece no head 0a, 12/15, com UI42–UI44 pendentes.

A aquisição independente anterior do perfil CPU255 também permanece válida somente como diagnóstico: [7083761451](https://github.com/gustavomhss/Orchestra-SF/pull/613#issuecomment-7083761451), ZIP 14766639145 `75217788b017b726545282f834f0dc5a94bc705e7dfeee103cfd9f052c48584d`, recibo `4321d62be17b9df3598b1de588fdb89ec7cdbaba1b480346cc099bfeec054609`, perfil `4e94ab96920709e4c0cefcf4e45085089cca888d10429aadaae03b8f56627096`. A observação metadata-only do #702 permanece histórica; o perfil não prova ganho causal, contagem de chamadas ou qualificação.

### Migração e reuso das provas

Último focal recebido permanece 9612/45055109181, Decisions 3/5 e estático reprovado. O head 44334 contém reparos de tipos e observador revisados em 6013904225. O diagnóstico 45059200284 foi iniciado sobre P `8f6f3a02a83f466be76bce88bb93ed97a83a88e2` / T `400d3d0bb8f2d292439463abbf42286257152225`, com driver `96ec9b7601abe993bb091f6fa5632da98635100f`; [plano 7084165666](https://github.com/gustavomhss/Orchestra-SF/pull/673#issuecomment-7084165666). Seu resultado ainda não foi recebido nesta observação. O overlay adiciona logs e um await de observação no HTTP, preservando a ordem das operações, cinco casos, prazos de 180 s/10 s e retries zero. Não é recibo de qualificação.

Os 11 casos Reports do run 44987301540 mantêm especificação, manifesto e 16 support blobs; porém local/entry.ts, runtime/local-store.ts e runtime/request-body.ts mudaram na composição 9612. Reutilizam-se os oráculos, e os 11 originais serão executados no candidato efetivo após a composição de #613. Nenhum PASS histórico é transferido.

### Validação documental anterior e limites finais

A primeira fonte do #704, `21d43e8aa943151a98caabc0f829432d0571e309` / T `c83c93f435e8b601184a202e929c41d19828a1f3`, recebeu revisão 6013916319 e run 45059194082/job 137321074779 SUCCESS. Driver `69eb98a8fc4912e9489b2b10825971ac3b4fce8d`, dev efetivamente observado `f2b129b1610a218b7104dbc2c4bf6b07befae5af`, merge-base b777. Guards: 78 regras, três paths, zero gate/warn/error. ZIP 14768239633, 1.478 bytes, SHA-256 `89c94bc9487171e5b67978c21faf10924cdab0ab3f7dbf322803fc0395686a0c`; sete CRC e três hashes de documento/Git blobs conferidos. Essa fonte não foi integrada por se sobrepor ao #702. Seu CI não qualifica a nova composição.

Não há alteração de candidato final, ACKs, operador, tar, reservas, aceites ou decisão de produção. As 99 obrigações em 11 produtores continuam NOT_RUN na instalação. **0/5 gates finais; NOT_READY.** A virada continua condicionada ao aval explícito de Gustavo após go/no-go e janela propostos com recibos completos.
