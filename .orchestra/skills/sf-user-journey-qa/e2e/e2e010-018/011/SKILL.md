---
name: sf-user-journey-qa-e2e-e2e010-018-011
description: "QA manutenção SF: executar story SF-E2E-011 (Dados bancários de fornecedor não são dados de comprador) pela UI; ator SUPPLIER_ADMIN, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-011 ou o caso específico Dados bancários de fornecedor não são dados de comprador"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-011"
---
# SF-E2E-011 — Dados bancários de fornecedor não são dados de comprador

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** SUPPLIER_ADMIN · **Outros atores:** BUYER, CIO · **Superfícies:** CAP14, CAP25, CAP27, UI31, UI68 · **Jornadas:** J04, J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · SUP-003 tem dados financeiros sensíveis sintéticos; buyer somente vê elegibilidade.

**Resultado de negócio:** Como SUPPLIER_ADMIN, com apoio de BUYER, CIO, diante da situação descrita, preciso revisar cadastro, aprovação e leitura de campos restritos em diferentes perfis, para não permitir exposição financeira indevida.

## Pré-condições específicas

- SUP-003 tem dados financeiros sensíveis sintéticos; buyer somente vê elegibilidade.

## Passos a executar na interface

1. Supplier Admin cria/edita SUP-003 autorizado
2. Pedro consulta cadastro geral do fornecedor
3. Pedro abre cotação no contexto de PR-32000
4. QA tenta achar conta bancária por Busca SF
5. QA tenta exportar PO com campos privados
6. Revoga grant e repete URLs e downloads
7. Verifica logs sanitizados e redaction no DOM
8. Auditor confere ausência de commit pelo Buyer

## Oráculos observáveis (não reescrever para passar)

- Buyer vê supplierRef, status e item elegível sem dados bancários
- Busca e export não vazam campos restritos
- Grant revogado faz efeito em sessão existente
- Cadastro não é atualizado por leitura
- Eventos de negação não persistem o segredo negado

## Contraprovas

- URL direta a supplier bank data sem grant: 403/redaction
- Trocar objeto de fornecedor em requisição mantendo principal: deve falhar

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
