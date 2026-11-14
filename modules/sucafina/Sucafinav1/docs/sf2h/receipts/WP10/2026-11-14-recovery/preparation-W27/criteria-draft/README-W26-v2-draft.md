# WP10 — preparação de dados W26-v2

**Este é o draft de dados selecionado para o próximo binding.** Ele acrescenta o terminal A26 e o parecer focal R3 ao W26-v1 selado. Preserva os 171 critérios literais, sete títulos de tasks, mesmos 80 IDs de obrigações, 128 registros de cópias estrangeiras e 131 inputs somente de leitura. Nenhum critério, task, runtime nativo ou epic global recebe aceite.

A configuração selecionada é `parameters.draft-W26-v2-final.json`, e a saída é `draft-W26-v2-final/package`. O sufixo `final` identifica apenas esta revisão de dados pronta para uso; seu modo continua `draft`, com `FINAL_W/D=null`, `CI=[]` e zero pareceres finais. O primeiro materializado `parameters.draft-W26-v2.json`/`draft-W26-v2` foi preservado como intermediário anterior à conferência de consistência de uma frase sobre o estado de A; ele não é a configuração selecionada.

## Produto e evidências no corte

W26 é `a1434e7ea7340aa1d1c8ce6bb48958b724218170`, árvore `a9398de38c9e684d28c27b0188ab653e75bf3305`, pai W25 `3d59829e5d9e438cbb443428a9479d7f63b5bf31`. A verificação de dados do v1 permanece válida: 16.711 blobs na árvore completa, 1.738 arquivos congelados conferidos, 179 deltas — dez fontes/testes próprios, sete inputs PR36 exatos e 162 recibos —, 439 pins efetivos e nenhuma deleção.

| Evidência | Identidade exata | Resultado registrado |
|---|---|---|
| CHECK W26 | run `43618446973`, job `132518557041`, S `f3e863c00eabfa852e56452b083701f00b9ebff5` | `failure`: zero diagnósticos próprios, 13 estrangeiros, 13 ocorrências. |
| A26 | run `43618475702`, job `132518644009`, S `dd53af531181d1b05e5081b765dbfecc2a6ba6a9` | `failure`: 45 passagens, uma falha, 46 testes/oito arquivos, 1.904 expects, 391,43 segundos; zero skips/erros adicionais. |
| X26 inicial | run `43619479808`, job `132521664604`, S `4650ebf5948747a49f04120070765aa6317e6fd8` | Captura inicial `in_progress` das 17:08:43Z, conclusão nula. Não há terminal, duração ou resultado funcional inferido. |
| R3 focal nativo | `reviews/R3/preflight-W26-native.json`, W26 exato | Preflight independente estático; `finalReview=false`, `countsTowardThreeFinalReviews=false`. Bloqueio de composição confirmado com precisões. |

CHECK e A ficam em `observed_ci_pending_binding`. Os 21 registros adicionais de CI histórico mantêm seus W/S/run/job próprios; os três terminais W25 CHECK/A/H permanecem históricos. Nenhum run é retaggeado.

### Escopo real de A26

| Arquivo completo | Resultado no run falho |
|---|---:|
| `routine-installed-publication.test.ts` | 5/5 passagens |
| `procurement-record-read-scope.test.ts` | 3/3 passagens |
| `procurement-evidence-read-scope.test.ts` | 4/4 passagens |
| `work-bridge.test.ts` | 11/11 passagens |
| `memory-services.test.ts` | 6/6 passagens |
| `analysis-services.test.ts` | 5/5 passagens |
| `native-inputs.test.ts` | 11/11 passagens |
| `historical-memory.test.ts` | Uma falha no deadline cooperativo |

A correção do ciclo de vida do fixture C07 passou seu arquivo completo; o erro histórico de banco fechado de W25 não foi observado em A26. Isso prova esse escopo de publicação instalada somente de leitura, não a implementação das cinco rotinas governadas C07.

Memory prepare/verify/accept-output retornaram em 37.782/37.979/37.861 ms, cada fase mantendo duas observações Atlas concluídas, seis leituras de contexto de evidência e quatro contextos agrupados de case. A última contraprova concluída foi a de headers finais da Request, em 207.679 ms. A fase `memory.same-request-new-proof` começou em 207.690 ms e retornou em 225.014 ms com `aborted=true`; o teste falhou em 225.029,32 ms contra o deadline cooperativo de 225.000 ms, mantendo o orçamento externo de 240.000 ms.

A asserção positiva da nova prova e a cauda de stale/cancelamento/output/capture **não recebem crédito**. O `stale.preserve` observado em A25 permanece histórico; não foi transferido para A26. Contadores instrumentados representam chamadas de APIs, não commits físicos ou medições repetidas de desempenho. O teste continua falho apesar das passagens dos dois helpers.

Omni observou um teste declarante, dois spawns e zero delegados, com sucesso apenas do controle positivo. Cleanup `132521071078` e deleção do snapshot tiveram sucesso. A API de artefatos retornou uma lista vazia. O log bruto de A tem 95.897 bytes, SHA256 `b4b41f42838860c118967c8a08182f9f0cf2af01835bd2b1cf3ce8817c8f7f41`; bytes, caracteres, LF, resumo, contagens nomeadas, fases e identidade do run foram conferidos.

## Precisões do parecer R3

O JSON original tem SHA256 `425116b8c7c2a5e7246046fb500f202094f0452a3e9ca5969e47b5b880fb4289`; o MD, `5746ee9b9c5160e026664d859c0d9cd27e99e475704edeb13d11611fa9372ed7`. Ambos, seus inventários e âncoras remotas são preservados byte a byte. A criação/corte do parecer não foi reescrita após o terminal A26. Os 47 arquivos de base e 12 fontes públicas adicionais foram conferidos por hash/árvore como dados; isso não transforma este builder em revisor independente.

As cinco precisões estão vinculadas às obrigações C07 existentes, sem criar um 81º ID:

1. **Contexto próprio real:** `contribution.execute(payload, context)` recebe `Tool.Context` autêntico, que pode ser capturado privadamente no host. Ele ainda descreve uma invocação `sf_*`, não a parte `task` gravada e exigida por `Task.requireParent`. Faltarem campos em `TrustedDomainContext` não é uma prova geral de impossibilidade.
2. **APIs públicas reais:** Relay create/rebind/holder/currentStep/transition, RelayWorkflowSession current/reconcile/settle e hooks TaskGovernance existem. Esses primitives não completam o handoff C07 nem autorizam inventar aprovação, arm, binding ou recibos. Chamar um hook isolado não executa todos os controles canônicos de Task.
3. **Knowledge condicional:** o resolver canônico e a associação de autor Archie obtida do plano/upstream são requisitos para workflows com anchors de conhecimento. Essa lacuna não bloqueia todo catálogo somente de leitura ou toda materialização sem anchor. Exportar apenas o resolver não cria a autoria legítima.
4. **Watch:** há duas ausências separadas: registro do descritor e implementação positiva. O callback real retorna `native-watch-admission-port-unavailable` após validar case/condição/materialidade. Registrar o descritor sozinho apenas exporia essa recusa. Watch é separado das cinco rotinas C07.
5. **Guarda Task:** exige parte `task` real com input decodificável não pending e igualdade de input/contexto; não exige isoladamente `status===running`. Não se afirma que um retry exato já concluído é negado apenas pelo status.

S0/Maestro-Core e WP09 precisam fornecer ou dispor o handoff canônico e os fatos autenticados de plano/aprovação/arm/admissão/run/terminal/artefato. Maestro-Atlas tem a obrigação condicional de resolver/autoria quando há anchors. WP10 continua responsável pela composição própria do adapter, conservação de identidade/ACL/lease/revogação/cleanup e registro das rotinas reais, seguido das provas hospedadas/nativas aplicáveis. O relatório não prova impossibilidade universal de um desenho futuro nem dá aceite nativo.

## Obrigações ainda abertas

- **Memory:** completar o arquivo inteiro dentro dos orçamentos originais, incluindo nova prova, stale, cancelamento e cauda de output/capture, sem excluir contraprovas.
- **Limiar exato/WP13:** X tem somente captura inicial; P/Q e demais seleções requeridas ainda precisam de terminais reais. A fonte dos dois consumidores foi corrigida e revisada focalmente, mas não recebe PASS por isso. Transporte HTTP montado, fallback executado, restart durável, revogação durante await final, promoção e materialidade continuam fora do alcance presumido do novo teste.
- **13 diagnósticos estrangeiros:** WP04 3, WP06 4, WP08 5 e WP09 1, com os mesmos paths/blobs de W25. Há mapa por linha/código/owner/pin; arquivo herdado sem pin de intake fica identificado por seu blob publicado.
- **H05:** no H25 houve 409 esperado/200 recebido em 11.341,16 ms, não timeout. WP04/WP11/S0 devem decidir e publicar o contrato coerente; não se altera teste estrangeiro para fabricar verde.
- **Freeze 10:** comparação estática W26 37/38. A divergência é `host-context.ts`, esperado SHA256 `6a608e24847fe730b645d5f51f86e47d83e803875162820038e0c05d18f96772`, observado `42839b627194c59febff34052b813a6e4725414dcf84c8308397539b734b3893`. A fonte estrangeira não foi editada; WP00/S0 e prova hospedada continuam necessários.
- **C17/Review/Portfolio:** grupos completos de cálculo/histórico/recall, configuração residente Review e HTTP Portfolio continuam vinculados às obrigações próprias. Materiality `unknown` não se transforma em `notApplicable`; D22 cancelado não dá crédito a arquivos próprios não observados.
- **Governança/revisão/entrega:** três revisões finais independentes do mesmo candidato, native/Task/knowledge condicional, jornadas instaladas, AM/GNATIVE e guard externo de D continuam pendentes. O epic global segue adiado até o bundle integral, conforme pedido do usuário.

## Reproduzir e vincular depois

Os comandos abaixo processam dados. Não executam/importam produto, testes, typecheck, build ou CI, nem fazem mutação remota.

```bash
python -B agents/criteria/final-package/prepare_w26_v2_parameters.py
python -B agents/criteria/final-package/build_final.py \
  --config agents/criteria/final-package/parameters.draft-W26-v2-final.json \
  --out agents/criteria/final-package/draft-W26-v2-final
```

O v2 deriva do v1 selado. O v1 deriva do W25-v2 selado. Configs/capturas anteriores não são reescritas. A árvore/pins de W26 e as fontes congeladas sustentam as observações preparatórias; `source-bindings.json` do draft continua sem hashes finais até `FINAL_W` ser vinculado.

Quando todos os terminais requeridos e três reports finais estiverem disponíveis para o candidato escolhido, o root pode usar o binder genérico selado. Exemplo **futuro**, não executado por esta preparação:

```bash
python -B agents/criteria/final-package/bind_successor_parameters.py \
  --config agents/criteria/final-package/parameters.draft-W26-v2-final.json \
  --out agents/criteria/final-package/parameters.bound-W26-final.json \
  --namespace review-W26-final \
  --publication publication/manifest-W26.json \
  --verified-tree publication/verified-W26-tree.json \
  --frozen-repo publication/frozen-W26/repo \
  --ci-root evidence/W26/normalized \
  --reviews-root reviews \
  --require-ci --require-three-reviews \
  --build-out agents/criteria/final-package/bound-W26-final
```

Esse exemplo só é válido se W26 continuar sendo o candidato final e os três reports finais tiverem o nome/identidade esperados pelo binder. Um sucessor requer configuração própria e histórico W26 preservado. O flag de CI não substitui a checagem de que todos os grupos requeridos estão presentes; o root deve verificar a seleção completa e suas pendências antes da entrega. Updates de obrigações podem ser fornecidos por `--final-obligation-updates` somente com evidência válida, sem aceite inventado.

As expressões genéricas `CANDIDATE_UNPUBLISHED_UNBOUND` e `PENDENTE — draft sem SHA` no README gerado indicam que `FINAL_W` permanece nulo; a publicação W26 está explicitamente documentada no recibo de preparação. O builder/binder selados não foram alterados. D ainda não existe neste pacote e seu futuro SHA/guard não é antecipado.
