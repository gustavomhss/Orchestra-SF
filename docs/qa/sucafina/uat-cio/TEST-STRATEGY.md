# Estratégia de homologação por risco, estados e transições

## Princípio

O objetivo não é “todas as páginas abriram”, mas provar que **cada pessoa consegue executar seu trabalho e que a pessoa errada não consegue**. A unidade de verdade é o efeito no produtor original, lido de volta, vinculado a tenant, principal, owner, revisão e recibo. A unidade de risco é a transição: os melhores casos negativos interrompem entre preview/review/apply, entre troca de papel e acesso, entre gravação e entrega da resposta e entre geração e download.

## Quatro evidências independentes

- **D (contrato):** manifesto, oráculo J01–J08, catálogo de 305 operações e semântica do produtor.
- **I (implementação):** rota/UI, operation registry, codec, host, authorization, producer e persistência. `registry` sozinho não certifica a porta.
- **T (teste):** asserção real no source; não contar um `spec.ts` como sucesso.
- **E (execução):** SHA, run/instalação/ator/dados/versão/resultado e artefato preservado. Só E pode fechar story.

## Matriz de dimensões (executar por partições, sem explosão cartesiana cega)

| Dimensão | Partições representativas e riscos |
| --- | --- |
| Ator | CIO, Finance, Budget Owner, HR, Leader, Requester, Buyer, Holder, Supplier Admin, Ops, auditor, viewer, Zico/sem grupo, supreme, local operator |
| Contexto | Tenant recurso correto vs outro; instalação A vs B; projeto / owner; versão official locked, draft, what-if; moeda USD/EUR/BRL; competência set/nov/dez |
| Estado de UI | populated, empty, loading, partial, unavailable, denied, expired session, stale, conflicting, failed worker, unavailable producer |
| Estado de domínio | draft, prepared, previewed, submitted, pending, approved, rejected, applied, cancelled, revoked, archived, historical snapshot |
| Dado | 0, null, missing, negative, enorme, UTF-8, homônimo, duplicata, ID opaco inválido, valor no limite, FX ausente, source stale |
| Conectividade | normal, erro antes de commit, erro após commit, response-lost, timeout, retry duplicado, restart, rollback, key vault/Graph down |
| Dispositivo/UX | 320/768/1440 px, zoom 200/400%, dark/light, teclado, reduced motion, texto 3k chars, browser session fresh/stale |
| Segurança | 401, 403, 409, 422, 503, CSRF, origin fence, OIDC nonce/state, replay, revoked grant, export/download after revoke, cross-tenant |
| Consistência | source vs BI vs review vs DOCX/PPTX; after mutation vs before; idempotency receipt; official vs what-if; item vs subtotal |

**Combinatória:** para cada P0, cobrir happy + deny + stale + duplicate + lost response sempre que a operação alterar estado; para P1, aplicar análise de fronteiras e pairwise por domínios correlatos. Testar 3-way em `actor × revision × lost delivery` nas transições críticas. O universo de estados é indefinido; **não** prometer prova de todas as permutações possíveis.

## Acionamentos e gates

**G0 Reconhecimento:** SHA congelado, 70 superfícies/165 rotas reconciliadas, 305 do catálogo vs 306 no registry: a diferença `intelligence.memory-similar-cases` é extensão rastreada; `projection.search` GET planejado x POST instalado por privacidade. Não converter POST privado a GET para “igualar planilha”. Contratos dos seis produtores históricos devem ser reconciliados semanticamente com o SHA de execução.

**G1 Fonte e produto:** 12 jobs sf-ci verdes no candidato C, testes de sistema, browser, contracts, packaging/Omni com recibo de SHA e arquivo extraído fora checkout. A sequência dos testes deve bloquear executáveis sem manifest/codec e side effects sem owner fence.

**G2 Operação instalada:** autenticar 2+ contas com roles reais de Entra; executar 185 histórias (e variantes), recording one evidence record per case. `E` exige gravação admitida ou prova de negação, e não print da tela só.

**G3 Integridade e segurança:** contraste de atores e políticas, import, stages procurement, scopes, CAS, documento candidato, BI, relatórios, rotina/agent, backup e rollback. Mutação de um domínio por outro sem autorização é bloqueador P0.

**G4 Release:** revisão de owner (CIO), auditor/QA lead e responsável de identidade; exceptions assinadas; testes de features condicionalmente promovidas; operação real de VM sob runbook, sem output de segredo nos anexos.

## Cobertura por feature e risco

- **Superfície:** 140 histórias distribuídas 70 principais e 70 adversariais; 45 multiator. Uma story pode tocar várias áreas, mas cada superfície tem `P01` e `N01` próprios.
- **Rota:** 165 linhas mais 825 probes positivos/negativos/contextuais com `route_kind`, `pattern`, `canonical_story`, `adversarial_story`. Cada uma exige cinco provas: ref autorizada, ator não permitido, parâmetro malformado, revogação e mudança de owner/instalação; status HTTP exato deve seguir contrato (não inventar 403 para todo caso). A matriz original aponta registro, não garante host instalado.
- **Operação:** 305 IDs de catálogo/306 de registry no snapshot original; revalidar para o novo SHA. Usar contraprovas 401/403/409/422, idempotency/non-GET e POST de search. Não declarar cobertura de operations apenas com 70 telas.
- **Jornada:** J01 contribuidor / J02 forecast / J03 import / J04 procurement / J05 revisão / J06 acompanhamento / J07 rotinas / J08 UX/segurança. Oito oráculos originais são baseline; epics complementam, não substituem.
- **Novas superfícies:** Supreme Admin `/sucafina/admin/access` **não aumenta o 70 do manifesto**; incluir no gate quando integrado. A camada de marca Sucafina da Orchestra Sucafina Edition não substitui os temas do Orchestra nem altera o domínio. Flamengo é dado sintético, não permission source.

## Aulas do review adversarial

Os 11 achados QA-01..11 do review corrigiram atlas HTML e índice, revelaram teste dedicado faltante de `CAP24`, divergências de source digests e operação, e risco de atribuir sucesso a SHA errado. CAP24 recebe E2E dedicado e relatório de cobertura, a comparação dos seis produtores vira pré-condição. O build da própria matriz não equivale a E2E do produto; aceitar qualquer status que venha de `early-stop` como PASS é falso positivo. RPT timeout, import 403/422, decision 503 e app-browser RED antigos exigem reprodução no C atual antes de liberar.
