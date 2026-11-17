---
name: sf-user-journey-qa-ui-ui34-38-ui35-p01
description: "QA manutenção SF: executar story SF-UI35-P01 (UI35: Comparar alternativas com custo elegibilidade e FX conhecido) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI35-P01 ou o caso específico UI35: Comparar alternativas com custo elegibilidade e FX conhecid"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI35-P01"
---
# SF-UI35-P01 — UI35: Comparar alternativas com custo elegibilidade e FX conhecido

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI35 · **Jornadas:** J04, J06.

**Entrada UI indicada:** `/orchestra/sf-decisions/:caseRef/alternatives` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** ALT-A 32400 USD · ALT-B 28000 EUR×1.08 · ALT-C 29000 USD ineligible

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero comparar alternativas com custo elegibilidade e FX conhecido para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: ALT-A 32400 USD · ALT-B 28000 EUR×1.08 · ALT-C 29000 USD ineligible. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir alternativas de CASE-EDI-01
3. **[READ_ONLY_WITNESS]** Registrar A/B/C com critérios e fonte da avaliação
4. **[UI_ACTION]** Calcular equivalência de B e marcar C tecnicamente inelegível
5. **[UI_ACTION]** Abrir detalhe e submeter para escolha humana
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- B equivalente a 30240 USD
- C não vence apesar do menor preço
- Score publicado precisa reproduzir componentes 87.9333 e 85 do oráculo quando aplicável
- Comparação isolada não aprova pedido
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u17. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
