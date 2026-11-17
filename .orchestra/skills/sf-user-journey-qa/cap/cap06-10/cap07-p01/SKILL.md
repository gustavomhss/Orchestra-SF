---
name: sf-user-journey-qa-cap-cap06-10-cap07-p01
description: "QA manutenção SF: executar story SF-CAP07-P01 (CAP07: Manter o quadro de pessoas sem confundir organograma com au) pela UI; ator HR, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP07-P01 ou o caso específico CAP07: Manter o quadro de pessoas sem confundir organograma com a"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP07-P01"
---
# SF-CAP07-P01 — CAP07: Manter o quadro de pessoas sem confundir organograma com autorização Entra

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** HR · **Superfícies:** CAP07 · **Jornadas:** J02, J08.

**Entrada UI indicada:** `/orchestra/sf-people/structure` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** EMP-SYN-014 · Gestão TI · líder ID P-001 · 1 FTE

**Resultado de negócio:** Como HR sintética HR-01, quero manter o quadro de pessoas sem confundir organograma com autorização Entra para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: EMP-SYN-014 · Gestão TI · líder ID P-001 · 1 FTE. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Team Structure e registrar membro sintético EMP-SYN-014
3. Associar a líder por referência imutável e centro de custo
4. Alterar cargo fictício e navegar pelo organograma
5. Comparar quadro do produto com diretório Microsoft sem inferir equivalência
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- A estrutura reflete 1 FTE e vínculo correto
- Mudança de cargo não concede role de segurança
- Identidade do produto não é confundida com nome ou email do Entra
- Ações deixam rastro de origem e revisão
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u03. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
