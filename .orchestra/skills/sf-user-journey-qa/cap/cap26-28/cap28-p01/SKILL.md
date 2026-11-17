---
name: sf-user-journey-qa-cap-cap26-28-cap28-p01
description: "QA manutenção SF: executar story SF-CAP28-P01 (CAP28: Ver regras de Procurement sem alterar governança por aciden) pela UI; ator PROC_ADMIN, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP28-P01 ou o caso específico CAP28: Ver regras de Procurement sem alterar governança por acide"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP28-P01"
---
# SF-CAP28-P01 — CAP28: Ver regras de Procurement sem alterar governança por acidente

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** PROC_ADMIN · **Superfícies:** CAP28 · **Jornadas:** J04.

**Entrada UI indicada:** `/orchestra/sf-procurement/settings` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** PROC-POLICY-2026 · estágios PR/SRC/PO · limite sintético 30000 USD

**Resultado de negócio:** Como Admin de domínio Procurement PA-01, quero ver regras de Procurement sem alterar governança por acidente para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: PROC-POLICY-2026 · estágios PR/SRC/PO · limite sintético 30000 USD. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Procurement Settings com papel admin de domínio
3. Ler estágios, holders e regras efetivamente instaladas
4. Solicitar alteração em ambiente QA sob política admitida
5. Revalidar fluxo PR-32000 após revisão de policy
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Alteração é permitida somente se produtor atual expuser comando autorizado
- Mudança não reaprova estágios antigos automaticamente
- Versão de policy é rastreada
- Role de domínio não equivale a supreme-admin Entra
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u36. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
