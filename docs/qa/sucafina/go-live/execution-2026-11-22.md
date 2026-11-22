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

HTTP, SQLite, backups/blobs e mutação de política são reais; Microsoft, seed e observador externo do pin são fixtures. As rotas de captura não criam aprovação independente. O restore exige política corrente e a mesma revisão antes de commit, sem usar o seed como autoridade. A integração #665 deve admitir checkpoint no decoder privado e conservar os hooks/política do contrato. Não houve ensaio instalado, clone Azure, prova da chave, corte, restart real ou rollback. [Runbook e entradas exatas](g10-cutover-rollback.md).

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

## Dependências atuais e decisão ainda pendente

- **#665:** integração posterior ativa. O replay45037362513 sobre fonte fde191 resultou em [19/22 gates](https://github.com/gustavomhss/Orchestra-SF/pull/665#issuecomment-7081262811): dois casos falhos (invalid JSON/upload devolvendo500 em vez400; reader SSE ainda vivo após dispose) e o gate que recusa WARN do gerador. Dez typechecks passaram. Reparos seguem com os escritores; o foco G08 não equivale a replay integrado.
- **#673:** intake f382029 reconcilia 205 paths; fonte 1c7070c348a6f5be8fed07b7138fce4b6d45827a/T 7bbe9abde3faacb8684971b4ce4561b64349475f, driver cb60d25cfc0032be098f46f530bc61f1ff4337cb, run 45035419728. SF4 82/82 e SF5 104/104 passaram; SF8 41/42, Decisions 2/5, Operations 2/5 e pool 205/207 falharam. Os recibos originais estão no [manifesto do intake](https://github.com/gustavomhss/Orchestra-SF/blob/f382029d7be3f4e31440814f7b3e16038ad65329/docs/qa/sucafina/go-live/migration-intake.json), mantido por focal_migration. O manifesto não foi alterado por esta consolidação.
- **G05/G06:** rota de replay pronta; nenhum replay longo foi disparado somente para repetir uma prova antiga. Reconciliar catálogo atual e executar completo no C integrado confirmado.
- **Release:** rota #668 disponível; C/T, dois ACKs, operador e artefato final ainda nulos. Não reexecutar uma branch histórica para aparentar produção do candidato novo.
- **Operações:** reservas QA/G10, atores/grants/callbacks, observador, R retido, dados e chave ainda não confirmados. A descoberta bloqueada não é prova de inexistência.
- **222 (2):** aceite QA 4/4 original preservado; backlink SHA/tar/reserva não recuperado, sem promoção para outro candidato.
- **Outras frentes:** #349, G09 e #588 preservam seus donos. Recovery do plano é G10; a prova LIVE AZ02 é transversal e não substitui esses gates.

Após C/T e os pré-requisitos, G05/G06 devem qualificar o candidato; Release produz e G07 verifica o tar original; G08/G10 consomem os mesmos bytes em reservas separadas. **Gates finais qualificados: 0/5. Go/no-go: NOT_READY.** Nem os componentes verdes nem a cobertura G08 isolada fecham o agregado G01–G10. A decisão e a janela de produção continuam sem aprovação específica.

### Observação de integração posterior ao replay

A #665 incorporou dev em `51278d55623f69f950785a9de8b8f1d0082bf62a`, incluindo #670 e #669/#674. Isso não promove os recibos antigos a esse head. A [#675](https://github.com/gustavomhss/Orchestra-SF/pull/675), fonte `2c27173bb983e8a609312795cbfa3068104e7cc6` / árvore `ae97fdcefa5b0148fa8faad4086f196a0bb23e34`, prepara a admissão explícita de `checkpoint` separada de `recover` e normaliza namespaces/operations omitidos para listas vazias, sem ampliar autoridade de negócio/Session. Seu snapshot CI é `2127c9112ee09a78a897c7b2dc7fb68ef5de2d36`; o resultado ainda está pendente nesta edição. Nenhum ACK final ou gate aprovado é inferido.
