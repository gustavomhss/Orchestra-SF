# Personas, cultura operacional e dados sintéticos correlacionados

## Ambiente corporativo representado

Uma organização fictícia de tecnologia global, com centros de custo para Europa (`IT-CH`), Brasil (`IT-BR`), Ásia (`IT-ASIA`) e África (`IT-AFRICA`). Isso serve para testar janelas, moedas, timezones, stewardship e segregação de funções em contexto próximo ao de uma empresa internacional de comércio de café. **Nenhum desses centros, valores ou reportes é atribuição real à Sucafina.** Nosso objetivo é simular as decisões que um CIO real precisa defender com integridade de fonte.

A persona CIO (André, conforme intenção do patrocinador) prepara prioridades e reporta à governança; **não** assume papéis Finance, RH ou approver por ser CIO. Daniel pode figurar no grupo supremo no *desenho* do PR #270, mas a prova live deve consultar `checkMemberGroups` e não confiar no nome. Caio, Pedro, Gabriel e Sofie correspondem aos rótulos de atores da organização demonstrativa; **não inserir oid/tenant ID real em arquivo versionado**. Zico é ator de negação sem grupo, esperado 403 na área protegida se a sessão é válida. As personas adicionais são 100% fictícias.

| Papel lógico | Tarefa observável | O que NÃO ganha por inferência |
| --- | --- | --- |
| CIO / Executivo | Priorizar, convocar reunião, preservar review, registrar escolha | Mutar official Finance, aprovar PR alheia, ler salários privados |
| Finance (Sofie) | Budget, actual, forecast, OPEX, FX, cenário, import | Holder Procurement; alteração de policy Entra |
| Budget owner | Gestão de budget na própria unidade e versão | Direito de edição de actual locked |
| HR | Headcount, organograma de produto, talento restrito | Supreme Admin / leitura pública de avaliação individual |
| Leader/Requester (Caio) | Tópicos, tarefas, requisitar compra | Buyer/approver automático |
| Buyer (Pedro) | Cotação, sourcing, PO onde permitido | Self-approval, dados bancários sem grant |
| Holder/Approver (Gabriel) | Deliberar somente na etapa atribuída | Alterar fornecedor ou estágio arbitrário |
| Supplier Admin | Cadastro e sigilo de fornecedor | Aprovar requisição |
| Ops/Security/Risk Owner | Métricas, incidentes, riscos e mitigação | Publicar orçamento como official |
| Auditor | Reconciliar histórico e recibos autorizados | Superuser; export irrestrito |
| Supreme Admin (condicional PR #270) | Ler Graph server-side, mapear grupo→role e perfil→grant | Modificar membership Entra, elevar o próprio grant |
| Local Operator | Diagnóstico de instância local isolada | Substituir Entra na nuvem |
| Zico, ator sem grupo | Teste negativo de acesso à instalação | Acessar áreas protegidas por adivinhar URL |

**Autorização efetiva** não deriva deste documento. Para cada story, o executor lê sessão e snapshots instalados. A matriz `roles × grants × resource scope × source revision × action × tenant` precisa ser aplicada no produtor, nunca só no menu.

## Verdades sintéticas para contas e resultados

| ID | Estado de partida | Cálculo / evento esperado |
| --- | --- | --- |
| `BUD-2026-IT` | Budget 600.000 USD; actual Jan–Set 400.000; open 190.000 | Outlook base = 590.000 USD; margin vs budget = +10.000 USD de folga |
| `OPEX-LIC-01` | SaaS 72.000 USD incluído no aberto | Cenário A: 84.000 → outlook 602.000 (+12.000 vs base; -2.000 margem); B: 78.000 → 596.000 (+6.000; +4.000 margem) |
| `CAPEX-SCANNER-01` | 91.827 USD, exercício 2027, projeto `P-009` | Não somar por engano ao OPEX 2026 |
| `HC-SEP-26` | 42 FTE aprovados, 40 ocupados | 2 vagas; alterar contratação em outubro não muda actual setembro |
| `ALLOC-EDI-01` | Split 60% IT-CH / 40% IT-BR | Soma 100%, 60/50 é inválida |
| `FX-EURUSD-SEP26` | EUR/USD = 1,08 em 30/09/2026 | EUR 28.000 = USD 30.240; FX ausente → indeterminado |
| `PR-32000` | Pedido USD 32.000, Requester Caio | A USD32.400; B EUR28.000/FX1,08 = USD30.240; C USD29.000 inelegível |
| `CASE-EDI-01` | Relaciona PR-32000, P-004 e DOC-EDI-01 | Escolher B não emite/autoriza PO, necessita prepared change, confirmação e producer apply |
| `DOC-EDI-01` | Relatório diz 6 dias de atraso | Extração errada “60 dias” deve ser rejeitada; evidência candidata não é fato |
| `OPS-SEP-26` | 99,7% disponibilidade vs 99,9% meta, 3 incidentes | Não arredondar como equivalente; missing KPI é distinto de 0 |
| `SEC-SEP-26` | 4 endpoints críticos sem patch / 200 | Taxa 2%, desde que denominador seja realmente 200 |
| `OUTCOME-EDI-01` | Previsão 6 dias; observado 9 | Delta +3 dias e snapshot da previsão preservado |
| `REV-EXEC-NOV/R1` | 25 projetos P-001…P-025 com notas longas | R1 imutável após editar P-004; R2 identifica delta, export R1 mantém fonte da época |

A versão **official/locked** nunca é alterada pela criação de hipóteses. `null`, `missing`, `zero`, `redacted`, `not applicable` e `incompatible FX` são estados distintos com expectativas próprias. `#N/A` ou payload ausente nunca vira zero para embelezar dashboard.

## Reprodutibilidade e separação de testes

1. `fixtures/SF-LAB-2026.json` é **modelo de dados**, não script SQL, não usuário Entra, nem garantia de ingestão. Para seed, mapear cada entidade por **porta de produto autorizada** e registrar `sourceRef` real e versão, ou declarar bloqueio.
2. O projeto tem **25 projetos**, **10 fornecedores fictícios**, orçamento conhecido e uma malha Graph **inteiramente fictícia** de 23 perfis para teste de lógica; os UUIDs determinísticos são **somente mocks**, nunca logins reais.
3. `fixtures/IMPORT-OPEX-VALID.xlsx` segue cabeçalhos conhecidos do teste Playwright original. Não usar numa versão com esquema diferente sem qualificar parser. O arquivo adversarial tem uma linha duplicada e uma linha negativa; não afirmar quantas foram admitidas sem observação do produtor.
4. Flamengo é **outro cenário** no `sfa-demo-flamengo`, não a organização real Sucafina. O pack não altera nem injeta dados automaticamente no tenant.
5. Cada execução gera novo `run_id`, e não compartilha datasets entre testadores que possam concorrer. Testes de concorrência usam duas sessões explicitamente combinadas. Reutilizar IDs sem reset invalida oráculos de “um efeito”.
