---
name: sf-user-journey-qa-ui-ui69-70-ui69-p01
description: "QA manutenção SF: executar story SF-UI69-P01 (UI69: Operar ferramentas locais sem assumir identidade Entra) pela UI; ator LOCAL_OPERATOR, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI69-P01 ou o caso específico UI69: Operar ferramentas locais sem assumir identidade Entra"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI69-P01"
---
# SF-UI69-P01 — UI69: Operar ferramentas locais sem assumir identidade Entra

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** LOCAL_OPERATOR · **Superfícies:** UI69 · **Jornadas:** J08.

**Entrada UI indicada:** `/orchestra/sf-home/administration` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** LOCAL-SF-01 · instalação isolada em localhost

**Resultado de negócio:** Como Operador local LO-01, quero operar ferramentas locais sem assumir identidade Entra para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: LOCAL-SF-01 · instalação isolada em localhost. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir ferramentas locais de administração em ambiente isolated
3. Inspecionar status e comandos de suporte permitidos
4. Executar ação de leitura/diagnóstico com local operator
5. Comparar comportamento ao tentar mesma URL em Azure
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Local tools só existem no contexto local previsto
- Não são atalhos para permissões Microsoft
- Não alteram snapshots corporativos indevidamente
- Acesso e diagnóstico têm trilha se operação causar efeito
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u28. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
