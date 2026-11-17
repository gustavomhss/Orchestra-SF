---
name: sf-user-journey-qa-ui-ui54-58-ui55-n01
description: "QA manutenção SF: executar story SF-UI55-N01 (UI55: contraprova — Enviar arquivo com macro, extensão falsa ou MI) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI55-N01 ou o caso específico UI55: contraprova — Enviar arquivo com macro, extensão falsa ou M"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI55-N01"
---
# SF-UI55-N01 — UI55: contraprova — Enviar arquivo com macro, extensão falsa ou MIME incorreto

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Superfícies:** UI55 · **Jornadas:** J03.

**Entrada UI indicada:** `/orchestra/sf-imports/new` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** IMPORT-OPEX-SEP26.xlsx · 12 linhas · centro IT-BR

**Resultado de negócio:** Como QA adversarial, quero desafiar Arquivos/destino de import no contexto IMPORT-OPEX-SEP26.xlsx · 12 linhas · centro IT-BR para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI55-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

## Passos a executar na interface

1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Enviar arquivo com macro, extensão falsa ou MIME incorreto
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

## Oráculos observáveis (não reescrever para passar)

- Rejeição file-not-accepted é clara, sem 200 enganoso ou commit
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Rejeição file-not-accepted é clara, sem 200 enganoso ou commit

**Fontes de teste existentes:** u23. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
