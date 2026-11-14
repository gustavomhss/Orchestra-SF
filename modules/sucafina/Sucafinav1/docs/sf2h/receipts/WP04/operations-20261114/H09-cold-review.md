# Revisão independente de H09 — Procurement UI e host real

Revisor: ci_coordination, sem autoria do teste. Revisão estática da fonte, manifest e consumidores; sem execução local de produto e sem despacho de CI.

Pin final examinado: `host-integration.test.ts` blob `a71839833d50fa3da37f18b2c1fca4597032a5b7`, SHA256 `1e3c4025a9cda489246cb4309ca157a0248476f15c7ca31bfc45e872c783581c`, 62.958 bytes. Os oito corpos de teste que antecedem H09 são byte a byte iguais ao baseline anterior a H09, blob `b65dc1e315f88dd535881b1f8a895661e95e485b`; comparação registrada em `H09-cold-review.json`.

## Findings resolvidos durante a revisão

1. O import `expect as browserExpect` infringia a proibição de aliases no AGENTS raiz. O autor o substituiu por import dinâmico local de `expect` dentro de H09, sem mudar os oito testes existentes.
2. O root identificou que a navegação GET não carrega `Idempotency-Key`, mas UiAuthority exige uma identidade de comando na admissão. O autor acrescentou uma opção de fixture `allowCaseNavigation=false`, habilitada apenas em H09. Seu fallback cria identidade somente para GET, operação `sf_case_read` e header ausente. Não altera Request ou headers; POSTs e defaults dos oito testes são preservados. H09 afirma explicitamente que os dois GETs tiveram key nula.

A segunda correção foi conferida contra `ui-authority.ts` W4 blob `502fb1ab3a4116a62aeb504a4bb26040c66d81b2`: `commandIdentity` é chamado em `admit`, e `validate`/`revalidate` conservam a admissão existente. A criação de uma identidade por leitura é compatível com o contrato e com a política de GET do host CLI existente.

## Request, origem e autenticação

O servidor escuta apenas em `127.0.0.1`, porta alocada dinamicamente. Sua origem exata é passada à mesma fixture de authority, HTTP Procurement e aplicação. O contexto Chromium fornece apenas a credencial de fixture `Authorization: Bearer alice`; não injeta key de intenção global.

Para POST, a fixture lê `request.clone().text()` para evidência e chama `current.application(request)` com o objeto original. Não reconstrói o Request, não troca actor, Origin, Sec-Fetch-Site, key ou body. A aplicação real chama `createProcurementDecisionHttp`, que verifica origem, método, query, content-type, shape fechado, admissão humana e contexto do caso antes do produtor. O teste afirma origem e autorização observadas nos dois Applys.

A página GET é uma composição controlada do teste: consulta state com o Request autenticado, admite e valida `sf_case_read`, chama `business.cases.read` e revalida autoridade antes de renderizar. Usa os exports publicados `decisionApplyForms`/`decisionApplyScript`, `htmlPolicy`, `no-store` e `nosniff`. Isso prova esse consumidor composto e não todo o binding CLI/genérico de produção.

## Revisão, Apply e retry

O estado escolhido usado para preparo é uma fixture persistida declarada, com cobertura explicitamente pendente. Não representa inferência nativa ou humana. Preparação, revisão, aplicação, source fences e SQLite são serviços reais.

O browser começa sem permissão de Apply, chama a revisão real e extrai seu `reviewDigest` de 64 hex. As assertions exigem os valores 100 → 150, checkbox inicialmente não marcado e nenhuma aplicação antes da confirmação explícita. O primeiro corpo Apply deve ser exatamente `{caseRef,choiceId,changeId,reviewDigest}` derivado do preparo/revisão; a key nasce no script publicado.

A única resposta sintética é um 503 de entrega após `current.application` retornar HTTP 200 e recibo reais. O teste grava e verifica separadamente esse resultado anterior à perda. Portanto a simulação não fornece um sucesso ou recibo fictício ao produtor/browser.

Após a incerteza, o UI deve manter o pedido bloqueado e oferecer retry do mesmo pedido. O teste limpa somente o cache próprio de reviews — `procurementDecisions.dispose()` é `reviews.clear()` — e conserva processo, store e browser. O retry exige o mesmo corpo, mesma key e mesmo recibo. Nenhuma segunda revisão ocorre. A igualdade integral do material Procurement, um histórico de domínio, um commit de recibo, um recibo no caso e um no namespace durável impedem interpretar uma segunda aplicação como sucesso idempotente.

## Limpeza e seleção

H09 não inicia um novo processo browser: toma um lease da fixture owner. O `finally` libera páginas/contextos pelo `closeWp01Browser`; mesmo se a liberação lançar erro, o bloco externo executa `server.stop(true)` e o descarte do fixture/store. O fechamento e comprovação física do processo Chromium pertencem ao finalizer owner, que continua obrigatório.

A seleção hospedada deve conter, nessa ordem e com prefixos `./`, startup owner, `wp04/host-integration.test.ts` e lifecycle owner. Não usar filtros, isolamento ou ordem diferente. O nonce/Omni e o resultado de startup/finalizer devem constar no recibo. O log `SF_PROCUREMENT_UI_PROOF` é evidência contextual; não vale como PASS se H09 ou cleanup/finalizer falharem.

## Conclusão da leitura

Após as duas correções, nenhum defeito adicional foi confirmado nesta revisão de origem, autoridade da fixture, transporte de prova, idempotência ou limpeza. A execução hospedada permanece necessária e pendente. O parecer não é aceite humano/nativo/global, não prova restart e não substitui revisão independente exigida do bundle final.
