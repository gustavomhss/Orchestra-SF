---
name: sf-user-journey-qa-e2e-e2e037-045-043
description: "QA manutenção SF: executar story SF-E2E-043 (A rede caiu no momento do Apply) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-043 ou o caso específico A rede caiu no momento do Apply"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-043"
---
# SF-E2E-043 — A rede caiu no momento do Apply

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** FINANCE, BUYER · **Superfícies:** CAP18, CAP25, UI57 · **Jornadas:** J01, J03, J04.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Conexão da filial perde 10s enquanto alteração CAS é enviada e comprovante de negócio pode ou não existir.

**Resultado de negócio:** Como CIO, com apoio de FINANCE, BUYER, diante da situação descrita, preciso injetar queda de conectividade antes e depois do commit, para não executar uma segunda operação por engano.

## Pré-condições específicas

- Conexão da filial perde 10s enquanto alteração CAS é enviada e comprovante de negócio pode ou não existir.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Registrar before snapshot da versão OPEX e PR
2. **[UI_ACTION]** Enviar save de OPEX e interromper entrega da resposta
3. **[UI_ACTION]** Não presumir commit nem fazer retry automático
4. **[UI_ACTION]** Recuperar via leitura do registro/attempt quando protocolo permitir
5. **[UI_ACTION]** Se não houve commit, permitir reenvio explícito com nova autorização
6. **[UI_ACTION]** Repetir com Apply de import em que o commit ocorreu
7. **[UI_ACTION]** Repetir com submissão de PR em que o commit não ocorreu
8. **[UI_ACTION]** Auditor registra contagem de recibos e estados finais

## Oráculos observáveis (não reescrever para passar)

- Nenhuma duplicidade para operações já persistidas
- UI distingue resposta perdida de transação negada
- Draft do usuário é preservado quando negócio não mudou
- O retry é idempotente quando contrato exige
- Ator atual e policy são revalidados na recuperação

## Contraprovas

- Retry cego que produz duas PO/importações é P0
- Exibir success antes de ler receipt é defeito

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
