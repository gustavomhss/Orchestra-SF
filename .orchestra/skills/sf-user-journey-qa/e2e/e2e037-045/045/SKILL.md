---
name: sf-user-journey-qa-e2e-e2e037-045-045
description: "QA manutenção SF: executar story SF-E2E-045 (Auditoria consegue reconstruir a história de uma decisão) pela UI; ator AUDITOR, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-045 ou o caso específico Auditoria consegue reconstruir a história de uma decisão"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-045"
---
# SF-E2E-045 — Auditoria consegue reconstruir a história de uma decisão

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** AUDITOR · **Outros atores:** CIO, HR · **Superfícies:** UI40, UI48, UI57, UI68 · **Jornadas:** J05, J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Audit do workbench inclui actor, before, after e UTC; export pode conter informação corporativa restrita.

**Resultado de negócio:** Como AUDITOR, com apoio de CIO, HR, diante da situação descrita, preciso revisar atores, evidências, horários, mudanças, recibos e retenção, para permitir responsabilização e revisão independente.

## Pré-condições específicas

- Audit do workbench inclui actor, before, after e UTC; export pode conter informação corporativa restrita.

## Passos a executar na interface

1. Identificar conjunto mínimo de campos de auditoria por operação
2. Capturar PR/import/grant com consent e contexto fictícios
3. Executar mutação admitida e observar audit atômico
4. Testar ação negada e verificar ausência de log falso de sucesso
5. Exercer consulta pelo auditor com grant próprio
6. Revogar acesso a pessoa e retestar download de export
7. Inspecionar a política de retenção assinada pelo owner
8. Testar backup/restore de audit e consistência dos recibos

## Oráculos observáveis (não reescrever para passar)

- Audit preserva ator técnico e hora de forma confiável
- Acesso a audit é controlado e não vira painel público
- Dados pessoais/financeiros são minimizados conforme política acordada
- Retenção não pode ser presumida se não aprovada
- Quem assina GO/NO-GO tem evidência das negativas

## Contraprovas

- Editar audit retroativamente ou removê-lo no rollback sem trilha é P0
- Auditor sem grant não pode ler audit por deep link

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
