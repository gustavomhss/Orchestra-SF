---
name: sf-user-journey-qa-cap-cap21-25-cap24-p01
description: "QA manutenção SF: executar story SF-CAP24-P01 (CAP24: Diagnosticar fila de Procurement e seus atrasos por etapa) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP24-P01 ou o caso específico CAP24: Diagnosticar fila de Procurement e seus atrasos por etapa"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP24-P01"
---
# SF-CAP24-P01 — CAP24: Diagnosticar fila de Procurement e seus atrasos por etapa

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** CAP24 · **Jornadas:** J04.

**Entrada UI indicada:** `/orchestra/sf-procurement/overview` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** PR-32000 · draft→PR→sourcing→PO · 3 pedidos sintéticos no painel

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero diagnosticar fila de Procurement e seus atrasos por etapa para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: PR-32000 · draft→PR→sourcing→PO · 3 pedidos sintéticos no painel. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Procurement Dashboard para a organização SF-LAB
3. Reconstruir contagem por PR pendente, sourcing e PO com três IDs
4. Abrir pedido PR-32000 e voltar com filtros intactos
5. Conferir aging por timestamp de entrada no estágio e comparação com fila de Gabriel
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Contagens reconciliam com requisições fonte, sem duplicatas
- Aging mede estágio atual real, não data da página
- Pedido sem holder válido não aparece como aprovado
- CAP24 recebe evidência E2E dedicada, não apenas teste genérico de rota
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
