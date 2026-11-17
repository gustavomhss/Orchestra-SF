---
name: sf-user-journey-qa-cap-cap16-20-cap18-p01
description: "QA manutenção SF: executar story SF-CAP18-P01 (CAP18: Projetar renovação SaaS em cenários concorrentes) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP18-P01 ou o caso específico CAP18: Projetar renovação SaaS em cenários concorrentes"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP18-P01"
---
# SF-CAP18-P01 — CAP18: Projetar renovação SaaS em cenários concorrentes

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Superfícies:** CAP18 · **Jornadas:** J02.

**Entrada UI indicada:** `/orchestra/sf-planner/opex` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** OPEX-LIC-01 · 72000 baseline / 84000 A / 78000 B USD

**Resultado de negócio:** Como Sofie, Finance (conta existente quando tenant de demonstração for aprovado), quero projetar renovação SaaS em cenários concorrentes para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: OPEX-LIC-01 · 72000 baseline / 84000 A / 78000 B USD. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Planner OPEX na hipótese A
3. Modificar licença anual 72000→84000 com nota
4. Criar/abrir hipótese B sem copiar dados de A inadvertidamente
5. Comparar OPEX por centro de custo e total
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- A=602000, B=596000, base=590000 USD
- Deltas A +12000 e B +6000 corretos
- Actual/official imutáveis
- Linhas identificam currency, período e versão
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u07, u48. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
