---
name: sf-user-journey-qa-ui-ui59-63-ui59-p01
description: "QA manutenção SF: executar story SF-UI59-P01 (UI59: Validar trechos extraídos antes de usá-los como evidência) pela UI; ator LEADER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI59-P01 ou o caso específico UI59: Validar trechos extraídos antes de usá-los como evidência"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI59-P01"
---
# SF-UI59-P01 — UI59: Validar trechos extraídos antes de usá-los como evidência

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** LEADER · **Superfícies:** UI59 · **Jornadas:** J05.

**Entrada UI indicada:** `/orchestra/sf-documents/:documentRef/evidence` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** DOC-EDI-01 · trecho “6 dias de atraso”

**Resultado de negócio:** Como Caio, líder/contribuidor de TI, quero validar trechos extraídos antes de usá-los como evidência para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: DOC-EDI-01 · trecho “6 dias de atraso”. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir evidências candidatas extraídas
3. **[READ_ONLY_WITNESS]** Inspecionar trecho, página, score e contexto
4. **[UI_ACTION]** Rejeitar candidato sem suporte e confirmar candidato válido
5. **[READ_ONLY_WITNESS]** Comparar estado pending vs confirmed
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Candidato não confirmado não é fato
- Confirmação registra humano, trecho, origem e revisão
- Trecho de evidência não altera contrato nem PR
- Só dados autorizados são visíveis
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u24. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
