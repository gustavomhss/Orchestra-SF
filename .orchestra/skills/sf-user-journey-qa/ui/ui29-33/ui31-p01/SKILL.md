---
name: sf-user-journey-qa-ui-ui29-33-ui31-p01
description: "QA manutenção SF: executar story SF-UI31-P01 (UI31: Encontrar evidências autorizadas sem indexar segredos no end) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI31-P01 ou o caso específico UI31: Encontrar evidências autorizadas sem indexar segredos no en"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI31-P01"
---
# SF-UI31-P01 — UI31: Encontrar evidências autorizadas sem indexar segredos no endereço

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** CIO · **Superfícies:** UI31 · **Jornadas:** J08.

**Entrada UI indicada:** `/orchestra/sf-home/search` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** SEARCH-EDI-07 · documentos e itens de 3 domínios

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero encontrar evidências autorizadas sem indexar segredos no endereço para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: SEARCH-EDI-07 · documentos e itens de 3 domínios. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Busca SF e pesquisar “EDI Santos”
3. Comparar resultados por tipo/fonte, mantendo contexto
4. Abrir um resultado e conferir ID opaco
5. Inspecionar URL, histórico do navegador e logs sanitizados
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Busca recebe payload via POST sem query confidencial em URL
- Resultados omitem objetos fora dos grants
- Trechos são redigidos conforme fonte
- Navegação para item usa routeRef canônico
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u42. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
