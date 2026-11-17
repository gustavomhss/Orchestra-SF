---
name: sf-user-journey-qa-cap-cap06-10-cap07-n01
description: "QA manutenção SF: executar story SF-CAP07-N01 (CAP07: contraprova — Ciclo de chefia A→B→A e pessoa com nome homôn) pela UI; ator HR, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP07-N01 ou o caso específico CAP07: contraprova — Ciclo de chefia A→B→A e pessoa com nome homô"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP07-N01"
---
# SF-CAP07-N01 — CAP07: contraprova — Ciclo de chefia A→B→A e pessoa com nome homônimo são introduzidos em fixture

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** HR · **Superfícies:** CAP07 · **Jornadas:** J02, J08.

**Entrada UI indicada:** `/orchestra/sf-people/structure` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** EMP-SYN-014 · Gestão TI · líder ID P-001 · 1 FTE

**Resultado de negócio:** Como QA adversarial, quero desafiar Dashboard: Team Structure no contexto EMP-SYN-014 · Gestão TI · líder ID P-001 · 1 FTE para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-CAP07-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

## Passos a executar na interface

1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Ciclo de chefia A→B→A e pessoa com nome homônimo são introduzidos em fixture
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

## Oráculos observáveis (não reescrever para passar)

- Organograma evita loop, sinaliza inconsistência e não funde perfis
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Organograma evita loop, sinaliza inconsistência e não funde perfis

**Fontes de teste existentes:** u03. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
