# Missão52 — adendo financeiro do diagnóstico18

**DIAGNOSTIC_ONLY — zero aceitação nominal.** D18 terminou com4PASS/1FAIL nas cinco jornadas instrumentadas. A família financeira continua sendo o caso que falha antes da criação da requisição. Este adendo não altera o financeiro nominal v9, os critérios17 nem o estadoACTIVE da missão52.

O [receipt completo de D18](sandbox:/workspace/scratch/fec39c0682b3/m52-audit/diagnostic18-43688075463/diagnostic-18-receipt.json),344207bytes, tem SHA256 `498c457265841a43eec197d9314f7f25f7a5cfe9fdd9960448e8e3d10c322643`. A derivação financeira independente está em [financial-diagnostic18-evidence.json](sandbox:/workspace/scratch/fec39c0682b3/m52-audit/financial-diagnostic18-evidence.json),18304bytes, SHA256 `a3cce49be83bf7d311642b5338618ccc6195172e384b0d9d1e475a21d85c46ec`.

## Identidade e resultado financeiro real

| Elemento | Evidência |
|---|---|
| Run / tentativa | [43688075463](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43688075463) /1 |
| Job de testes |132732645584, failure |
| Job de cleanup |132733863034, success |
| Base | C53 mais terminal105, `eeff9b78219b5efe1ad78e68d4490af0d7c5ed07`, tree `072950bafdc50b9eddc549f7a327742bc5086bf6` |
| W de produto anterior à instrumentação | `2624fe74b31cb5613f9c8546961e7a393f06ab9e`, tree `73ef254b9b9e75f8a9a3db900684b0b756f080b3` |
| W diagnóstico | `03e5439ab1c935ece5b58c90101750495416a341`, tree `c36a60094e43742170ee14c2705f3e30a9d2e5e0` |
| S efetivo | `17cd5a0747a32d0ce5ce7efe3edbd565f1c55b15`, tree `135178fa94d68bb8086db0a310b427478d874bd8` |
| Artifact |14151645954,385258bytes |
| SHA256 do ZIP conferido | `165737802c6c0300577d3892a4c2efc1e366ad2d135180093b73f28279d81811` |

A identidade original é **`CI-UI-DECISIONS — require a real Procurement proposal and approval before Apply and recover its unique receipt`**, linha21 da spec, J2 na ordem do arquivo e quinta família semântica obrigatória do pacote.

O runtime registra **FAIL em14598ms**. O primeiro passo, `create the real requisition through its human form`, durou10041ms. A navegação para `/sucafina/procurement?page=Requests` produziu o único evento registrado: GET `/sucafina/procurement`, HTTP503, `application/json;charset=utf-8`. O DOM apresenta `{"status":"unavailable","reason":"procurement-queue-unavailable"}`. A assertion original de `form[data-command="create"][data-page="Requests"]` esperava1 e recebeu0 sob10000ms. O budget do caso permanece180000ms; retry0 e nenhum teste foi pulado.

As listas de observações de domínio e requests de comando estão vazias, e `bodyCompleted:false`. **Zero mutações financeiras observadas.** Criação, proposta, aprovação formal, Apply, recibo e recuperação financeira não foram alcançados. O log da CLI registra shutdown `disposed`; o caso não ficou bloqueado por vazamento de porta. Fontes: [observações J2](sandbox:/workspace/scratch/fec39c0682b3/m52-audit/diagnostic18-43688075463/observations-line-21.json), [DOM](sandbox:/workspace/scratch/fec39c0682b3/m52-audit/diagnostic18-43688075463/extracted/packages/app-shell/e2e/test-results/sucafina-decisions-CI-UI-D-44857--recover-its-unique-receipt-chromium/error-context.md) e [jobs finais](sandbox:/workspace/scratch/fec39c0682b3/m52-audit/diagnostic18-final-jobs.json).

O503 genérico não isola o ramo de contexto, moeda, coleção ou revalidação que falhou. O contrato financeiro e sua pré-condição estática permanecem descritos no v9: não há autorização para moeda implícita, política nova, seed, aprovação equivalente à escolha humana ou alteração de C12. **M31/MI07 continuam como barreiras contratuais posteriores, não alcançadas por este caso.**

## Separação do nominal17

O [financeiro v9](sandbox:/workspace/scratch/fec39c0682b3/m52-financial-terminal-draft-v9.md) continua byte a byte preservado:14822bytes, SHA256 `39823ae5adf66321be6a6451f4e816b0af6a3a0e96da0556e4ce30c0e530b23c`. Seu resultado nominal continua N17,3PASS/2FAIL, J2 Requests503/form0 em15917ms, sobre W2624/S5ae402. D18 não substitui esse resultado nem transporta seu4PASS para critérios, história instalada ou liberação da fonte.

Os resultados e a autoridade permanecem vinculados aos respectivos candidatos. O terminal105 encerra a autoridade de integração sem sucessor nomeado;52 permaneceACTIVE no escopo de sua fonte e das qualificações isoladas autorizadas. O destinatário47 continua sendo o handoff solicitado, sem alegação de lease ativa.

## P14 após a medição: manter como hipótese secundária

O parecer estático anterior continua válido: envolver somente o callback padrão `readScenarioResult` no helper canônico pode preservar as verificações e deixar a escrita fora da raiz de leitura. **A medição não demonstra que essa mudança resolveria a falha nominal17.**

| Primeiro handler de escolha de D18 | Chamadas | Tempo agregado observado |
|---|---:|---:|
| Handler completo medido no servidor |1|8129,195ms |
| `choice.compare` |1|5020,346ms |
| `choice.values` |1|2231,263ms |
| `choice.stored-result` |2|402,058ms |
| `choice.save` |1|208,745ms |
| `choice.capture` |1|65,242ms |
| `canonical.digest` |195778|3491,585ms |
| `runtime.currentAccessSnapshots` |7749|1273,010ms |

Fonte: [cost18-summary.json](sandbox:/workspace/scratch/fec39c0682b3/m52-audit/diagnostic18-43688075463/cost18-summary.json), SHA256 `37c039259b6d87be6aa9266017a5c5776bde540843af10b27fd1a74741be9305`. São tempos inclusivos: capture está dentro de save; digest e projeções de acesso atravessam as fases. Eles não devem ser somados como custos independentes. O timer do servidor não mede recebimento no navegador nem fornece, por subtração, margem garantida sobre o deadlineUI.

O trecho diretamente visado por P14 representa aproximadamente **4,95%** da primeira escolha medida.402ms seria o teto ideal se todo esse trabalho desaparecesse sem custo, o que não é o desenho proposto: três leituras C08, verificações de fontes, digests e autoridade continuam obrigatórios; a raiz acrescenta admissão e finalização. O ganho líquido é desconhecido e pode ser menor ou negativo.

D18 concluiu J1 usando P13 mais instrumentação, sem P14. Isso registra uma execução diagnóstica bem-sucedida; não explica causalmente a diferença para N17 nem qualifica o nominal. A recomendação é **HOLD de P14 como otimização secundária**, sem introduzir patch ou novo gate apenas para rotular o problema de deadline como resolvido. Se o owner decidir retomá-la, permanecem os controles cirúrgicos de ramo armazenado real, encerramento antes do commit, abort/lease, poison e preparação customizada, além das jornadas nominais originais. Nenhuma guarda, chamada de autoridade, política ou timeout deve ser reduzida para obter o resultado.

Parecer de custo: [P14-diagnostic18-cost-critique.json](sandbox:/workspace/scratch/fec39c0682b3/m52-audit/P14-diagnostic18-cost-critique.json),6351bytes, SHA256 `94ea2f068b82607b3366f37a7de8c9108808f35cd98ed1c488ff0b337d086d37`. Não houve implementação de P14, execução de produto/teste, dispatch ou operação remota neste subtrabalho.
