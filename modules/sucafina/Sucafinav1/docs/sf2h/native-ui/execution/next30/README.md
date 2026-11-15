# NEXT30 — 30 implementadores adicionais de UX/UI nativa Sucafina

**Status documental: PREPARED_NOT_STARTED — nenhuma sessão Nxx é iniciada, autorizada ou integrada por estes commits.**

Esta campanha soma **30 novos autores N01–N30** aos **19 autores existentes W01–W19**. Não reaproveita nenhum W. A integração permanece com o único ator **114/I00**, compiler/guards com **119**, execução dos testes de produto com **120** via GitHub Actions. Qualificação autoral Q01/Q02 e os três revisores finais R01/R02/R03 são papéis separados, sujeitos à designação real de S0 (não contam entre os 30).

## Abrir sessões sem reconstruir o que já existe

1. Leia [COMMON.md](COMMON.md) e [dispatch.json](dispatch.json). Há **30 pacotes independentes**, com allowlists exatas, protected paths, critérios de origem, contracts/required_reads, operações, entrypoints, testes e dependências por output. [PROMPTS.md](PROMPTS.md) tem 30 mensagens prontas para copiar.
2. O operador deve conferir o **HEAD vivo de `sf2-stack`**, os ACKs e leases reais W/S0/114 e os source pins; 114 precisa admitir **cada output** antes de um autor escrever código. `sf-ux-nXX` é apenas sugestão de branch de implementação **a criar quando autorizada**. Esta branch `sf-ux-next30-dispatch-20261115` é só docs.
3. Cada Nxx lê seus `execution/work-orders/ID.json` normativos e usa os mocks/workbench **como referência**, traduzindo para componentes, tokens e navegação Solid do Orchestra, sem iframe/standalone/novo backend. Reutilizar implementação existente é mais rápido do que reconstruir; uma saída já comprovadamente instalada pode encerrar como `NO_CHANGE_ALREADY_SATISFIED` sem código.
4. Entregar `ARTIFACT_READY` com código, testes autorais, pre/postimages, PR separada, shared patches integrais e receipt. **114** integra no candidato único `sf2-stack`; **119** executa compiler/guards/codegen; **120** dispara testes cirúrgicos exclusivamente Actions. Integração só é `QUALIFIED` com prova no mesmo C. Não executar testes localmente, merge, deploy nem alterar Azure.

## Distribuição das 30 novas sessões

| Nova sessão | Frente | Ordens / outputs | Branch de autoria sugerida |
| --- | --- | --- | --- |
| [N01](packets/N01.json) | Adapters de reuniões e relatórios | `A07` | `sf-ux-n01` |
| [N02](packets/N02.json) | Adapters BI | `A08` | `sf-ux-n02` |
| [N03](packets/N03.json) | Adapters Rotinas/Schedule | `A09` | `sf-ux-n03` |
| [N04](packets/N04.json) | Adapters Pessoas/Talent | `A10` | `sf-ux-n04` |
| [N05](packets/N05.json) | Adapters Operações/Segurança | `A11` | `sf-ux-n05` |
| [N06](packets/N06.json) | Adapters Trabalho/Busca/Views | `A12` | `sf-ux-n06` |
| [N07](packets/N07.json) | Adapters Colaboração | `A13` | `sf-ux-n07` |
| [N08](packets/N08.json) | Adapters Memória | `A14` | `sf-ux-n08` |
| [N09](packets/N09.json) | Adapters Análises | `A15` | `sf-ux-n09` |
| [N10](packets/N10.json) | Home, busca e views | `U01`, `U42`, `U43` | `sf-ux-n10` |
| [N11](packets/N11.json) | Meu trabalho e colaboração | `U41`, `U44` | `sf-ux-n11` |
| [N12](packets/N12.json) | Dashboard executivo e Hot Topics | `U02`, `U38` | `sf-ux-n12` |
| [N13](packets/N13.json) | Dashboard OPEX e CAPEX | `U39`, `U40` | `sf-ux-n13` |
| [N14](packets/N14.json) | Pessoas e Talent | `U03`, `U47` | `sf-ux-n14` |
| [N15](packets/N15.json) | Serviços e segurança de TI | `U04`, `U29` | `sf-ux-n15` |
| [N16](packets/N16.json) | Admin, riscos e performance | `U28`, `U30`, `U31` | `sf-ux-n16` |
| [N17](packets/N17.json) | Portfólio e cenários | `U05`, `U19` | `sf-ux-n17` |
| [N18](packets/N18.json) | Planner overview e versões | `U06`, `U46` | `sf-ux-n18` |
| [N19](packets/N19.json) | Planner OPEX/CAPEX/headcount | `U07`, `U08` | `sf-ux-n19` |
| [N20](packets/N20.json) | Planner entidades e câmbio | `U09`, `U45` | `sf-ux-n20` |
| [N21](packets/N21.json) | Procurement overview/configuração | `U10.overview`, `U36` | `sf-ux-n21` |
| [N22](packets/N22.json) | Requests PR/PO e contratos | `U11.complete`, `U15` | `sf-ux-n22` |
| [N23](packets/N23.json) | Approvals, sourcing e suppliers | `U13.complete`, `U12`, `U14` | `sf-ux-n23` |
| [N24](packets/N24.json) | Decisões: casos e alternativas | `U16`, `U17` | `sf-ux-n24` |
| [N25](packets/N25.json) | Decisões: escolha e BI | `U18`, `U22` | `sf-ux-n25` |
| [N26](packets/N26.json) | BI financeiro e operacional | `U20`, `U21` | `sf-ux-n26` |
| [N27](packets/N27.json) | Imports, exports e documentos | `U23`, `U24` | `sf-ux-n27` |
| [N28](packets/N28.json) | Reuniões e relatórios | `U25`, `U32`, `U33` | `sf-ux-n28` |
| [N29](packets/N29.json) | Rotinas, Schedule e residentes | `U27`, `U34`, `U35` | `sf-ux-n29` |
| [N30](packets/N30.json) | Memória e análises | `U26`, `U37` | `sf-ux-n30` |

### Contabilidade sem redução de escopo

| Escopo | Contagem | Destino |
| --- | ---: | --- |
| Corpus `execution/manifest.json` | **78 ordens** | Fonte normativa |
| Primeira campanha (I00 + W01–W19) | **20 posições** | Preservada; 19 autores e 114 integrador |
| Ordens inteiras da nova campanha | **53** | 9 adapters e 44 U, divididos entre 30 N |
| Outputs residuais das três ordens parcialmente atribuídas à primeira campanha | **3** | `U10.overview` N21, `U11.complete` N22, `U13.complete` N23 |
| Qualificação (não implementadores N) | **2** | Q01 e Q02; autores a designar por S0, despacho Actions por 120, guards por 119 |
| Revisões finais independentes (não implementadores N) | **3** | R01, R02, R03 sem autoria sobre o mesmo C |

Atenção: `campaign-overlay/COHORT.json` histórico traz apenas **dois** `residual_outputs` (U10.overview, U13.complete). A própria ficha normativa `work-orders/U11.json` contém **U11.complete** além de W19/U11.title-save. **Este NEXT30 corrige essa lacuna** sem alterar a ficha nem a campanha W original. W19 preserva `requests/title/**`, `sf-u11.ts` e `u11.spec.ts`. W12 preserva `queues/**`; W13 preserva `approvals/pr/**`. `protected_paths` prevalecem sobre glob pai.

**Cobertura não equivale a produto pronto:** todos os 15 WPs, 74 tasks, 17 contratos, **70 superfícies**, **305 operações** e **1.610 critérios** continuam obrigatórios. R01/R02/R03 só revisam o **mesmo** C final, com prova real; `GLOBAL_RELEASE=false`.

## Operação enxuta

- **Todos os 30 podem receber trabalho em paralelo** se os contratos/owners/leases relevantes estiverem congelados e autorizados; disponibilidade de output para integração pode ser posterior. Nem launch artificial nem polling de produtor bloqueado.
- Cada N entrega incrementos coerentes com branch/receipt próprios; o integrador recebe patches compartilhados de forma serial e faz a composição uma vez.
- Quando o owner/produtor/contrato estiver indisponível, isolar o output afetado, continuar os demais e declarar impedimento verificável. Sem mocks que finjam serviço, sem inventar recibos/aprovações, sem reduzir teste.
- Nenhum dos 30 abre o mesmo arquivo de outro W/N ou modifica registry global, central i18n, Protocol composition, generated, policy, auth ou engine financeira. Geração SDK exclusivamente por 119/114 conforme contrato.

## Verificação deste pacote

A contabilidade de IDs foi reconciliada contra `COHORT.remaining_orders` do snapshot: **53/53 ordens de implementação remanescentes, sem ID ausente ou duplicado; três outputs residuais incluídos**. Isso **não** é um run de `validate_plan.py`, typecheck ou Actions. Checks vivos de owners, paths em outras branches, contratos, CI e visual permanecem a executar somente pelos atores autorizados. **Não declarar GO** com base apenas neste arquivo.
