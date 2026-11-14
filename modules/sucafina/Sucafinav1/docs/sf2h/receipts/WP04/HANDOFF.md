# WP04 — entrega Astra e estado de aceitação

**Implementação publicada e CI cirúrgico aprovado; aceitação integral BLOCKED. PR #23 permanece draft contra `sf2-stack`.** A cobertura abaixo não declara GNATIVE nem fechamento global. O handoff limita WP04 aos paths próprios e exige registrar dependências de outros proprietários em vez de encobrir gaps com fixtures.

- PR: https://github.com/gustavomhss/Orchestra-SF/pull/23
- Branch: `astra-wp04`
- Planejamento: `dbf9547211d9b0fade619790de7c19c0869b7c7d`
- Handoff operacional: `c4bd6592718b3862afbc7bb601c001365e593c20`
- Seed: `d183840f71eaa07244d984f314facfb76ef25799`
- Base observada da PR: `6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0`
- Produto testado W: `c9f861851c5b8c9f341e2be7f9c525267987eb80`
- Tree de W: `6db3b935e328f8742f98bcc15590617ae3367f42`
- Snapshot executado S: `df1b7a42f52eb125930f93e70c2281823f1fdf8b`
- Tree de S: `949d26de3e878ce7aceb33aab28d757f826fd414`

Os recibos são acrescentados em commit exclusivamente documental depois de W. A PR registra o head entregue e a verificação remota desse delta. Testes são atribuídos a W/S, nunca ao SHA documental por inferência.

## O que mudou

1. **Filas e fontes:** ordenação por entrada comprovada e desempate por ID; busca por requester/buyer/etapa/holder; recorte de filas, totais e drilldowns; projector próprio instalado nos testes pelo seam real do lifecycle SQLite; continuidade, revogação, reissue e A→B→A preservados.
2. **Pedido guiado:** erros iniciais associados aos campos reais, texto escapado, contexto de etapa/versão/valor, recorrência preservada ao ocultar, origem das sugestões de PO e preservação de condições negociadas.
3. **Valores e comparação:** nenhuma moeda ausente ou seleção ambígua vira base presumida; FX congelado, estado aprovado/emitido, valores ausentes/zero e overflow são distintos. UI e produtor recusam taxa string. Regra monetária versionada participa de C06 nos campos pertinentes. Scoring, elegibilidade e política existentes são preservados.
4. **Preparação/decisão:** comando/evidência/preview públicos não compartilham objeto mutável com execução privada; inputs são capturados antes de awaits; fence revalida autoridade/abort; os resumos e preparação seguem somente leitura até o comando humano próprio.
5. **Suppliers/Settings:** banco restrito e revalidação explícita, sem alegar screening externo; viewer recebe os campos de negócio permitidos; nomes duplicados mantêm aviso e taxId duplicado mantém recusa; reset e defaults preservados.

Não foram adicionados papéis, alçadas, override, autoaprovação, vínculo orçamentário inferido, recebimento/pagamento ou confirmação externa de emissão.

## Verificação hospedada

| Verificação | Resultado observado | Evidência |
| --- | --- | --- |
| Seleção final de 21 arquivos | **146 pass, 0 fail, 879 assertions** | [Run 43517984814](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43517984814) |
| Validação canônica do request | Success; package `sucafina`, diretório `modules/sucafina`, runner Bun, env vazio | Passo Read request no mesmo run; `ci-request.json` |
| Produto W = snapshot S | Todos os root entries/subtrees idênticos fora de `.ci-run.json` | `product-snapshot-equality.json` |
| Omni positive control | **Not applicable**; nenhum teste declarante, spawn ou delegação Omni provados | Log final, sem alegação de prova Omni |
| `bun typecheck` do package | **FAIL: 137 diagnósticos em 45 paths estrangeiros; zero em paths próprios** | [Run 43517972310](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43517972310) |
| `bun run check:guards --base origin/dev` | **PASS: 78 regras, zero gate, 11 warnings, zero erros** | Mesmo run; base realmente fetchada |
| Artefato de tipos/guards | `astra-wp04-checks`, ID `14081102701` | [Artifact](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43517972310/artifacts/14081102701) |
| Testes locais | Não executados | Respeitado o protocolo do handoff |

Os 21 arquivos compreendem os 16 testes WP04 selecionados, `parity-procurement.test.ts`, `procurement-runtime.test.ts` e `porta/{codigo,linha,s3}.test.ts`. A lista exata está no request. A workflow Bun não publica o diretório de evidência reservado ao Playwright; não é alegado um artifact Bun inexistente.

### Primeira rodada e correções

W1 `a04f9c2d09ae08319d0a5c284d954108a049f9bd` / S1 `d3b19b5c6272dd8d031e7254acc38863fac7490f`: [run 43516884819](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43516884819), 137 pass / 6 fail. As falhas localizaram expectativas binárias/de apresentação, ordem antiga da fila, fixture sem Settings e uma sequência em que `proposals.find` deixou de estar disponível depois de matcher agregado. A atribuição ao matcher é inferência do log; não é um diagnóstico geral do Bun. W2 usa assertions individuais e conserva o oráculo de negócio.

O primeiro typecheck tinha 150 diagnósticos, 13 próprios em quatro paths. W2 corrigiu esses 13 com tipos contratuais/fixtures adequados, sem casts permissivos. Os outros 137 mensagens/paths permaneceram idênticos. A revisão estática encontrou os statements no seed; não foi executado um typecheck separado do seed. O gate do package continua vermelho.

Novos cenários explícitos W2: empate de scores sem seleção automática; existing→new→existing preservando campos e recusa real de existing sem contractRef; legalName duplicado com aviso e taxId duplicado recusado. A revisão independente W1/W2 não encontrou outro defeito bloqueante demonstrável após a correção de FX; o resultado final hospedado é a prova executada.

## Mapa completo do pack

Todos os **111 IDs canônicos** estão em `criteria.json`, com o texto integral, implementação, consumidor, teste pelo nome exato, run/SHAs e limite. `criteria.md` oferece a leitura tabular.

| Estado | Critérios |
| --- | ---: |
| PASS_SCOPED — comportamento próprio provado no run final | 39 |
| PASS_DOCUMENTED — handoff/inventário/ownership registrados | 3 |
| PARTIAL — prova própria com limite restante explícito | 44 |
| BLOCKED — dependência/consumidor/prova composta ausente | 21 |
| NOT_RUN_HUMAN — compreensão humana não medida | 4 |
| **Total** | **111** |

Portanto **69 critérios ainda não estão integralmente comprovados**. Os 39 PASS_SCOPED também não representam aceite integrado/global; sua qualificação é estritamente a descrita em cada entrada. Não há redução silenciosa do escopo do pack.

## Bloqueios para S0 e proprietários

| Pedido | Proprietário e ação necessária |
| --- | --- |
| INT-01 | WP10: delegar o projector comum ao canônico WP04 e usá-lo em toda mutação durável |
| INT-02 | WP00: integrar schema fechado atualizado de CommercialComparison e geração oficial |
| INT-03 | WP10: verificador residente deve aceitar/comparar critérios configurados reais |
| INT-04 | WP10/WP08/WP09/WP11: montar roteamento C06, C12, dossiê e produtores de rotinas ausentes |
| INT-05 | WP01: consumo dinâmico de fieldErrors, revisão CAS explícita, foco/teclado e preservação do comentário em conflito |
| INT-06 | WP14/WP10: corrigir tipo callable do resolver e migrar fixture para lifecycle/issue/resolve reais |

`integration-requests.md` contém paths, pins/blobs observados, mudança proposta e prova de fechamento. Três patches revisáveis acompanham o pacote e **não** foram aplicados aos arquivos estrangeiros. `typecheck-triage.json` discrimina todos os diagnósticos e a causa estática.

Continuam ausentes a paridade UI/native/MCP montada dos quatro exports, os recibos reais Session/SkillLoadReceipt, medição humana de 30 segundos, prova browser de foco/conflito, todos os bytes de download e as qualificações globais reservadas à integração. Os testes próprios não substituem essas evidências. Não houve merge, deploy, epic/full suite ou mensagem externa.

## Ordem de retomada

1. Integrar os produtores proprietários nos pins revistos, revisar/aplicar os deltas de composição e resolver o gate de tipos do package sem eliminar provas de sucesso.
2. Executar os negativos e caminhos autorizados do host composto, reissue/ABA/revogação e as quatro capacidades com mesma base/autoridade por superfície.
3. Executar browser concorrente/teclado e o roteiro humano de compreensão; registrar respostas incorretas e tempo.
4. Atualizar os 69 critérios abertos com evidência observada, executar as seleções globais exigidas pelo plano e só então qualificar aceite integrado/retirar draft.
