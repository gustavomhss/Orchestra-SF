# Revisão adversarial técnica — rodada 2

## Veredicto

**REQUIRES_CHANGES** no commit **`38986380cd7b5697c0be30c1f55d43eddee63045`**. Há **um novo P1, T2-F01**, e nenhum P0 ou P2 novo. O caminho de empacotamento Atlas congelado exige um novo bundle com `node:child_process`, mas o guard vigente admite esse import somente em caminhos exatos que não incluem o arquivo planejado.

As lacunas originais **T-F01, T-F02 e T-F03 estão CLOSED como lacunas de contrato, divisão de responsabilidade e prova**. O plano agora descreve os mecanismos e os testes discriminantes que faltavam. Esse fechamento não aceita a implementação e não torna Atlas integrado: o defeito novo de empacotamento bloqueia essa entrega e é contado uma única vez.

| Campo | Valor |
| --- | --- |
| Review ID | SF2H-R2-T |
| Revisor | Técnico independente, sem autoria |
| Repositório / branch | gustavomhss/Orchestra-SF / sf-product-plan |
| Candidato | `38986380cd7b5697c0be30c1f55d43eddee63045` |
| Baseline primária | `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf` |
| Parecer | **REQUIRES_CHANGES** |
| Achados novos | P0: 0 · P1: 1 · P2: 0 |
| Testes de implementação | **NOT_RUN** |

## Método e limites

Leitura da cópia congelada sf2h-candidate-3898638. O recibo sf2h-work/candidate-3898638.json fornecido pelo integrador registra 98 blobs coincidentes com GitHub, SHA1 de blob conferido, candidato e subtree fixados. Esta revisão não repetiu o cálculo de todos os blobs.

Leituras remotas exclusivamente por GitHub MCP fetch_file no SHA de baseline. Os índices resident_source_evidence foram usados apenas para localizar fontes; as APIs e o bloqueio foram examinados no próprio código.

Contratos C01–C17 completos, especificação resident-runtime completa, manifesto completo (5 perfis/18 skills/8 packs/39 operações), seis provas integradas, tarefas relevantes completas de WP10.T01/T06/T07, WP12.T01–T04, WP06.T05, WP14.T02/T04/T05 e WP09.T01/T07. Campaign, ownership, receitas e arquivos grandes de runtime foram examinados nos símbolos e bordas pertinentes; a lista de paths não afirma leitura integral de todos esses arquivos.

Contagens/IDs e relações de concessão inspecionados por jq; campaign.contracts coincide integralmente com contracts.json e campaign.resident_ai com agents-atlas-mcp.json. Não foi executado o validador de produto, build, scanner, guard ou teste de runtime.

Sem autoria, edição de candidato, acesso aos pareceres dos demais revisores, implementação ou testes locais. O relatório técnico da rodada 1 foi usado para definir objeções, não como evidência de fechamento. Intenção de corrigir depois do congelamento não altera este parecer.

Os [protocolos geral](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/formal-review/PROTOCOL.md) e [da rodada 2](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/formal-review/round-2/PROTOCOL.md) exigem refutar o planejamento com contraexemplo concreto. Por isso, nenhum achado foi aberto apenas porque código, hashes finais ou provas ainda não existem. O P1 abaixo decorre de obrigações simultâneas já fixadas pelo plano e pelas regras da baseline.

## Achados originais

| Achado | Estado | Fundamento do fechamento |
| --- | --- | --- |
| T-F01 — perfis/skills/carga/execução | **CLOSED** | C15, manifesto e tarefas ligam fontes distribuídas, conteúdo carregado, execução nativa, outputs e consumo; Revisor tem Session/run próprios. |
| T-F02 — identidade e percurso MCP | **CLOSED** | C16 escolhe wrapper nativo + binding do host + lease opaco + par SDK privado por chamada e destino de domínio comum. |
| T-F03 — adaptação e persistência Atlas | **CLOSED** | C17 especifica referências, templates/owners, autorização prévia, adapter síncrono, commit externo e owners separados. O problema novo do bundle está em T2-F01. |

### T-F01 — CLOSED

Fechada a lacuna de especificação/atribuição/prova. A implementação dos perfis e das skills continua NOT_RUN.

C15 e o manifesto ligam perfil, fonte distribuída, versão, sourceDigest, instructionsDigest, registro, carga observada, execução, output persistido e consumidor. O catálogo não basta; WP10.T06 e WP12 têm obrigações concretas. Revisor exige Session nova, run próprio, instruções próprias, targetRunId/targetOutputDigest e proibição de fork/mesma execução.

**Evidência examinada:**

- [modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json) — **C15, linhas 436–513**. Contrato define perfil/skill/load/run, permissões, execução do Revisor e exports com tasks donas.
- [modules/sucafina/Sucafinav1/docs/sf2h-plan/agents-atlas-mcp.json](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/agents-atlas-mcp.json) — **profiles, skills, skill_bundle_policy e integrated_proofs.AM01**. Cinco perfis e 18 fontes de skills identificadas; fonte distribuída e corpo carregado têm digests distintos; receipts e consumidor real após reload são obrigatórios.
- [modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json) — **WP10.T06**. Registro por AgentV2.transform após configuração, DirectorySource reservado e SessionV2.skill antes de prompt, com comprovação da mensagem/instructionsDigest.
- [packages/core/src/agent.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/agent.ts) — **Draft.update, transform e withPermissions**. Registro aditivo e regras de permissão existem; a ausência de um Agent é deny. Não requer editar engine.
- [packages/core/src/skill.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/skill.ts) — **DirectorySource, Draft.source, get/load**. Fonte directory reservada e leitura do conteúdo parseado são públicas; Agent.Info.skills sozinho é apenas catálogo.
- [packages/core/src/session.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/session.ts) — **Interface; create; skill; messages/context**. SessionV2.skill aceita resume:false; mensagens/contexto permitem confirmar o corpo antes do prompt. Nova Session pode ser criada, sem usar fork; reusar ID adotaria a existente.
- [packages/core/package.json](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/package.json) — **exports ./agent, ./skill, ./session, ./host, ./tool/tool, ./tool/tools**. Os caminhos de imports públicos necessários existem na baseline.

**Obrigação ainda não executada:** AM01/AM06 têm de demonstrar as 18 cargas/saídas/consumidores e os cinco perfis em implementação real; não há aceite antecipado.

### T-F02 — CLOSED

Fechada a ausência de uma sequência segura e implementável de transporte de identidade. A segurança executada permanece NOT_RUN.

C16 escolhe um caminho diferente do servidor provided compartilhado: wrapper de ferramenta nativa lê o Tool.Context, localiza binding confiável do host e emite CallLease opaco de uso único. Server/Client/InMemoryTransport são privados por chamada e seus handlers capturam a autoridade. A resolução por nome não concede identidade; homônimo/configuração/generation conflitante é recusa. dispatchSfCapability liga UI/native/MCP ao mesmo destino, que reautentica e revalida roles/locks/versão.

**Evidência examinada:**

- [modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json) — **C16, linhas 515–609**. Contexto confiável, CallLease, lifecycle por chamada, expiry/inputDigest/generation, dispatch único, recusa de homônimo e revalidação são normativos.
- [modules/sucafina/Sucafinav1/docs/sf2h-plan/specs/resident-runtime.md](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/specs/resident-runtime.md) — **seção 3**. Origem do Request no host, metadados fora dos argumentos, sequência SDK privada e limites da autorização documentados; não pressupõe que McpProvided transmita o principal.
- [modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json) — **WP10.T06**. Produtores, outputs/paths, qualificação nativa e negativos de isolamento têm responsável.
- [packages/core/src/tool/tool.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/tool/tool.ts) — **Context, linhas 11–18; Tool.make**. sessionID/agent/assistantMessageID/toolCallID são contexto nativo disponível para o wrapper, distinto do input do modelo.
- [modules/app-dock/src/dock-mcp.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/app-dock/src/dock-mcp.ts) — **serve, linhas 78–101**. O repositório já compõe SDK Server, InMemoryTransport.createLinkedPair, ListTools e CallTool por closures; a API proposta existe.
- [packages/core/src/mcp.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/core/src/mcp.ts) — **configured, linhas 174–201; mcpTool, linhas 277–313; config, linhas 516–523**. O provided por nome não recebe ator SF e config local/remote tem precedência. C16 evita essa rota e usa config somente para recusar colisão.
- [modules/sucafina/Sucafinav1/runtime/application.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/runtime/application.ts) — **Application.authenticate, linhas 22–26; transação, linhas 68–95**. A autenticação com Request e roleMap do snapshot atual é uma seam real já usada dentro da transação.

**Obrigação ainda não executada:** AM02/AM03 ainda devem provar as 39 operações, chamadas diretas, dois atores/sessões, input adulterado, lease replay/expiry, revogação e homônimo. Não inferir segurança da presença de tipos.

### T-F03 — CLOSED

Fechada a lacuna original de tradução/ACL/persistência/ownership/prova; o novo defeito de empacotamento é registrado uma única vez em T2-F01 e bloqueia a entrega integrada.

C17 especifica BusinessEvidenceRef discriminado, string Ref resolvida no catálogo privado SF, shapes task/project sem chaves extras, MemberId empresarial derivado e principal separado. BCS autoriza todas as dependências antes de criar o store filtrado de createMemoryRead. DurableMemory é síncrono sobre staging de snapshot; transação SF externa é a fronteira durável e serializa gates, idempotência e ack do outbox. WP14 continua puro, WP06 resolve documentos e WP10 detém BCS/store/scanner. AM05 exige módulo real e reinício, não só ledger.

**Evidência examinada:**

- [modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json) — **C17, linhas 611–796; allowed_template_mappings; transaction_sequence**. Tradutores e divisão de owners, campos, autorização, armazenamento, scanner e prova estão explicitados.
- [modules/sucafina/Sucafinav1/docs/sf2h-plan/specs/resident-runtime.md](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/specs/resident-runtime.md) — **seções 4 e 5**. Recorte antes do Atlas, validação de referência, adapter síncrono/commit externo e separação Atlas versus RAG estão descritos.
- [modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json) — **WP10.T01 e WP10.T07**. Namespace protegido __sfProductV1.atlas, BCS, store/scan e integração recebem outputs/checks; persistência não é atribuída a WP14.
- [modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP14.json](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP14.json) — **WP14.T02/T04/T05**. Mapeamento/owner/explanation e ranking puros são consumidores/produtores explícitos.
- [modules/atlas/packages/memory/src/types.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/memory/src/types.ts) — **MemberId, Ref e MemoryEntry**. MemberId é string, Ref admite string, templates task/project são compatíveis com o mapeamento declarado; não precisam de identidades de engenharia fictícias.
- [modules/atlas/packages/adapter-io/src/memory-read.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/memory-read.ts) — **createMemoryRead.recall**. O actor não filtra recall automaticamente. O plano agora filtra a facade por ACL antes e sempre fornece owner derivado.
- [modules/atlas/packages/adapter-io/src/memory-store.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/memory-store.ts) — **DurableMemory**. read/append são síncronos; a facade snapshot-local declarada respeita essa interface.
- [modules/sucafina/Sucafinav1/runtime/contract.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/sucafina/Sucafinav1/runtime/contract.ts) — **Persistence.transaction**. Callback assíncrono, serialização e commit durável são seam real para a transação externa planejada.

**Obrigação ainda não executada:** T2-F01 precisa de correção no plano; em seguida AM05 ainda deve provar pacote público importável, scanner real, commit/restart e ACL/revogação.

## Novo achado

### T2-F01 · P1 — Novo bundle Atlas incompatível com o guard de spawning

**Bloqueia execução integral:** sim. **Confiança:** alta. **Dono sugerido:** S0/WP00 para reconciliar contrato/ownership; WP10.T07 para empacotamento, com o owner da boundary Atlas.

#### Requisito e localização

C17 e WP10.T07 exigem scanner Atlas real distribuído pela boundary canônica, sem edição de engines ou guards; AGENTS Spawning Processes admite exceções apenas nos caminhos exatos de script/spawn-allowlist.json. A entrega tem de ser executável sob ambas as restrições.

contracts.json:C17.exports/content; campaign.json:resident_packaging (linhas 27744–27769); specs/resident-runtime.md:§4.4; work-packages/WP10.json:WP10.T07 (linhas 1250–1391); ownership.json:seis exceções Atlas e technical_allocations (linhas 344–409).

#### Cadeia de evidência primária

1. [modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json) — **C17.exports, linhas 775–793; scanner em content**. A entry nova deve reexportar detectAvailableScanner/runScanner/NO_SCANNER_NAME e ser consumida como @orchestra/atlas-boundary/business-memory-ports.
2. [modules/sucafina/Sucafinav1/docs/sf2h-plan/campaign.json](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/campaign.json) — **resident_packaging, linhas 27744–27769**. Exige especificamente src/generated/business-memory-ports.js e .d.ts via build.ts, preservando plugin canonical-atlas-build-boundary e geração determinística.
3. [modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json) — **WP10.T07.work/outputs; INV de seis paths, linha 1367**. Entrega pública nova é obrigatória; nenhum algoritmo/template/owner guard Atlas é editado e escrita Atlas fica nos seis paths exatos.
4. [modules/sucafina/Sucafinav1/docs/sf2h-plan/ownership.json](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/ownership.json) — **exact exceptions; resolution_order; technical_allocations, linhas 344–409**. São concedidos package.json/build.ts/entry nova/JS/d.ts/test. Ausência implica readonly; a razão da alocação proíbe explicitamente engines/identity/guard edits.
5. [modules/atlas/packages/adapter-io/src/scanner.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/scanner.ts) — **linha 31; execBounded, linhas 124–134; detectAvailableScanner/runScanner, linhas 139–193**. O scanner real importa execFileSync de node:child_process e executa-o. Reexportar runScanner preserva essa dependência de runtime.
6. [modules/atlas/boundary/script/build.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/boundary/script/build.ts) — **linhas 29–60 e 67–81**. Bun.build empacota entry com target node, resolução interna @atlas e saídas JS/d.ts canônicas; node:child_process fica como import nativo no bundle.
7. [modules/atlas/boundary/src/generated/native-memory.js](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/boundary/src/generated/native-memory.js) — **import minificado de node:child_process, offset de caractere 22942**. Artefato existente do mesmo gerador contém import{execFileSync}from"node:child_process" e o scanner. É confirmação no código já gerado, não resultado de build executado nesta revisão.
8. [script/check-spawn-imports.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/script/check-spawn-imports.ts) — **linhas 12–14,22–23,35–52**. O gate cobre TS/JS rastreados e não ignorados, sem exceção para generated; allowed[file] é consulta de caminho exato.
9. [packages/script/src/spawn-imports.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/script/src/spawn-imports.ts) — **MODULES e SPECIFIER, linhas 5–23**. node:child_process mapeia para child_process e o import minificado continua sendo detectado.
10. [script/spawn-allowlist.json](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/script/spawn-allowlist.json) — **comentário linha 2; entradas Atlas linhas 23,29–32**. Scanner fonte e native-header.js/native-memory.js/surface.js/mine.js são admitidos nominalmente; business-memory-ports.js não é uma entrada admitida.
11. [AGENTS.md](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/AGENTS.md) — **Spawning Processes, linhas 168–173**. Novos sites fora da lista falham no check:spawn-imports; adição de exceção requer decisão do lead.

O fato de o scanner original estar admitido não transfere a exceção ao arquivo gerado que contém seu código. A lookup é `allowed[file]`, com o nome completo do arquivo. O guard também examina `.js` em `src/generated`; sua exclusão cobre testes/fixtures e `native/omni`, não todos os gerados.

#### Contraexemplo

1. WP10.T07 cumpre literalmente o plano: cria a entry export-only, inclui os scanners reais, adiciona o descritor no gerador e entrega generated/business-memory-ports.js.
2. O export de runScanner mantém execFileSync no grafo. O build canônico target node produz um import node:child_process no novo JS; a baseline native-memory.js evidencia esse resultado para o mesmo scanner/gerador.
3. Quando o gate existente examina o arquivo rastreado, SOURCE inclui .js, SKIPPED não inclui generated e allowed['modules/atlas/boundary/src/generated/business-memory-ports.js'] não existe. O hit child_process é rejeitado.
4. Adicionar o novo caminho à allowlist ou excluir generated ampliaria a regra fora do ownership e das restrições; retirar/trocar o scanner para fazer o bundle passar viola C17/AM05. O caminho especificado não satisfaz simultaneamente os contratos vigentes.

O diagnóstico previsto pela expressão do guard é:

```text
modules/atlas/boundary/src/generated/business-memory-ports.js: child_process outside the spawn allow-list; spawn through ChildProcessSpawner or Process
```

**Esse diagnóstico não foi executado nesta revisão.** Ele é a consequência estática das regras consultadas. O artefato `native-memory.js` da baseline fornece uma testemunha já publicada do formato do import do scanner sob o mesmo gerador.

#### Consequência

A implementação fiel ao caminho congelado não pode concluir o gate de spawning. O marco ATLAS-PACKAGE e AM05 ficam bloqueados, ainda que typecheck/generate/check:generated passem. Não é simples detalhe futuro: o plano já fixa nome do artefato, grafo do scanner, processo de build e limites de escrita contraditórios.

Não há alegação de que Atlas seja irrecuperável ou de que qualquer adaptação empresarial seja impossível. A incompatibilidade está na rota específica imposta pelo candidato: novo nome de saída, scanner real mantido, gerador preservado e nenhum direito de alterar a regra que rejeita o resultado.

#### Correção verificável

1. Reconciliar a exportação pública e o empacotamento para um caminho compatível com a fronteira de spawning já admitida; uma composição aditiva em artefato existente é uma opção a qualificar, preservando seus consumidores e seus contratos. Não abrir allowlist/exclusão de guard, criar scanner substituto ou modificar engine como atalho.
2. Atualizar C17, resident_packaging, ownership exato, outputs/consumers de WP10.T07 e AM05/receitas para a mesma solução concreta. Se houver entry export-only existente a editar, atribuir essa alteração de empacotamento explicitamente.
3. No candidato implementado, gerar JS/d.ts pelo gerador canônico, confirmar import pelo pacote SF, ausência de drift, tipos e check:spawn-imports sem mudanças à regra; os testes de repositório devem seguir GitHub Actions conforme AGENTS.
4. Manter a prova AM05 de scanner clean/hit/ausente/timeout e consumo real createMemoryEmit/createMemoryRead/DurableMemory com restart. Fechamento exige novo SHA revisado; intenção de correção não fecha o achado.

Qualquer correção posterior exige um novo candidato e rechecagem. Uma mensagem de intenção, um alias de nome ou uma atualização de status não alteram o resultado para este SHA.

## Manifesto e provas integradas

### Cobertura estática conferida

| Elemento | Resultado da leitura estática |
| --- | --- |
| Perfis | 5 |
| Skills | 18 |
| Packs | 8 |
| Operações | 39 IDs distintos |
| Operações de skill concedidas nos perfis permitidos | Nenhuma lacuna encontrada |
| Concessões de perfil consistentes com perfis da operação | Nenhuma lacuna encontrada |
| campaign.contracts versus contracts.json | Iguais |
| campaign.resident_ai versus agents-atlas-mcp.json | Iguais |

- Cada skill tem input/output, source path, versão, digests a materializar no build, allowed_profiles/operations, produtor, persistência e consumidor. Ausência dos bytes finais agora é esperada no planejamento; recebimento exige digest real.
- Os 18 registros de consumo exigem outputRef/schemaVersion/provenance e ação observada no consumidor após reload. IDs no catálogo e consumerRef jamais aberto são explicitamente insuficientes.
- Os packs somam Performance 4, Planning 5, Procurement 4, Decisions 5, Collaboration 5, Documents/Reports 5, Knowledge 5 e Routines 6.
- Contagens e igualdade dos espelhos não equivalem a execução das capacidades.

A conferência usa os objetos completos de [agents-atlas-mcp.json](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/agents-atlas-mcp.json), os contratos e a [matriz de consumo](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/resident-ui-consumption.json). A distribuição das operações é Performance 4, Planning 5, Procurement 4, Decisions 5, Collaboration 5, Documents/Reports 5, Knowledge 5 e Routines 6.

### Discriminantes exigidos

| Prova | Avaliação do planejamento |
| --- | --- |
| AM01 | Requer cinco contribuições e 18 witnesses de source/load/run/output/consumer; reviewer usa Session/run próprios. Os cinco cenários de perfil cobrem 18 skills distintas. Ainda não executado. |
| AM02 | Tabela de 39 operações em oito packs exige mesmos handlers/versões entre UI/native/MCP, operação concedida e chamada direta negada. Ainda não executado. |
| AM03 | Inclui atores concorrentes no mesmo perfil, sessões trocadas, argumentos/leases forjados, replay/expiry/generation, homônimo e revogação. Há mecanismo público compatível no plano. Ainda não executado. |
| AM04 | PreparedChangeSet, idempotência por domínio, resposta perdida e aplicação parcial têm contraprovas; scanner/Atlas não ganha autoridade de mutação de negócio. Ainda não executado. |
| AM05 | Exige módulo Atlas real instrumentado, persistência/commit/restart, owner omitido/forjado, ACL por campo/registro, nova encarnação, scanner real e RAG/documentos. Está bloqueado pelo empacotamento especificado em T2-F01; prova não executada. |
| AM06 | Receita nativa publicada/admitida retorna output versionado; pergunta encerra run e resposta humana cria nova versão/execução. WP09.T01/T07 não prometem wait humano inexistente ou autoaprovação. Ainda não executado. |

Esses critérios constam do [resident-proof-plan.json](https://github.com/gustavomhss/Orchestra-SF/blob/38986380cd7b5697c0be30c1f55d43eddee63045/modules/sucafina/Sucafinav1/docs/sf2h-plan/resident-proof-plan.json) e das provas do manifesto. Todos continuam **NOT_RUN**. AM01 deve observar as 18 skills, não apenas encontrar seus nomes; AM02 deve atingir os 39 handlers de destino; AM05 deve observar os módulos reais e a persistência após reinício.

## Avaliação das fronteiras técnicas

### Registro, carga e retomada

O contrato diferencia `sourceDigest` dos bytes de `SKILL.md` e `instructionsDigest` do conteúdo parseado que `SkillV2.get` realmente entrega. O gate de carga exige `SessionV2.skill({resume:false})` e a mensagem/contexto correspondente antes do prompt. Isso é compatível com as APIs públicas verificadas. A exigência de assets distribuídos, em vez de conhecimento mantido somente em documentação, acompanha [AGENTS.md, What Ships](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/AGENTS.md). A decisão de como materializar os arquivos durante o build permanece trabalho de implementação legítimo, sujeito à prova de shipping.

O Revisor exige Session nova, instruções e execução próprias, vinculadas à execução revisada. A API `SessionV2.create` permite isso; reusar o mesmo ID adotaria a Session existente e não satisfaria o contrato. Mesma família de modelo não equivale a mesma execução. Após restart, o plano exige reautenticação e rebinding, em vez de reviver credenciais serializadas.

### Transporte e autorização

As interfaces de core não enviam automaticamente o principal SF em `client.callTool`; `McpProvided` é compartilhado e resolvido por nome. A sequência nova não depende dessa suposição. O contexto vem da invocação nativa, os argumentos do modelo contêm seletores e o par privado captura o lease. O destino reautentica usando o `Request` retido no host e o `roleMap` atual, como a aplicação SF já faz. As fontes primárias e os caminhos exatos estão nas evidências de T-F02.

Isso torna o plano implementável sem ampliar identidade ou modificar engine. A correção do mecanismo só será comprovada pelos negativos: chamadas diretas, troca de sessão/principal, inputDigest diferente, lease expirado/repetido, geração alterada, homônimo e revogação durante a execução. Permissão de catálogo não substitui a autorização final do domínio.

### Referências, memória, transação e scanner

C17 usa `sf-evidence:v1:<refId>:<digest>` como string `Ref`, mantendo o objeto empresarial fora dos templates Atlas. Os seis tipos de referência têm versão/incarnação/digest e dependências explícitas. Owners são partições derivadas de instalação/projeto/caso ou política, e não principais. Essa distinção corresponde a `MemberId = string` e ao fato de `createMemoryRead.recall` não impor ACL por actor.

O serviço autoriza registros, campos e todas as dependências antes de entregar uma facade filtrada ao Atlas; depois seleciona explicitamente kind e owner. A facade de `DurableMemory` é síncrona sobre snapshot hidratado. O callback assíncrono externo pode executar os gates síncronos e registrar o staging; somente `await Persistence.transaction` confirmado permite recibo `committed`. O ledger é oficial e o outbox preserva `pending/refused` se a projeção não puder ser emitida. Essa sequência resolve o conflito de assinaturas original, embora rollback, concorrência e revogação ainda dependam das provas reais.

O scanner real separa `clean`, `hit` e `could-not-run`. C17 mapeia o terceiro para indisponibilidade, evitando que ausência/timeout seja descrito como um segredo encontrado ou como conteúdo limpo. A disponibilização desse código pela nova saída, contudo, é exatamente o bloqueio T2-F01.

### Documentos e RAG

O package público [RAG Studio](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/rag-studio/src/index.ts) disponibiliza parse/search/revision/proof. Seu [contexto por AsyncLocalStorage](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/rag-studio/src/context.ts) permite um store autorizado por chamada. A [busca real](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/rag-studio/src/search.ts) é lexical e não substitui ACL empresarial; a facade SF precisa filtrar antes e revalidar o resultado.

A [extração](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/rag-studio/src/extract.ts) trata PDF/texto, enquanto DOCX exige normalização própria. WP06.T05 atribui essa normalização usando JSZip/saxes já presentes no pacote SF, sem prometer capacidade inexistente no RAG Studio. C17 distingue SHA256 de bytes/trecho de evidência e BLAKE3 do índice RAG; offsets UTF-16 e revisão precisam ser preservados. Esses caminhos são viáveis no planejamento e permanecem por provar.

## Incertezas residuais

- Revisão estática de plano e código primário. Nenhum build, guard, scanner, teste de produto, prova nativa ou migração foi executado.
- Fechar T-F01/T-F02/T-F03 significa que as lacunas originais de contrato/prova foram reconciliadas; não significa que agentes, MCP ou Atlas foram implementados ou aprovados.
- T2-F01 precisa de uma solução de empacotamento concreta em novo candidato. Nenhuma alteração posterior ou intenção do integrador integra a evidência deste SHA.
- Os bytes finais de skills, digests e assets distribuídos, as permissões efetivas após configuração e a continuidade/revalidação precisam das provas GNATIVE/AM01/AM03 no produto.
- Disponibilidade de modelo, identidade revalidável, scanner real, armazenamento e Relay/Schedule continua sujeita ao ambiente e gates previstos. HOLD por indisponibilidade não vira PASS.
- Idempotência, isolamento concorrente, rollback/cancelamento, ACL por campo/registro, caches e corte de resultados revogados exigem execução real das contraprovas. Os contratos não fornecem garantia experimental.
- Esta especialidade não certifica orçamento de 120 minutos, grafo de escritores ou completude de produto; esses temas possuem revisões independentes.

## Caminhos examinados

A lista distingue artefatos do candidato e fontes da baseline. Leitura completa ou seletiva conforme o método acima. Consultas que retornaram arquivo inexistente não são apresentadas como evidência de comportamento.

### Candidato

- `modules/sucafina/Sucafinav1/docs/sf2h-plan/formal-review/round-2/PROTOCOL.md`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/formal-review/PROTOCOL.md`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/formal-review/round-1/contracts.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/formal-review/round-1/contracts.md`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/specs/resident-runtime.md`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/AGENTS-ATLAS-MCP.md`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/agents-atlas-mcp.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/resident-proof-plan.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/resident-ui-consumption.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/campaign.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/ownership.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/ci-recipes.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP00.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP06.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP09.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP12.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP14.json`

### Baseline

- `AGENTS.md`
- `package.json`
- `packages/core/package.json`
- `packages/schema/package.json`
- `packages/core/src/agent.ts`
- `packages/core/src/skill.ts`
- `packages/core/src/session.ts`
- `packages/core/src/session/runner/index.ts`
- `packages/core/src/host.ts`
- `packages/core/src/tool/tool.ts`
- `packages/core/src/tool/tools.ts`
- `packages/core/src/permission.ts`
- `packages/core/src/state.ts`
- `packages/core/src/mcp.ts`
- `packages/core/src/mcp/provided.ts`
- `packages/schema/src/agent.ts`
- `packages/schema/src/skill.ts`
- `apps/cli/package.json`
- `apps/cli/src/host.ts`
- `modules/app-dock/src/dock-mcp.ts`
- `modules/maestro/coordination/src/v2/seats.ts`
- `modules/sucafina/package.json`
- `modules/sucafina/Sucafinav1/package.json`
- `modules/sucafina/Sucafinav1/runtime/contract.ts`
- `modules/sucafina/Sucafinav1/runtime/application.ts`
- `modules/sucafina/Sucafinav1/runtime/host.ts`
- `modules/sucafina/Sucafinav1/local/entry.ts`
- `modules/sucafina/Sucafinav1/src/identity.ts`
- `modules/atlas/packages/memory/src/types.ts`
- `modules/atlas/packages/memory/src/template.ts`
- `modules/atlas/packages/memory/src/inject.ts`
- `modules/atlas/packages/memory/src/portable.ts`
- `modules/atlas/packages/memory/src/respawn.ts`
- `modules/atlas/packages/memory/src/index.ts`
- `modules/atlas/packages/adapter-io/src/memory-read.ts`
- `modules/atlas/packages/adapter-io/src/memory-emit.ts`
- `modules/atlas/packages/adapter-io/src/memory-store.ts`
- `modules/atlas/packages/adapter-io/src/scanner.ts`
- `modules/atlas/packages/adapter-io/src/index.ts`
- `modules/atlas/packages/adapter-io/src/native-bound.ts`
- `modules/atlas/boundary/package.json`
- `modules/atlas/boundary/script/build.ts`
- `modules/atlas/boundary/script/tsconfig.json`
- `modules/atlas/boundary/tsconfig.json`
- `modules/atlas/boundary/src/generated/native-memory.js`
- `modules/rag-studio/package.json`
- `modules/rag-studio/src/index.ts`
- `modules/rag-studio/src/context.ts`
- `modules/rag-studio/src/types.ts`
- `modules/rag-studio/src/extract.ts`
- `modules/rag-studio/src/parse.ts`
- `modules/rag-studio/src/search.ts`
- `modules/rag-studio/src/proof.ts`
- `modules/rag-studio/src/revision.ts`
- `script/check-spawn-imports.ts`
- `script/spawn-allowlist.json`
- `packages/script/src/spawn-imports.ts`
- `script/check-module-boundaries.ts`

**implementation_test_status: NOT_RUN**
