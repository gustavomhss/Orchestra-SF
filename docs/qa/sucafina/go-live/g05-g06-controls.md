# G05 e G06 — preparação e qualificação dos controles

## Decisão deste checkpoint

**G05 e G06 não estão aprovados no candidato final.** A preparação abaixo reaproveita fontes e provas existentes sem transferir a aprovação de uma árvore anterior. Não houve edição de produto, execução de CI, deploy, mudança de credencial, geração de tar ou declaração de aceite por esta subfrente.

Documento da frente Astra de preparação de go-live, em 22/11/2026. Integração documental prevista em `go-live-readiness`, criada de `dev@79912446753af5bb291fc2581543732eb4c83057`. Esta branch documental não fixa o candidato de produção.

Fontes normativas:

- [Handoff de preparação](https://github.com/gustavomhss/Orchestra-SF/blob/c02f329d48d37e2f6296154978cd8a7cf80bcb64/docs/qa/sucafina/astra-go-live-handoff.md).
- [Plano de testes e gates Teams](https://github.com/gustavomhss/Orchestra-SF/blob/736a5087c223629be4d73c8a4535d615fcafd96a/docs/architecture/teams-profile-test-plan.json).
- [Mapa de aceite Teams](https://github.com/gustavomhss/Orchestra-SF/blob/736a5087c223629be4d73c8a4535d615fcafd96a/docs/architecture/teams-profile-acceptance-map.json).

## Donos, dependências e identidade

| Item | Dono confirmado nesta etapa | Dependência ainda sem confirmação |
| --- | --- | --- |
| Preparação e coordenação G05/G06 | Astra desta frente, por instrução de Gustavo | Nenhuma para esta documentação |
| G01–G04 e integração do pool | Sessão Retomar migração para Microsoft Teams | Aceite final e SHA congelado |
| Transporte/Server necessário a G05 | Dono exclusivo de edição ainda não confirmado | Claim/lease com a Migração antes de editar |
| Fixtures e composição Files/Operations necessárias a G06 | Dono exclusivo de edição ainda não confirmado | Claim/lease e revisão do port com a Migração |
| Pin da release | Migração e Release, a confirmar em conjunto | SHA, árvore e recibo de confirmação |
| #349 | Outra sessão Astra | Fora desta frente |
| G09 e #588 | Gustavo e Astra já responsável | Fora desta frente |

Não inferir posse de um componente pelo nome de uma branch ou pela autoria de um commit. Não alterar os workflows compartilhados, o transporte Server, a factory ou fixtures compartilhadas antes de resolver a sobreposição.

| Referência observada | SHA | Árvore/escopo |
| --- | --- | --- |
| dev usado nesta inspeção | `79912446753af5bb291fc2581543732eb4c83057` | `5c32cd72537799632e7d2583c1775df1d88b8780` |
| Agregado citado no handoff | `0eab89232860463ab2aabbee15fc422e43bd6e74` | `g03-g04-repair`, run 44984930949 concluído com falha |
| Novo agregado da Migração | `b4ba7f595e6b3b5ff10a3379cd91b6771bb1b793` | `g03-g04-repair`, run 44987301540, sem aceite final |
| Fonte histórica de implementação Teams | `ad0d94707d5bc3a96075b610e17062573a8dd861` | `teams-profile-work`, árvore `8196849e2aa3982c92f8482ba76834eba9ecfbc1` |
| Fonte histórica G06 qualificada | `6f9b66a2aaa8b057653244c94183254bb6f008b2` | `teams-profile-scanner`, árvore `1ac16688f1733473d5e6ef8cb8cf09a456500c08` |

A consulta dos jobs do [novo run 44987301540](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44987301540) mostrou falhas em CI-SF-4 (job 137101012416), CI-SF-5 (137101012387) e CI-SF-8 (137101012393), com outros jobs ainda em andamento/na fila. É uma observação transitória, não uma conclusão final do run nem autorização de release. A Migração conserva a investigação e integração desses gates.

## G05 — HTTP real e isolamento por Team

**Estado: PREPARATION_COMPLETE / BLOCKED_FOR_FINAL_QUALIFICATION.**

### Fontes verificadas e alcance atual

O entrypoint existente é [packages/server/script/httpapi-exercise.ts](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/packages/server/script/httpapi-exercise.ts). Ele chama o catálogo e runner em `packages/server/test/httpapi-exercise`.

O [index.ts](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/packages/server/test/httpapi-exercise/index.ts), blob `b1483630a8a7c9e58f8d59f269c7f11cc6147f7f`, é idêntico nos pins inspecionados de dev, `0eab8923` e `teams-profile-work@ad0d9470`.

Os comandos existentes, com diretório de trabalho `packages/server`, são:

~~~bash
bun run script/httpapi-exercise.ts --mode coverage --fail-on-missing --fail-on-skip
bun run script/httpapi-exercise.ts --mode auth --fail-on-missing --fail-on-skip
bun run script/httpapi-exercise.ts --mode effect --fail-on-missing --fail-on-skip
~~~

Esses comandos descrevem entradas reais existentes. Sua listagem aqui não afirma que já executaram neste candidato ou que seu alcance atual satisfaz G05.

O [backend atual](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/packages/server/test/httpapi-exercise/backend.ts) monta `createRoutes` por `HttpRouter.toWebHandler`, usa memória isolada e senha Basic opcional. Ele chama os handlers em processo; não abre um listener HTTP. O [runner](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/packages/server/test/httpapi-exercise/runner.ts) usa contexto de diretório/projeto técnico, e os probes de auth verificam Basic e ticket.

**HTTP real é obrigatório para a prova pedida.** Antes da qualificação, o dono de Server deve resolver a execução contra um listener real isolado, usando o transporte e a composição admitida do candidato. A chamada direta de handler existente não será registrada como prova de rede nem como prova da instalação. Não basta executar o script atual e renomear seu resultado.

Os cenários `wrongOwner` de [integration.ts](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/packages/server/test/httpapi-exercise/integration.ts) comparam tentativas OAuth de `compat-a` e `compat-b`; esse owner é de integração, não o principal/Team corporativo requerido. O teste [sucafina-team-discovery.test.ts](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/packages/server/test/sucafina-team-discovery.test.ts) preserva seletores e metadados de instalação, mas não substitui autorização e efeitos isolados por Team.

### Lacunas verificadas

1. Não existe `.github/workflows/sf-ci.yml` no pin de dev inspecionado. Os workflows são `app-build.yml`, `azure-mvp.yml`, `sf-cache-warm.yml` e `test-ci.yml`.
2. Nos `sf-ci.yml` inspecionados de `g03-g04-repair@0eab8923` e `teams-profile-work@ad0d9470`, não existe o job `teams-profile-http` descrito no plano original.
3. O wiring examinado não fornece uma fixture de admissão Teams ao exercitador nem o listener de HTTP real exigido.
4. `coverage` verifica a cobertura do catálogo sem executar os efeitos. Os três modos continuam obrigatórios.
5. O reporter atual é textual. O recibo final precisa preservar a seleção e os resultados reais por caso, além do exit code e dos hashes.
6. Ainda é necessário reconciliar o inventário de endpoints do candidato com os cenários obrigatórios. Não presumir que a enumeração OpenApi de `Api` inclua automaticamente todo mount nativo Sucafina.

### Plano executável após o claim do transporte

1. Migração confirma o dono e o conjunto exato de caminhos Server/CI da intervenção. A integração ocorre em dev pela fila acordada.
2. O dono usa o transporte real e a admissão do produto para executar sobre listener isolado. Identidade, Team, owner e grants vêm da composição autorizada; nenhum header inventado converte um cenário negativo em positivo.
3. Inventariar endpoints e casos do candidato e incluir explicitamente: Team admitido, owner incorreto recusado, Team incorreto recusado quando a operação é Team-scoped, e releitura de estado demonstrando ausência de efeito ou divulgação indevida na recusa.
4. Rodar os três comandos em Actions com setup apropriado de Bun/Omni. A execução de scripts não pode ser substituída pelo runner Node genérico restrito a smokes.
5. Na qualificação final, proibir filtros `--include`, `--start-at` e `--stop-at` que omitam casos; conservar `--fail-on-missing` e `--fail-on-skip`. Um subconjunto pode diagnosticar uma falha, mas não fechar G05.
6. Guardar por modo o catálogo esperado, seleção real, casos executados, status HTTP, oráculos de isolamento/efeito, contagens e evidência de cleanup. Manter logs sanitizados; não publicar cookies, tokens, credenciais, payloads privados ou IDs pessoais desnecessários.
7. Conferir todos os recibos contra o mesmo SHA/árvore final confirmado por Migração e Release. Qualquer delta de produto que invalide a relação com o resultado exige nova qualificação pertinente.

### Entrada documental pendente — não é recibo nem comando pronto para disparo

~~~json
{
  "gate": "G05",
  "status": "BLOCKED",
  "candidateSha": null,
  "candidateTree": null,
  "transportOwnerClaim": null,
  "executionWorkflowPath": null,
  "requiredTransport": "real-http-listener-in-isolated-authorized-environment",
  "modes": ["coverage", "auth", "effect"],
  "requiredFlags": ["--fail-on-missing", "--fail-on-skip"],
  "requiredTeamControls": ["admitted-team", "wrong-owner-denied"],
  "expectedCaseInventory": null,
  "runId": null,
  "artifactId": null,
  "receipt": null,
  "readyToExecute": false
}
~~~

Para fechar: três modos aprovados no candidato final, HTTP real observado, casos Team/owner exercitados, inventário completo e nenhum caso obrigatório ausente, pulado ou não executado.

**Primeiro bloqueio:** claim do dono e reconciliação do transporte/CI. **Depois:** composição de HTTP real/Team, pin final e execução completa.

## G06 — ClamAV real

**Estado: HISTORICAL_COMPONENT_PASS_RECOVERED / BLOCKED_FOR_FINAL_QUALIFICATION.**

### Prova histórica recuperada

A inspeção confirmou metadados do run, todos os passos do job, artefato e logs contendo o recibo emitido após execução e cleanup. A prova não foi recriada nem reexecutada nesta sessão.

| Campo | Valor |
| --- | --- |
| Run | [44684352036](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44684352036) |
| Job | [136115014524 — teams-profile-controls](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44684352036/job/136115014524) |
| Attempt | 1 |
| Candidato | `6f9b66a2aaa8b057653244c94183254bb6f008b2` |
| Árvore | `1ac16688f1733473d5e6ef8cb8cf09a456500c08` |
| Snapshot só de requisição | `60bffd3d1f53de2076612c809c95fc244b145ced` |
| Branch | `tp-scan-6f9b66a2aaa85d8d0ef32b331` |
| Contratos de admission/verifier | 59 PASS / 0 FAIL |
| Controles reais | 7 PASS / 0 FAIL, 3 arquivos, 162 asserções |
| Omni | PASS; 3 testes declarados; 4 spawns |
| Artefato | [14606100590](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44684352036/artifacts/14606100590) |
| Nome | `teams-profile-scanner-60bffd3d1f53de2076612c809c95fc244b145ced-1` |
| SHA-256 do ZIP | `f8f3e6475eedd000023315b5e61c44d640a5be492f5893f8863d841de1f85760` |
| Request SHA-256 | `5d8d0ef32b33cc90cb86cd02484927e53585cda803cacddaf57d6bc96204d610` |
| Schema do recibo | `teams-profile-scanner-receipt-v1` |
| proofClass | `COMPONENT_REAL_CLAMD` |
| installedTeamsProof | **false** |

O job histórico `operations` ficou skipped por pertencer à outra rota do mesmo workflow. O job `teams-profile-controls` executou os sete casos e todos os seus passos obrigatórios com sucesso. Esse skip de outra rota não será reinterpretado como caso omitido nem usado para tolerar skip na seleção Teams.

O daemon observado reportou ClamAV 1.5.4. O setup qualificou binário pinado, bases oficiais, processos próprios e endpoints loopback. O controle privado usa identidade local de componente (`createOperatorIdentity` / `local-operator`); o próprio recibo limita explicitamente seu alcance.

**A execução histórica não é herdada pelo candidato final e não prova Teams real instalado.** Reutilizar código e entendimento dos controles; emitir novos recibos somente após a execução efetiva na composição pertinente e no pin final.

### Os três controles e sete casos preservados

| Arquivo relativo a modules/sucafina | Casos |
| --- | --- |
| `Sucafinav1/test/product/operations-scanner-closure/real-clamd.check.ts` | Clean → EICAR recusado → clean; erro real de limite de tamanho; indisponibilidade após parar somente o daemon próprio de erro |
| `Sucafinav1/test/product/operations-installed-finish/real-malformed.check.ts` | Comandos desconhecidos e INSTREAM malformado recusados, daemon continuando saudável |
| `Sucafinav1/test/product/operations-installed-finish/private-admission.check.ts` | Importação privada clean/EICAR sem efeitos duráveis na recusa; upload privado de fornecedor clean/EICAR sem mutação na recusa; ambas as admissões recusadas com daemon próprio indisponível |

**Lacuna obrigatória: `MALFORMED_APPLICATION_PAYLOAD_NOT_DEMONSTRATED`.** O caso `real-malformed.check.ts` envia comandos de protocolo inválidos ao ClamD, não um arquivo corrompido ao ingresso da aplicação. A recusa de EICAR antes do parser também não prova o tratamento de arquivo inválido benigno. Os sete casos históricos permanecem válidos como controles de componente; não encerram sozinhos a obrigação de arquivo malformado do briefing.

### Implementação existente e diferenças frente a dev

Fontes preservadas em `teams-profile-work@ad0d94707d5bc3a96075b610e17062573a8dd861`:

| Caminho | Blob observado |
| --- | --- |
| `.github/workflows/sf-operations-scanner.yml` | `9c51b1721b22261498208def601cee8418f6ba17` |
| `script/sf-ci/team-profile-scanner.mjs` | `8593f2e49d6eb548586092d2897bb23ebc579662` |
| `script/sf2h/operations-scanner/setup.sh` | `e83d37de4cc4766e61e47f725a29ca26afe7bf7b` |
| `script/sf2h/operations-scanner/service.mjs` | `17c6cbf7a4d29868bc20d8bd2a6d6be7d8cafeb7` |
| `real-clamd.check.ts` no caminho acima | `6b2e5ae65131e4d050fe07b9185d2ec7c1156d4c` |
| `real-malformed.check.ts` no caminho acima | `d44a80b24c4c098c0dbbc2c466e7d3e091961980` |
| `private-admission.check.ts` no caminho acima | `f110a5b3ee8ef19bda7a325742124be6bbea77e6` |

[Workflow preservado](https://github.com/gustavomhss/Orchestra-SF/blob/ad0d94707d5bc3a96075b610e17062573a8dd861/.github/workflows/sf-operations-scanner.yml) · [Admission/verificador](https://github.com/gustavomhss/Orchestra-SF/blob/ad0d94707d5bc3a96075b610e17062573a8dd861/script/sf-ci/team-profile-scanner.mjs) · [Ferramentas pinadas](https://github.com/gustavomhss/Orchestra-SF/blob/ad0d94707d5bc3a96075b610e17062573a8dd861/script/sf2h/operations-scanner/tools.lock.json) · [Composição privada histórica](https://github.com/gustavomhss/Orchestra-SF/blob/ad0d94707d5bc3a96075b610e17062573a8dd861/modules/sucafina/Sucafinav1/test/product/operations-installed-finish/private-admission.check.ts)

No pin de dev inspecionado, o workflow, admission, setup e os três arquivos de controle acima não existem. O mesmo workflow/admission/setup também não foi encontrado no candidato G03/G04 `0eab8923`. Não apontar essa rota histórica como já disponível na linha atual.

O [script/sf-ci/operations-clamd.sh atual](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/script/sf-ci/operations-clamd.sh) sobe Docker ClamAV loopback, exige PING/PONG e um clean INSTREAM. Isso prepara uploads de Operations, mas não cobre os sete casos nem substitui o workflow G06.

A composição [operations-support/installation.ts atual](https://github.com/gustavomhss/Orchestra-SF/blob/79912446753af5bb291fc2581543732eb4c83057/packages/app-shell/e2e/sucafina/operations-support/installation.ts) ainda é uma fixture de `local-operator`. O port precisa revisar essa dependência contra a instalação pertinente ao candidato; não afrouxar o contrato Microsoft para conservar um positivo de identidade local.

### Execução preparada após reconciliação e pin

1. Confirmar dono único de Files/Operations/CI com Migração; delimitar os caminhos necessários.
2. Reconciliar o conjunto mínimo do workflow, admission/verificador, testes do verificador, setup/service/cleanup, tools.lock, parser de JUnit e os três controles. Não importar a rama histórica inteira.
3. Preservar o escopo da identidade local histórica. Se a composição final precisar mudar para a instalação Teams pertinente, usar sua admissão real e requalificar; não converter a fixture em authority bypass.
4. Fixar produto C e árvore T com Migração e Release. Criar snapshot S com parent único C, cuja única alteração é `.ci-run.json`.
5. Usar a seleção exata abaixo e o envelope Teams. O request normalizado histórico tem digest `5d8d0ef32b33cc90cb86cd02484927e53585cda803cacddaf57d6bc96204d610`; recalcular do request efetivamente admitido, sem copiar digest se mudar conteúdo.
6. Executar contra dois daemons reais próprios, loopback, binário e bases verificados; manter a ordem de arquivos porque o primeiro para o daemon de erro observado no terceiro.
7. Executar cleanup do job mesmo em falha; somente aceitar recibo positivo após confirmar cleanup próprio e preservação da evidência.
8. Localizar prova existente suficiente ou acrescentar um controle de arquivo inválido benigno no ingresso real pertinente, com ClamAV real preservado. O oráculo é o contrato de validação/admissão do formato, com ausência de efeito durável indevido, armazenamento temporário e limpeza observados; não exigir que o antivírus detecte corrupção de formato. Vincular o recibo ao candidato e à instalação. Reconciliar seleção, inventário e verificador juntos, preservando os sete controles históricos.
9. Conferir C/T com o pin final. O mesmo nome de branch, produto semelhante ou hashes parciais iguais não transfere a aprovação.

Comandos reais da rota preservada, a executar apenas quando estiverem reconciliados no candidato:

~~~bash
node --test script/sf-ci/team-profile-scanner.test.mjs
node script/sf-ci/team-profile-scanner.mjs admit .ci-run.json
bash script/sf2h/operations-scanner/setup.sh

# cwd: modules/sucafina
bun test \
  ./Sucafinav1/test/product/operations-scanner-closure/real-clamd.check.ts \
  ./Sucafinav1/test/product/operations-installed-finish/real-malformed.check.ts \
  ./Sucafinav1/test/product/operations-installed-finish/private-admission.check.ts \
  --timeout 120000

# cwd: repo; depois da coleta real do relatório e cleanup próprio
bash script/sf2h/operations-scanner/cleanup.sh
node script/sf-ci/team-profile-scanner.mjs verify
~~~

O workflow preservado contém a instrumentação completa: `GITHUB_ACTIONS=false` apenas na invocação Bun dos controles, JUnit, exit status de `PIPESTATUS[0]`, hashes, integridade, parser de relatório e upload. A sequência resumida acima não substitui esses passos.

Entradas obrigatórias do workflow: `CI=true`, `ORCHESTRA_CHANNEL=prod`, `ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER=strict`, `ORCHESTRA_OMNI_CONTROL=declared`, nonce novo de 16 bytes/32 hex por invocação, identidade real de run/attempt/runner Linux x64. Não inventar variáveis de identidade Actions fora de Actions para fabricar admission.

### Manifest pendente — documental, não admission válida

~~~json
{
  "gate": "G06",
  "status": "BLOCKED",
  "candidateSha": null,
  "candidateTree": null,
  "snapshotSha": null,
  "ownerClaim": null,
  "requestOnlySnapshotRequired": true,
  "snapshotOnlyChangedPath": ".ci-run.json",
  "selection": "controls",
  "historicalControlFileCount": 3,
  "historicalControlCaseCount": 7,
  "requiredFinalCaseInventory": null,
  "malformedApplicationPayloadReceipt": null,
  "requiredEvidence": [
    "admission.json",
    "report.xml",
    "summary.json",
    "bun.log",
    "exit-code.txt",
    "setup.json",
    "package.json",
    "databases.json",
    "service.json",
    "daemon-controls.json",
    "cleanup.json",
    "receipt.json"
  ],
  "runId": null,
  "artifactId": null,
  "artifactSha256": null,
  "receipt": null,
  "readyToExecute": false
}
~~~

A admissão efetiva usa o schema existente `teams-profile-scanner-v1` no campo `teamsProfileScanner`, com candidateSha, candidateTree, requestSha256 e selection. A branch tem forma `tp-scan-<candidate12><requestDigest12><attempt>`; o validador verifica parent, árvore, branch, request normalizado e ausência de outras alterações. O manifest acima não deve ser enviado ao workflow.

### Evidência mínima de fechamento

- Candidate SHA/árvore e snapshot/run/attempt/job verdadeiros e compatíveis.
- Sete controles históricos preservados e executados, mais a obrigação de arquivo inválido benigno demonstrada; inventário final admitido e verificador reconciliados, sem missing, skip, todo, error ou cancelamento.
- Clean/EICAR/clean, protocolo ClamD malformado, limite de tamanho, indisponibilidade e admissões privadas observados nos controles originais.
- Recibo de arquivo/payload inválido benigno pelo ingresso real da aplicação, conforme contrato do formato, com efeitos e limpeza observados. Protocolo inválido e EICAR não são equivalentes a esse caso.
- Recusas sem efeitos duráveis comprovadas por observação independente de snapshots e blobs.
- Binário ClamAV e bases oficiais íntegros, sem banco sintético.
- Processos/portas pertencentes ao job, nonce e veredito Omni autênticos, cleanup concluído.
- Artefato imutável com digest e recibo preservados.
- proofClass e installedTeamsProof refletindo o alcance real, sem reinterpretar componente local como homologação Teams instalada.

**Primeiro bloqueio:** wiring e fixtures ausentes da linha atual, com dono/port ainda a reconciliar. **Lacuna de cobertura:** arquivo/payload inválido benigno ainda não demonstrado pelo conjunto recuperado. **Depois:** inventário reconciliado, SHA final e nova execução real da composição pertinente.

## Relação com os outros gates e go/no-go

A prova de Compras da sessão 222 (2) permanece válida somente no escopo de QA em que foi produzida. Ela não cobre os três modos de G05 nem os sete casos de G06.

G05 e G06 só recebem aprovação para o candidato efetivamente observado. G07 deve vincular o tar ao mesmo SHA/árvore confirmado; G08 e G10 qualificam a instalação desse tar nos ambientes isolados autorizados. Nenhuma passagem histórica desta documentação autoriza geração de tar final, virada de produção ou mudança de janela.

O próximo passo útil é fechar os claims de integração e as lacunas concretas de transporte e scanner. Repetir apenas os testes históricos sem pin final não resolve o bloqueio. A decisão de go/no-go permanece pendente dos recibos finais de todos os gates e da coordenação preservada.
