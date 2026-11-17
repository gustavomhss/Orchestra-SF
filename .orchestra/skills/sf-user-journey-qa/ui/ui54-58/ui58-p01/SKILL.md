---
name: sf-user-journey-qa-ui-ui54-58-ui58-p01
description: "QA manutenção SF: executar story SF-UI58-P01 (UI58: Registrar documento com fonte e classificação adequadas) pela UI; ator LEADER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI58-P01 ou o caso específico UI58: Registrar documento com fonte e classificação adequadas"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI58-P01"
---
# SF-UI58-P01 — UI58: Registrar documento com fonte e classificação adequadas

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** LEADER · **Superfícies:** UI58 · **Jornadas:** J05.

**Entrada UI indicada:** `/orchestra/sf-documents` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** DOC-EDI-01 · relatório sintético de incidente de integração

**Resultado de negócio:** Como Caio, líder/contribuidor de TI, quero registrar documento com fonte e classificação adequadas para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: DOC-EDI-01 · relatório sintético de incidente de integração. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir catálogo Documentos e adicionar DOC-EDI-01
3. Preencher classificação e vínculo P-004
4. Inspecionar metadata, autor e integridade
5. Abrir extração em fluxo autorizado
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Documento tem docRef, digest e origem
- Conteúdo não se publica automaticamente no BI
- Viewer não autorizado não vê trechos ou filename privado
- Metadados identificam versionamento
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u24. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
