# Migração, compatibilidade e reconciliação de handoffs

Leitura documental, sem execução de produto. A inspeção abrangente de arquitetura foi fixada em **C27** e complementada pela reconciliação de **C28 `d088708276b48f896ad4e0ecd2a95cb73dc413b1`**, publicada durante esta sessão. C28 é candidato material em **QUALIFICATION HOLD**, não aceite funcional. Nenhum código ou receipt de terceiros foi copiado para esta branch de planejamento.

## 1. Reconciliação de autoridade e candidatos

| Registro | Pin / fato observado | Consequência para esta adaptação |
| --- | --- | --- |
| Briefing | `87d6e496a6a1e08e64ffb6d3c06890647a401459`, base C26 | Branch de planejamento continua nesse parent, recebe só docs |
| Terminal55 | `9b1670be4132ef78efb9126fca1562a3fcb1d633`, após C23 | Histórico preservado; não importar fontes que 55 reteve |
| ACK57 | `666ed28668ad3fc0bb9c89fdb57a0da33c57e2e4`; lease S0-C-e11-browser57 | Autoridade foi explícita, não inferida de silêncio |
| C24 | `bc51f4446f26cdc5f0f9b3da1c1e916f36221e34` | Sete paths próprios Procurement53 |
| C25 | `4b15af2d8f8a5b96cdd0a8117951939bde0b9d02` | Nove compartilhados53 reconciliados; admission/application propostos continuam inertes |
| C26 | `8274e3fe307a5046b7802d6651b0d21fc4f8cbb7` | Dois paths54, análise read-before-bind e controles |
| C27 | `b10c424a6b318879fc30f11d03ba1cfeffda7d1a`, tree `31be8f81803b77f03e9089e09118f78218b26262` | Runtime56, oito paths próprios + oracle externo. Base da inspeção abrangente |
| Terminal57 | `d6d9816bb09f7595330862616305e0791e23e61e`, tree `69cf88239d09ee164b12fecd482c6da3350b8b71` | Lease ENDED; diff contra C27 lido: exatamente 14 receipts adicionados, nenhum produto. Não é C28 |
| Terminal58 | `00813b2ebacf5b0cd1c69d871c7a757ac323ebb4` em astra-wp13 | P03 FAIL/HELD; lease 58 encerrada. Não confundir documento preparado no controle com estado final |
| Controle inicialmente observado | `sf2-control@1809a32ad042a0f98a5d93dc90447a7e13e78434` | 45 mantém checks; S0 mantém epic/final. Execução futura requer reconciliar sucessão vigente |
| ACK60 | `7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85`; epoch `S0-C-e12-browser60` | Sucessão explícita de 57; a60 é o writer de sf2-stack no pin observado |
| C28 | `d088708276b48f896ad4e0ecd2a95cb73dc413b1`, tree `8b07ebf53f492a20ce3381a8b4ec50bd21ec1c6d` | Pacote Reports48 completo: 45 paths materiais (21 shared + 24 own), 28 modificados e 17 novos; qualificação HOLD |

Fontes: [HANDOFF57](https://github.com/gustavomhss/Orchestra-SF/blob/d6d9816bb09f7595330862616305e0791e23e61e/modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/closure-intake-57/HANDOFF.md), [AUTHORITY57](https://github.com/gustavomhss/Orchestra-SF/blob/d6d9816bb09f7595330862616305e0791e23e61e/modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/closure-intake-57/AUTHORITY.json), [HANDOFF58](https://github.com/gustavomhss/Orchestra-SF/blob/00813b2ebacf5b0cd1c69d871c7a757ac323ebb4/modules/sucafina/Sucafinav1/docs/sf2h/receipts/portfolio-runtime-qualification/HANDOFF-FINAL.md).

O terminal 57 relata 27 paths materiais + 137 artefatos de origem + 13 receipts no delta55→C27, preservação de 56 obrigações e 17 findings. Esta adaptação referencia esse ledger; não o substitui, não reclassifica seus estados e não afirma ter executado sua auditoria de produto.

**A autorização de escrever documentos e abrir esta draft PR não constitui sucessão da integração.** A60 já publicou sucessão após 57 no pin observado; o N0 futuro deve obter autorização específica para a adaptação e reconciliar essa custódia vigente, sem iniciar uma segunda integração. Só uma nova sucessão exigirá novo ACK. Nenhuma branch de produtor, controle ou workflow foi alterada por esta sessão.

## 2. Pendências que afetam a UX e o plano de execução

| Dependência | Estado observado | Obrigação para o redesenho |
| --- | --- | --- |
| M31 / MI07 | Salvar draft → submeter valor persistido → aprovar snapshot congelado não satisfaz substituição ainda não gravada para Apply posterior | Preservar dois caminhos e o bloqueio original; nenhuma aprovação fictícia, checkbox ou permissão ampliada |
| Shared53 | Composto integrado; faltam provas discriminantes de histórico C17 real, recorded fallback, tombstone/recreate e revogação entre leituras | Nova UI consome contrato real; fixture do wrapper não qualifica montagem |
| P03 / missão 58 | Run [43661532296](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43661532296), W `0360b382f3db5449adfbd0ced794432b06c5a87e`: 0 PASS / 1 FAIL / 1 error, prazo de 180000 ms; 72 assertion lines preservadas, 24 expect calls agregadas não são 24 critérios aprovados | Portfólio não recebe aceite integral. Não repetir input inalterado; correção causal precisa do produtor/contrato competente |
| Proposta C08 da 58 | HELD, não aplicada/não testada; contraexemplos de clone/getters/ordem de observação | Não usar como “otimização necessária” para native DTO. Adapter de apresentação não autoriza essa mudança |
| Runtime56 | 65 PASS/1 filtered da origem; C27 não qualificado por transferência | Preservar cópias frescas, autoridade, aborts e memória; regressão composta dos 11 arquivos sem filtro permanece |
| Oracle financeiro legado | Somente título/count1→4; 19 assertions do caso mantidas | Não relaxar outros oráculos para obter screenshots/CI verde |
| Reports36/48 | Pacote completo composto em C28 com correções de classificação de leitura e retenção de draft; quatro jornadas/86 critérios ainda abertos | Consumir o contrato C28 após qualificação; preservar recuperação sem repetir efeito. Finding de classificação de Agenda39 e causalidade do POST continuam distintos e abertos |
| Decisions52 | Nominal06 da fonte: 3 PASS / 2 FAIL; cinco nominais e positivo financeiro permanecem obrigatórios; fonte não admitida no C28 observado | Conservar requisitos; compatibilizar somente release explicitamente consumida |
| Native41 / Relay / Schedule | Fonte integrada, admissão/continuação/readiness/Schedule reais em HOLD | Rotinas e IA mostram disponibilidade verdadeira; não substituir serviço por chamada local permissiva |
| Microsoft49 / C22 | 20 paths preservados, privacy/entry/transport e fixtures | Sub-API no mount e bridge de retorno exigem review do produtor; nenhum token/log/cookie relaxado |
| Finance34 / CurrentChoice46 / Memory40 / Agenda39 | Integrações herdadas com limites descritos pelos receipts | Não sobrescrever ao portar UI nem confundir “mais novo” com “admitido” |

### Reconciliação de encerramento: a60, C28 e fontes48/52/59

A leitura inicial de 48 em `ac72112c576edf20ef1bc3b53ee10dce26b00ac7` ainda dizia PREPARED_NOT_RELEASED. Esse estado é **histórico**, superado pela release terminal `c4f6676325f2549b29719fd5ce86132ad34212bc`. O [consumer ACK48 de 60](https://github.com/gustavomhss/Orchestra-SF/blob/d088708276b48f896ad4e0ecd2a95cb73dc413b1/modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/after-c27-60/consumer-ack48.json) aceitou a unidade completa para **preparar candidato qualificador**, sem aceite de runtime. O [incremento C28](https://github.com/gustavomhss/Orchestra-SF/blob/d088708276b48f896ad4e0ecd2a95cb73dc413b1/modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/after-c27-60/increment-01-reports48.json) identifica 45 paths, pre/postimages e a preservação de Microsoft49, C12, M31/MI07 e runtime 56.

A inspeção dos deltas e dos contratos C28 de autoridade, Reviews e discussion client confirma a direção a preservar: indisponibilidade de leitura não é negativa de acesso; resultado incerto conserva a intenção/rascunho no contexto autorizado; mudança real de acesso exige remoção. `revalidateReadEvidence` e `revalidateReadAccess` são hooks do produtor, não grants do frontend. A API nativa deve preservar essa classificação e a identidade da Request, sem recriar os gates.

Evidência de 48 continua limitada: installed 09 tem 4 PASS / 103 expects no W6/C27; diagnostic 08 tem 0 PASS / 1 FAIL, 180025 ms, sem causa de POST estabelecida. O CHECK02 da fonte relata 186 TypeScript / 3 GATE / 12 WARN. Nenhum desses resultados é prova de C28. O próprio incremento diz current_candidate=NOT_RUN, quatro jornadas OPEN e criteria86=NOT_ESTABLISHED. Criar C28 sozinho não autoriza repetir a mesma jornada sem corrigir sua precondição causal.

A reconciliação 60 mantém **dois problemas distintos**: `review-agenda-services.ts` classifica qualquer `ui.admit != ok` como denied/403 na descoberta, podendo apagar seleção recuperável; o POST de preparação fica sem resposta, com causalidade não estabelecida. Corrigir a classificação não comprova a causa do POST. N1/N8 consomem a correção liberada pelo owner Agenda39; não disfarçam 403 no cliente.

[Decisions52](https://github.com/gustavomhss/Orchestra-SF/blob/d088708276b48f896ad4e0ecd2a95cb73dc413b1/modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/after-c27-60/reconciliation/decisions52.json) permanece não liberado no pin `fd3cad4adf076ba1c18e8e3d86e5ae7aa8c614c1`. Nominal06, run 43663347199: 3 PASS / 2 FAIL na fonte. Comparação aborta sem HTTP/body; outra jornada recebe 503 na fila Procurement antes de criar o pedido. Esses achados não provam causa de servidor nem fecham M31/MI07. O mapa histórico Microsoft55 deve continuar imutável; eventual mapa sucessor e fixture só entram juntos com a instalação52 liberada. Nenhuma declaração textual de RUNNING é usada para inferir processo ativo ou abandonado.

[Runtime59](https://github.com/gustavomhss/Orchestra-SF/blob/d088708276b48f896ad4e0ecd2a95cb73dc413b1/modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/after-c27-60/reconciliation/runtime59-current.json), em `c0d2094357a8566d3a1329f0ec2dab70378d1892`, publicou ACK, contrato e adendo de disposal; nesse pin não há produto, release nem qualificação. A capacidade readonly proposta não reativa a projeção C08 rejeitada, não permite cache entre observações e não altera mutable roots. N1 não depende de uma otimização ainda não liberada para começar a especificar DTOs.

[ACK60](https://github.com/gustavomhss/Orchestra-SF/blob/d088708276b48f896ad4e0ecd2a95cb73dc413b1/modules/sucafina/Sucafinav1/docs/sf2h/receipts/integration/after-c27-60/ACK60.json) fixa a custódia de stack; 45 conserva checks e S0 conserva epic/AM/final. A adaptação registra esse snapshot para revisão e exige reconciliação de drift antes da implementação. Não aguarda fontes para concluir o planejamento, não presume release futura e não toca suas branches.

## 3. Estratégia de migração

### M0 — Base e contratos

Fixar candidato material, versões de schema/client, mapa CAP/rotas, binding Microsoft/mount, matriz de papéis e catálogo de ações. Catalogar a correspondência field/action do DTO com cada produtor e publicar os diffs de apresentação. A documentação atual é a entrada, não permissão para mexer em canonical plan.

### M1 — Casca nativa e piloto vertical

Adicionar os capítulos/roteamento/contexto sem substituir domínios. Pilotar Procurement: fila autorizada, detalhe, review e ação canônica de uma etapa admitida, com dois atores e prova de troca de owner. Manter o fluxo M31 separado e aberto. Somente após o piloto, congelar as composições comuns.

### M2 — Migração por família

Migrar leitura e edição juntas por capacidade ou fluxo coerente. Estado de rollout por instalação e capítulo é configuração de apresentação controlada, nunca grant. Cada capacidade precisa passar seu checklist antes de virar entrada padrão. Enquanto incompleta, o legado pode continuar acessível como fallback explícito e temporário, sem iframe.

Não mostrar novo menu completo como se todos os serviços estivessem prontos. Destino permitido mas ainda indisponível tem estado próprio e explicação; rollout parcial não encerra o epic.

### M3 — Compatibilidade de links e qualificação

Resolver aliases de GET/HEAD legados após autorização. Preferir redirecionamento temporário 307/302 de leitura durante coexistência, preservando seleção sem cache permanente; não redirecionar POSTs de domínio para rotas de página. Downloads/assets/auth permanecem handlers próprios até paridade comprovada.

Comparar fluxos novo/legado com a mesma persistência e versões, sem duas escritas para “sincronizar”. Prova é leitura antes/depois e receipt do produtor, não igualdade apenas de HTML.

### M4 — Nativo como entrada padrão

Depois das jornadas, critérios e gates aplicáveis: novos links apontam aos chapters; links antigos continuam resolvendo. Desativar renderização independente somente em decisão posterior de compatibilidade, com inventário de consumidores e aviso documentado. Não remover endpoints privados usados por agentes/rotinas.

### M5 — Reversão

Reverter a seleção de apresentação/roteamento de uma família, mantendo schema/adapters compatíveis e o mesmo armazenamento. Não rollback de banco ou exclusão de receipts. Drafts não persistidos só podem ser migrados quando a forma, principal e versão são compatíveis; não copiá-los de um perfil para outro.

## 4. Contrato de deep links e compatibilidade

Tabela de tradução por **surface + page/mode + referência + contexto**. Nunca apenas pelo texto do título. As 28 linhas CAP em SCREEN-INVENTORY são a tabela principal de page→route.

| Link existente | Destino / preservação |
| --- | --- |
| `<mount>/dashboard?page=Executive%20Dashboard&year=2026` | `/orchestra/sf-dashboard/executive`, mesmo ano permitido e instalação resolvida |
| Dashboard `page=Vendor Contracts` + record | `sf-procurement/contracts/:ref`, retendo autoridade Dashboard |
| Dashboard `page=All Projects` / `Portfolio Dashboard` | `sf-portfolio/projects` / `overview`, mesma coleção/ID e filtros |
| Planner `page=OPEX`, ano/versão/período | `sf-planner/opex`, versão e competência preservadas; jamais selecionar outra oficial automaticamente |
| Procurement `page=Requests` ou My approvals, request/supplier selection | `sf-procurement/requests/:ref` ou approvals, mesmo recorte/holder atual |
| `sf=workbench-case&caseRef=...&returnTo=...` | `sf-decisions/:caseRef`; returnTo só de rota/source admitida |
| `sf=workbench-work`, selectionRef/start/end | `sf-work`; seleção revalidada; inválida mostra recuperação sem mudar período |
| `sf=bi`, viewId/selectionRef/start/end/baseRef/candidateRef/currency | `sf-bi/:viewId`; preservar seleção e compatibilidade |
| `sf=review`, reviewRef/previousReviewRef/sectionId | `sf-reviews/reviews/:reviewRef` / compare; seleção de seção/cutoff exata |
| reviewThread/reviewMessage/reviewIncarnation/reviewVersion | Abrir o contexto correto da revisão/thread; validar todas as referências antes de focar a mensagem |
| `sf=imports&importPreviewRef=...` / manifestId/version | `sf-imports/:manifestId/preview` após resolver ref privada; mesma versão-base |
| `sf=document-*` e documentRef/evidenceRef | `sf-documents/:ref`, estado de extração/confirmação e fonte atuais |
| runRef / scheduleRef / memory selection | `sf-routines` ou `sf-memory`, sem fabricar referência substituta |
| `download=json/xlsx/suppliers/register/po/docx/pptx` | Continuar download autorizado; novo link reflete seleção e revalida acesso; não converter em página vazia |
| upload/asset/asset-link e recordVersion | Handler privado vigente, origem/versão/scanner atuais |
| `<mount>/auth/*` | Mantém Microsoft49; bridge native-return especificada em API-AND-ISOLATION |
| notificações/backups locais | Mantém perfil local operator; sem extensão implícita ao Microsoft/cloud |

Aliases devem rejeitar parâmetros duplicados, caminhos/IDs inválidos e destinos externos. Caracteres/encoding de references precisam roundtrip literal. O redirect de leitura não confirma aprovação, não executa análise, não faz upload nem aplica import.

URL antiga desconhecida recebe estado explícito com busca/retorno seguros; não cair em Dashboard e perder a intenção. Link para objeto removido ou acesso perdido não revela nome/contagem. Navegação pelo histórico volta ao filtro/scroll original quando ainda permitido.

## 5. Dados, comportamento e trabalho em andamento

- Mesma persistência, namespaces, instalação e IDs; sem migração destrutiva ou second store SF.
- Mesmos C08/C12 receipts, choice fences, policy/access revisions, source lifecycle e materialidade C06/C13.
- Views agregadas não recebem campos que o renderer antigo escondia depois: redaction é anterior ao wire.
- Valores financeiros/cenários vêm das portas atuais; UI não recontabiliza para “corrigir” divergência.
- Manter formatos de export/import e flags específicas do produtor. Não fundir backup-import administrativo e import financeiro com impacto.
- Atualizações de agentes atuais são recebidas por refs e receipts; a UI não altera o contrato do servidor MCP privado nem move skills/profiles.
- Cinco perfis, dezoito skills, oito packs/39 operações, Atlas e AMs continuam requeridos. A navegação de negócio mostra contribuições no contexto; a configuração permanece em módulos técnicos autorizados.
- Reconciliar preimage/postimage de qualquer patch compartilhado, especialmente installation, host-context, application e transport. Patch conflitante volta ao dono; não sobrescrever arquivo inteiro.
- Quando um produtor muda após freeze, renovar contrato/closure/consumer ACK e os gates afetados. Nenhuma equipe pode editar arquivo de outra por urgência.

## 6. Critério de retirada do legado

Paridade de todas as capacidades e fluxos; aliases e downloads aprovados; todos os papéis/contextos e estados adversos; compatibilidade de dados/IDs/receipts; acessibilidade; validação visual nos temas; trabalho dos agentes preservado; gates completos do candidato e aceitação final conforme canônico.

A retirada não é automática ao merge da futura UI. Esta PR só solicita revisão do plano.
