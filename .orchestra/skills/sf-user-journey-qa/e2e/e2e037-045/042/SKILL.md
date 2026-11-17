---
name: sf-user-journey-qa-e2e-e2e037-045-042
description: "QA manutenção SF: executar story SF-E2E-042 (O produto continua operável para teclado, zoom e idiomas) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-042 ou o caso específico O produto continua operável para teclado, zoom e idiomas"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-042"
---
# SF-E2E-042 — O produto continua operável para teclado, zoom e idiomas

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** CIO · **Outros atores:** HR, LEADER · **Superfícies:** CAP01, UI29, UI31, UI47 · **Jornadas:** J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Usuários executivos em monitores grandes, notebook e mobile; idioma pode variar, dark/light.

**Resultado de negócio:** Como CIO, com apoio de HR, LEADER, diante da situação descrita, preciso executar interações críticas com zoom, teclado, contraste e textos longos, para servir colaboradores em ambientes e necessidades diversas.

## Pré-condições específicas

- Usuários executivos em monitores grandes, notebook e mobile; idioma pode variar, dark/light.

## Passos a executar na interface

1. Abrir menu lateral e botões principais só com teclado
2. Tab, Shift+Tab, Enter e Esc em diálogos
3. Inspecionar foco após salvar/cancelar
4. Aplicar zoom 200 e viewport320,768,1440
5. Testar reduced-motion no loading do tema
6. Colar texto com acentos, emoji e linha longa em nota
7. Testar locale pt/en e fuso quando suportados
8. Conferir contraste em estados de erro, desabilitado e sucesso

## Oráculos observáveis (não reescrever para passar)

- Sem teclado preso em modal
- Ações têm nome acessível e foco determinístico
- Form inválido preserva dados e aponta campo
- Tema não causa overflow do documento ou perda de legenda
- Traduções não mudam chaves de negócio/IDs
- Reduzir movimento elimina animação não essencial

## Contraprovas

- Acento no nome não altera ID nem autorização
- Zoom 400% evidencia reflow quando obrigatório pelo produto

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
