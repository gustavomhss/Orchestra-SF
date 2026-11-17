# Plano de testes baseados em estados — projeto, não prova de implementação

**Fonte:** estados conhecidos da auditoria anterior e transições candidatas da camada de QA. **AVISO:** nenhuma aresta foi inferida como comando já disponível; todas devem ser reconciliadas com produtor/holder e API do candidato C.

A matriz `TRANSITION-COVERAGE-PLAN.csv` tem modelos iniciais para Procurement, Import, Decisions, Routine e Supreme Admin. Para cada transição, o QA deve confirmar: (1) ator/role/grant; (2) estado de origem e versão; (3) comando nomeado do produtor; (4) efeito permitido/negado; (5) receipt, audit e leitura posterior.

**Oráculos negativos obrigatórios para cada mutação crítica:**

- Mesmo payload/mesma idempotency key → um efeito, retorno ao receipt original; payload diferente/mesma key → negação, não novo efeito.
- Repetição com `sourceVersion` antiga → conflito ou recusa de negócio; nenhuma alteração parcial.
- Usuário com somente viewer, sem grant, self-approval, cross-tenant ou revogado entre preview e commit → negação no servidor.
- Cancelamento, timeout antes do commit, perda da resposta após commit e reinício do host → status e receipt reconciliados separadamente.
- `read`, `prepare`, `review`, `analysis`, `choice` não avançam o domínio original sem apply por autoridade admitida.

**A matriz não é completa:** cancelações, reaberturas, swaps de holder e transições legais adicionais exigem extração real do produtor. Não medir 100% de arestas a partir deste rascunho.
