---
name: sf-user-journey-qa-cap-cap26-28-cap27-p01
description: "QA manutenção SF: executar story SF-CAP27-P01 (CAP27: Manter fornecedor apto e protegido para sourcing) pela UI; ator SUPPLIER_ADMIN, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP27-P01 ou o caso específico CAP27: Manter fornecedor apto e protegido para sourcing"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP27-P01"
---
# SF-CAP27-P01 — CAP27: Manter fornecedor apto e protegido para sourcing

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** SUPPLIER_ADMIN · **Superfícies:** CAP27 · **Jornadas:** J04.

**Entrada UI indicada:** `/orchestra/sf-procurement/suppliers` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** SUP-003 · Maritime Labs S.A. fictícia · status active

**Resultado de negócio:** Como Supplier Admin SA-01, quero manter fornecedor apto e protegido para sourcing para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: SUP-003 · Maritime Labs S.A. fictícia · status active. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Suppliers e selecionar SUP-003
3. Atualizar contatos e status cadastral
4. Consultar vínculo com CON-042 e PR-32000
5. Revisar mascaramento dos dados bancários conforme grant
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Fornecedor selecionado é o mesmo ID nos consumidores
- Histórico registra status e owner
- Dados bancários não aparecem em leitor comum
- Só fornecedor elegível participa de nova adjudicação
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u14. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
