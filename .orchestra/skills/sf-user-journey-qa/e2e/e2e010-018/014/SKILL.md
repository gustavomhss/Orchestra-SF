---
name: sf-user-journey-qa-e2e-e2e010-018-014
description: "QA manutenção SF: executar story SF-E2E-014 (Mesmo nome, dois tenants e nenhum vazamento) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-014 ou o caso específico Mesmo nome, dois tenants e nenhum vazamento"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-014"
---
# SF-E2E-014 — Mesmo nome, dois tenants e nenhum vazamento

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** FINANCE, BUYER · **Superfícies:** UI67, CAP18, CAP25, UI58, UI68 · **Jornadas:** J03, J04, J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Instalação A SF-LAB e B SF-ISOLATED; IDs sintéticos parecidos mas projetos/principals distintos.

**Resultado de negócio:** Como CIO, com apoio de FINANCE, BUYER, diante da situação descrita, preciso trocar instalação/tenant com referências visualmente parecidas, para impedir leitura e escrita no conjunto errado.

## Pré-condições específicas

- Instalação A SF-LAB e B SF-ISOLATED; IDs sintéticos parecidos mas projetos/principals distintos.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Autenticar Finance na instalação A e abrir OPEX-LIC-01
2. **[READ_ONLY_WITNESS]** Capturar referência de A e trocar instalação para B
3. **[UI_ACTION]** Tentar abrir OPEX e documento de A via URL adulterada
4. **[UI_ACTION]** Buyer tenta consultar PR-32000 de A pela sessão B
5. **[UI_ACTION]** CIO tenta exportar relatório de A com contexto B
6. **[UI_ACTION]** Reabrir B pela rota normal e validar dados próprios
7. **[READ_ONLY_WITNESS]** Trocar de volta para A e verificar ausência de novos commits

## Oráculos observáveis (não reescrever para passar)

- Contexto B nunca acessa dados da instalação A só por ID
- Todas mutações exigem owner tuple atual
- Referências opacas não são autorização
- Tentativas negadas não escrevem dados em A/B
- Após troca, UI não mantém dados da sessão anterior

## Contraprovas

- Passar X-SF-Native-Owner codificado que não bate com sessão: 409
- Ausência de fence quando exigida resulta bloqueio, nunca fallback

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
