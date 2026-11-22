# Preparação do go-live — G05, G06, G07, G08 e G10

**Estado: roteiros e evidências de referência preparados; nenhum dos cinco gates foi aprovado no candidato final nesta frente.** O SHA final e as reservas dos ambientes ainda precisam de confirmação. Este pacote identifica o trabalho que pode avançar e os bloqueios concretos de execução.

Escopo recebido no [handoff c02f329d](https://github.com/gustavomhss/Orchestra-SF/blob/c02f329d48d37e2f6296154978cd8a7cf80bcb64/docs/qa/sucafina/astra-go-live-handoff.md). Branch própria: `go-live-readiness`, criada de `dev@79912446753af5bb291fc2581543732eb4c83057`, árvore `5c32cd72537799632e7d2583c1775df1d88b8780`. Esse SHA é referência de leitura, não candidato final.

O [registro estruturado](status.json) contém por gate dono, SHA, artefato, recibo, bloqueio e critério de fechamento. Campos ainda não observados permanecem nulos; este JSON não é um recibo de execução.

## Donos e fronteiras

| Responsabilidade | Dono confirmado / confirmação pendente |
| --- | --- |
| Preparação e coordenação G05/G06/G07/G08/G10 | Esta sessão Astra |
| G01–G04, pool e integração do candidato | Sessão **Retomar migração para Microsoft Teams** |
| Correções residuais #349 | Outra sessão Astra, `audit-residual-bundle` |
| G09 e #588 | Gustavo e Astra já responsável |
| Aceite de Compras já realizado | Sessão **222 (2)**, limitado à instalação QA observada |
| Transporte Server/HTTP e composição Files/Operations | Claim exclusivo de edição a confirmar com a Migração antes de alterar caminhos compartilhados |
| Executor do pacote final e decisão de toolchain | Release atual a confirmar; #247/#257 são referências históricas |
| Reserva QA, host, sessões Entra e callbacks | Responsáveis atuais ainda não confirmados |
| Backup, corte, recuperação, observador de efeitos e rollback | Responsáveis atuais do ensaio ainda não confirmados |

A posse documental desta sessão limita-se aos seis arquivos em `docs/qa/sucafina/go-live/`. Nenhum caminho compartilhado de produto, workflow ou ambiente foi editado nesta etapa. A fila de G03/G04 e a frente #349 permanecem com seus donos.

## Estado por gate

| Gate | Preparação concreta | Prova reaproveitada | Primeiro bloqueio para executar/fechar |
| --- | --- | --- | --- |
| **G05 — HTTP** | [Roteiro dos três modos, isolamento e recibos](g05-g06-controls.md) | Exercitador e catálogo existentes; alcance do transporte conferido | Dono/rota do listener HTTP real e admissão Teams precisam ser reconciliados. O exercitador atual chama handlers em processo e usa Basic; não fecha a prova pedida. |
| **G06 — ClamAV** | [Controles, seleção, integridade, cleanup e lacuna malformed](g05-g06-controls.md) | Run 44684352036: 59 controles do verificador + 7 casos reais aprovados | Workflow/fixtures ausentes da linha atual. O controle histórico de protocolo ClamD malformado não demonstra arquivo inválido no ingresso da aplicação. |
| **G07 — Linux x64** | [Produtor Microsoft, verificador/instalador e protocolo pós-pin](g07-linux-package.md) | Run 44983358294, artefato 14738902174, tar prod com hashes registrados | Pin conjunto Migração/Release, dono executor e toolchain/rota confirmados antes de gerar tar final. |
| **G08 — Teams QA** | [Matriz de homologação, reserva, seleção por papel e recibo](g08-teams-qa.md) | Aceite Compras 222 (2) preservado; #586/#592/#604 e suportes históricos classificados | Reconciliar executor/seletores/recibos atuais; confirmar slot, atores Entra e grants; depois instalar o tar G07 final. |
| **G10 — recuperação** | [Runbook de inventário, backup, corte, restore, restart/retry e rollback](g10-cutover-rollback.md) | Rota corporativa e testes #568/#574; instalador atual | Confirmar reserva/operadores e executor operacional de backup/migração; ensaiar no tar final com observador externo real. |

**Qualificação final observada nesta frente: 0/5.** Os roteiros foram produzidos; os recibos finais ainda não foram executados. Não contar testes históricos como passes de um SHA novo.

## Evidências que já evitam retrabalho

### ClamAV

[Run 44684352036](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44684352036), job 136115014524, fonte `6f9b66a2aaa8b057653244c94183254bb6f008b2`: sete casos reais, três arquivos, 162 asserções, mais 59 controles do verificador. Artefato [14606100590](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44684352036/artifacts/14606100590).

A classe emitida é `COMPONENT_REAL_CLAMD`, com `installedTeamsProof: false`. Preservar essa classificação. O daemon real, EICAR e os negativos de protocolo/admissão são insumos úteis; falta a obrigação de arquivo inválido benigno pela aplicação e a nova execução no candidato pertinente.

### Pacote Microsoft

[Run 44983358294](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44983358294), job 137088492396, fonte `83f1283f8e39cd5863d9806b9a48f0573f44eaff`: artefato [14738902174](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44983358294/artifacts/14738902174), tar interno SHA-256 `af312871e79307bd281e7d46a162feeb44bc0112db0e67cb59f8be55db20a109`.

Os logs registram verificação do pacote e instalação temporária idempotente. O preflight de VM foi substituído no runner; não é prova de VM/Entra reais. Esta sessão conferiu metadata e logs, sem readquirir os bytes do tar. A rota pertence à frente G09/Release e serve de referência; não foi disparada ou alterada por esta sessão.

### Compras

O handoff atesta **222 (2): 4/4 em QA, gravação/releitura e revogação do acesso temporário**. Esse aceite permanece preservado. O link do recibo original, o SHA/tar e a reserva usados não foram recuperados nas fontes consultadas. Registrar esses vínculos quando fornecidos; não converter essa ausência de backlink em reprovação do aceite nem usar o aceite para um tar novo.

As provas dos PRs [#586](https://github.com/gustavomhss/Orchestra-SF/pull/586), [#592](https://github.com/gustavomhss/Orchestra-SF/pull/592) e [#604](https://github.com/gustavomhss/Orchestra-SF/pull/604) usam contextos controlados/sintéticos e são distintas da prova operacional 222 (2).

## Dependências da integração e sequência

O agregado [44984930949](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44984930949), `0eab89232860463ab2aabbee15fc422e43bd6e74`, terminou com falha. A Migração abriu [44987301540](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44987301540), `b4ba7f595e6b3b5ff10a3379cd91b6771bb1b793`. Na observação de 22/11/2026 05:08 UTC, esse run ainda estava em andamento e já havia falhas nos shards 4/5/8. Não há confirmação de candidato final derivada desse run.

A ordem de trabalho é:

1. **Em paralelo agora:** resolver os donos dos componentes, reconciliar G05/G06 e os executores G08/G10, preparar atores/dados/reservas e revisar a rota de pacote. Os documentos detalham entradas e oráculos.
2. **Confirmar C/T com Migração e Release:** registrar referências verificáveis dos dois aceites, gates de entrada e toolchain/rota escolhidos. O pin não é preenchido por inferência a partir de `dev`.
3. **Qualificar G05/G06 e produzir G07:** no mesmo candidato final, emitir recibos reais e verificar tar, inventário e instalação.
4. **Executar G08 e G10 em paralelo:** consumir exatamente o mesmo tar em ambientes autorizados separados. Não reconstruir entre os gates.
5. **Consolidar go/no-go:** conferir os cinco recibos desta frente e os gates externos, incluindo G09. A virada de produção depende da decisão humana e da aprovação específica da janela.

Se código ou bytes mudarem, os vínculos de evidência devem ser reconciliados e os controles pertinentes reexecutados. O pacote documental não cria um novo candidato de produção.

## Coordenação a registrar

Os pedidos de coordenação devem trazer respostas concretas, sem assinatura gerada por esta sessão:

| Destino | Informação necessária |
| --- | --- |
| Migração | C/T final ou estado de bloqueio, recibos G01–G04/pool, dono exclusivo de Server/HTTP e Files/Operations, rota instalada G08/G10 e caminhos que podem ser alterados |
| Release | Confirmação do mesmo C/T, executor do pacote, workflow/toolchain, recibos de entrada e tratamento dos artefatos |
| QA/Entra | Reserva isolada, operadores, sessões/grants, dados e ações de revogação/limpeza autorizadas |
| Backup/recuperação | Reserva separada, executor e versão, chave/destino por referência privada, observador independente e release anterior já instalado/retido |
| 222 (2) | Recibo sanitizado original e vínculo ao SHA/tar/instalação do aceite já realizado |

As solicitações e eventuais respostas ficam no PR desta branch e no campo `coordination.requests` de `status.json`. Uma solicitação publicada é pendência; não é aceite recebido.

Pedidos publicados e relidos: [Migração/reservas/222 (2)](https://github.com/gustavomhss/Orchestra-SF/pull/628#issuecomment-7074623731), [Release](https://github.com/gustavomhss/Orchestra-SF/pull/247#issuecomment-7074623941) e [pacote Microsoft](https://github.com/gustavomhss/Orchestra-SF/pull/257#issuecomment-7074624125). Ainda não há ACK recebido nesta frente. O PR documental é [#628](https://github.com/gustavomhss/Orchestra-SF/pull/628), draft.

Durante a publicação, dev avançou para `079d86766f9c324924e024d53722c09e018c23d2`. O status registra esse movimento; a análise de fontes permanece vinculada ao pin de triagem indicado e nenhum desses heads foi adotado como candidato final.

## Revisão e verificação deste pacote

Três subfrentes reais trabalharam em paralelo e fizeram revisão cruzada dos documentos. Foram corrigidos quatro pontos materiais antes da integração:

- Protocolo ClamD malformado não satisfaz a obrigação de arquivo inválido da aplicação.
- F04 precisa manter guest/seletor malformado/zero requests no stale-preflight; Teams/U15/U39/U40 precisam de invocações e bundles próprios.
- O rollback do instalador só seleciona uma release R já instalada e retida; ter seu tar não basta.
- A rota corporativa de restore cobre somente o dashboard de um Team; o backup operacional precisa provar separadamente as demais classes inventariadas.

A verificação documental usa leitura de retorno dos blobs, links e pins observados, consistência do JSON e comparação do diff com a base. Não representa testes de produto nem aprovação de gate. Não foram iniciados CI, build, tar, login, revogação, deploy ou alteração de produção por esta frente.
