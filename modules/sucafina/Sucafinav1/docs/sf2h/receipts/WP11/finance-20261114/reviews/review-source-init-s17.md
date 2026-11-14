# Revisão independente — inicialização das fontes em dois fixtures WP11

**Resultado: nenhum bloqueio estático encontrado nos dois blobs exatos. A validação no Actions permanece pendente.**

Revisor: `/root/s17_fixture_init_review`. Baseline publicado: Finance W27 `332c5a762365e8550eaac7a278c864be0452651d`, tree `ace9841eefc65a9e3335fad0fe6846aaaff11f4b`. W27 altera somente documentação; seu código corresponde ao W26.

## Evidência que motivou o delta

O [run S17 43591635600](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43591635600), job `132437416020`, executou W `0c4a2545a63b4903c7eedb00d3f0989eb74ed398` por S `2b2b2eb1872d09a3a2dcee24f3f679ef4f9e7ad4`. Li o log concluído local e extraí as doze falhas destes dois arquivos: seis de Hot Topics e seis de promoção. Todas atingem `SF_SOURCE_IDENTITIES_UNAVAILABLE` no preparo da fixture, antes dos cenários e assertions correspondentes. O JSON adjunto conserva nomes, durações e SHA256 do log bruto; esses failures não são convertidos em PASS pela revisão.

## Blobs revisados

| Arquivo relativo ao package | Publicado antes | Candidato | Assertions preservadas |
| --- | --- | --- | ---: |
| `test/product/wp11/hot-topic-snapshot.test.ts` | `ad9f8aa17a1ece912132d4c2453547693697716f` | `a45ca2e3e8efd8b39f53a94615cdad1064d8fe6b` | 52 linhas |
| `test/product/wp11/promotion-coverage-proof.test.ts` | `991a7fb18f9e8e7372bd2e0193b6727ab6633b26` | `11c8bd90a9886fec96acddecba26132f3b304c1b` | 39 linhas |


SHA256 dos candidatos:

- Hot Topics: `14de70f09d592ff4d4b33b09560e5170f0bd1baf3b1cc65283249fbcde4c5628`.
- Promoção: `d997d23b4b39a353b9dbc426bc4bd276151ca1b1d3280d340c6110f3898ba6ec`.

## Causa e aderência ao produtor canônico

[`createSfSourcePersistence`](https://github.com/gustavomhss/Orchestra-SF/blob/332c5a762365e8550eaac7a278c864be0452651d/modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts) exige identidades de fonte válidas antes de chamar o callback de cada transação. `initializeSources` é a entrada canônica que cria o registro inicial usando o inventário real. O [`plannerFixture`](https://github.com/gustavomhss/Orchestra-SF/blob/332c5a762365e8550eaac7a278c864be0452651d/modules/sucafina/Sucafinav1/test/product/wp03/planner-fixture.ts) inicializa somente Planner; o [`state-provider` C08](https://github.com/gustavomhss/Orchestra-SF/blob/332c5a762365e8550eaac7a278c864be0452651d/modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts) usa Dashboard para o estado privado.

**Hot Topics:** a versão anterior tentava a primeira transação Dashboard pelo driver protegido antes de chamar `initializeSources("dashboard")`. O candidato move essa chamada para antes da transação. O commit normal continua executando `synchronizeSources` e `synchronizeScopes`; o tópico semeado passa pelo inventário canônico e pelos mesmos guards. Nenhuma identidade é escrita diretamente pelo teste.

**Promoção:** a versão anterior usava o C08 Dashboard sem inicializar seu registro de fontes. A chamada adicionada ocorre imediatamente depois do `plannerFixture(initial)`, antes das admissões e do seed C08. A classificação, o reassessment, a comparação dos digests e as negativas de prova/revogação/fonte/caso permanecem nas implementações reais anteriores.

## Preservação conferida

Reconstruí os dois arquivos anteriores em memória removendo apenas as adições e revertendo a movimentação da inicialização. Os resultados são byte idênticos aos conteúdos publicados capturados de PR40; seus Git blobs também coincidem com `remote-state.json`.

Os corpos de todos os testes são byte idênticos. Permanecem os doze casos expandidos, 91 linhas de assertions, as duas ordens de fontes, os callbacks de corrida, as admissões humanas privadas, as evidências, os observadores de fonte, os comandos oficiais usados nas corridas e os corpos de cleanup. Hot Topics conserva a ausência de timeout explícito; promoção conserva os dois literals `60_000` de suas declarações parametrizadas. Nenhuma assertion ou timeout foi afrouxado.

Os quatro arquivos canônicos consultados também coincidem com os blobs publicados: lifecycle `d0cab7f33b08806a6bb01a869fa789dc77e087ee`, inventory `1b183b82758f8f49954a5038b675bb784fc89915`, C08 provider `b7988a2963a2797a96ea19ab2b3a481564548213` e Planner fixture `19cb4262ca02a680b06cdd4db54d5bb9d33a1219`.

## Limite da conclusão

Esta revisão confirma a causa de inicialização e a preservação estática do escopo. Não demonstra que os cenários passam após a correção; o próximo run deve executar os dois arquivos nos blobs publicados finais. O teste de Hot Topics continua sendo um draft privado, e promoção continua sem criar uma escolha ou aplicar um comando por consequência automática.

Foram realizadas apenas leituras, comparação textual e hashes. Zero imports ou execução de produto, Bun, testes locais, typecheck, guards, dispatch de CI, consultas/escritas remotas ou edição de arquivos do repositório pelo revisor. Não há aceitação de critério, prova nativa, C/D ou declaração READY/DONE.
