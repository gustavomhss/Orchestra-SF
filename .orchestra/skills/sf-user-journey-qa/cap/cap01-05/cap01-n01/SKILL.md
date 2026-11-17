---
name: sf-user-journey-qa-cap-cap01-05-cap01-n01
description: "QA manutenção SF: executar story SF-CAP01-N01 (CAP01: contraprova — Nega-se acesso a uma revisão histórica da car) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP01-N01 ou o caso específico CAP01: contraprova — Nega-se acesso a uma revisão histórica da ca"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP01-N01"
---
# SF-CAP01-N01 — CAP01: contraprova — Nega-se acesso a uma revisão histórica da carteira após revogar a permissão do CIO durante a sessão

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** CIO · **Superfícies:** CAP01 · **Jornadas:** J01, J05.

**Entrada UI indicada:** `/orchestra/sf-dashboard/executive` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** BRF-CIO-01 · setembro/2026 · forecast USD 590.000 · risco R-07

**Resultado de negócio:** Como QA adversarial, quero desafiar Dashboard: Executive Dashboard no contexto BRF-CIO-01 · setembro/2026 · forecast USD 590.000 · risco R-07 para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-CAP01-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

## Passos a executar na interface

1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Nega-se acesso a uma revisão histórica da carteira após revogar a permissão do CIO durante a sessão
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

## Oráculos observáveis (não reescrever para passar)

- Nenhum cartão protegido, detalhe, export ou cache revela a revisão revogada
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Nenhum cartão protegido, detalhe, export ou cache revela a revisão revogada

**Fontes de teste existentes:** u02. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
