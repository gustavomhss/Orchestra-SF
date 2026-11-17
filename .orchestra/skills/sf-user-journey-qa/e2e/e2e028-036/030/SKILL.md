---
name: sf-user-journey-qa-e2e-e2e028-036-030
description: "QA manutenção SF: executar story SF-E2E-030 (O tema Sucafina preserva a arquitetura visual do Orchestra) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-030 ou o caso específico O tema Sucafina preserva a arquitetura visual do Orchestra"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-030"
---
# SF-E2E-030 — O tema Sucafina preserva a arquitetura visual do Orchestra

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** CIO · **Outros atores:** LEADER, HR · **Superfícies:** CAP01, UI29, UI47, UI67 · **Jornadas:** J08.

**Dependência de release:** WHITE_LABEL_RELEASE_FEATURE_UNVERIFIED; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Tema white-label Sucafina proposto, sem redesenhar glass/blur/geometria da arquitetura Orchestra.

**Resultado de negócio:** Como CIO, com apoio de LEADER, HR, diante da situação descrita, preciso avaliar white-label em loading, navegação, vidro, blur e acessibilidade, para entregar identidade visual premium sem regressão de UX.

## Pré-condições específicas

- Tema white-label Sucafina proposto, sem redesenhar glass/blur/geometria da arquitetura Orchestra.

## Passos a executar na interface

1. Abrir telas com tema padrão da plataforma e capturar baseline visual
2. Ativar tema Sucafina em build que realmente o inclua
3. Conferir wordmark, favicon, loading, naming e motion
4. Testar glass, blur, transparências, shadows e geometria idênticos
5. Executar dark/light, zoom 200, reduced-motion, mobile 320 e desktop 1440
6. Percorrer navegação entre os 15 capítulos e modal
7. Verificar contraste WCAG e foco de teclado sem depender de cor
8. Comparar screenshots e registrar divergências pixel/semânticas

## Oráculos observáveis (não reescrever para passar)

- Identidade Sucafina é coerente sem adulterar componentes funcionais
- Animação respeita prefers-reduced-motion
- Sem degradação de densidade, responsividade ou contraste
- O tema não escreve domínio nem muda RBAC
- Nenhum asset é inventado como “logo oficial” sem aprovação

## Contraprovas

- Tema ausente no branch: status FEATURE_NOT_INSTALLED, não reprovação falsa do build legado
- Loading deve mostrar estado real e não ocultar erro de autorização

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
