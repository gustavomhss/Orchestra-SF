---
name: sf-user-journey-qa-ui-ui64-68-ui67-p01
description: "QA manutenção SF: executar story SF-UI67-P01 (UI67: Autenticar em Microsoft e selecionar contexto corporativo vá) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI67-P01 ou o caso específico UI67: Autenticar em Microsoft e selecionar contexto corporativo v"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI67-P01"
---
# SF-UI67-P01 — UI67: Autenticar em Microsoft e selecionar contexto corporativo válido

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI67 · **Jornadas:** J08.

**Entrada UI indicada:** `/orchestra/sf-home/context` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** OIDC resource tenant · project SF-LAB · owner CIO

**Resultado de negócio:** Como André (persona CIO, simulado no roteiro; conta somente se autorizada), quero autenticar em Microsoft e selecionar contexto corporativo válido para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: OIDC resource tenant · project SF-LAB · owner CIO. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Entrar via OIDC com conta Entra autorizada
3. Inspecionar sessão, contexto e grants atuais sem exibir segredos
4. Trocar instalação/projeto autorizado
5. Deslogar e tentar reabrir deep link anterior
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Claims tid/oid e principal são vinculados ao tenant recurso
- Contexto inclui instalação/projeto/owner atual
- Após logout deep link privado é negado
- local-operator não é fallback em nuvem
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u01-host231, shell-guard237. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
