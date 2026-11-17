---
name: sf-user-journey-qa-e2e-e2e028-036-028
description: "QA manutenção SF: executar story SF-E2E-028 (Busca precisa preservar privacidade e proveniência) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-028 ou o caso específico Busca precisa preservar privacidade e proveniência"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-028"
---
# SF-E2E-028 — Busca precisa preservar privacidade e proveniência

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** LEADER, AUDITOR · **Superfícies:** UI31, UI32, UI62 · **Jornadas:** J06, J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Busca sobre título “EDI Santos”, dois objetos homônimos e documento privado DOC-EDI-01.

**Resultado de negócio:** Como CIO, com apoio de LEADER, AUDITOR, diante da situação descrita, preciso buscar termos sensíveis sem colocá-los na URL, sob papéis diferentes, para evitar vazamento em logs, histórico e resultados.

## Pré-condições específicas

- Busca sobre título “EDI Santos”, dois objetos homônimos e documento privado DOC-EDI-01.

## Passos a executar na interface

1. CIO pesquisa EDI Santos via POST JSON
2. Confere que URL não contém termo de busca
3. Abre dois resultados homônimos por IDs distintos
4. Auditor sem grant repete busca
5. Inspeciona resultados de similar cases
6. Tenta GET com parâmetros de query privados
7. Tenta saved view com filtros do CIO em outra conta
8. QA captura network trace sanitizada e ausência de informação privada

## Oráculos observáveis (não reescrever para passar)

- POST e idempotency conforme contrato instalado
- GET with query é recusado, não convertido silenciosamente
- Resultados são privados por principal mesmo que título igual
- Saved Views V2 é tratado como indisponível se não instalado
- Nenhum resultado concede acesso à fonte

## Contraprovas

- Ataque Unicode confusable no nome da referência não troca IDs
- Termos de busca não aparecem em URLs/Referer ou logs públicos

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
