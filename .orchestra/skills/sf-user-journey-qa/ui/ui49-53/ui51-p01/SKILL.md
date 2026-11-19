---
name: sf-user-journey-qa-ui-ui49-53-ui51-p01
description: "QA manutenção SF: executar story SF-UI51-P01 (UI51: Ligar registros de áreas sem supor equivalência por título) pela UI; ator LEADER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI51-P01 ou o caso específico UI51: Ligar registros de áreas sem supor equivalência por título"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI51-P01"
---
# SF-UI51-P01 — UI51: Ligar registros de áreas sem supor equivalência por título

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** LEADER · **Superfícies:** UI51 · **Jornadas:** J01, J06.

**Entrada UI indicada:** `/orchestra/sf-work/relations/:relationRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** REL-EDI-01 · HOT-EDI-07 ↔ PR-32000 ↔ P-004

**Resultado de negócio:** Como Caio, líder/contribuidor de TI, quero ligar registros de áreas sem supor equivalência por título para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: REL-EDI-01 · HOT-EDI-07 ↔ PR-32000 ↔ P-004. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. **[UI_ACTION]** Abrir relações e selecionar HOT-EDI-07
3. **[UI_ACTION]** Adicionar relação com PR-32000 por ref canônico
4. **[UI_ACTION]** Criar segundo vínculo P-004
5. **[UI_ACTION]** Validar navegação de cada ponta após salvar
6. **[READ_ONLY_WITNESS]** Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Refs são tipadas e diferenciam domínio
- Card mostra ambas origens e permissões
- Repetir criação não duplica relação
- Não há mutação no source somente pelo vínculo
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u44. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
