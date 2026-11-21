# Integração do bloco de quinze áreas

**Status: VALIDATED_FOR_INTEGRATION.** O usuário autorizou: “Vai pro merge, se tiver tudo verde”. As verificações abaixo passaram. O [PR #587](https://github.com/gustavomhss/Orchestra-SF/pull/587) registra o estado e o commit do merge; este documento registra a autorização e a prova anterior à incorporação.

## Composição verificada

- Branch: `sf-design-fifteen`, criada originalmente de `dev acc0181508ceda7416bce57284b2307a9b20385b`.
- Entrega apresentada ao usuário: `4a796bba4af7e0d3ee4e7d3945d3841419832903`.
- Base incorporada: `dev 2a68bcb676ed0c159c5c48130c2413e0e5637a00` — seis commits e 35 arquivos desde a base original.
- Candidato testado: `141336f8b17fe661cb0370ef99a7ff528737ef23`; árvore Git `9c168f02d61c0de337753aa37d76717f5b56d99f`.
- Árvore nativa Sucafina: `3213aecbbd258b9c00bd22f7f7dc19c046786e61`; registro de rotas inalterado.
- A composição inicial preservou os 35 arquivos da dev e os 261 arquivos da entrega, incluindo os modos dos arquivos. Não houve sobreposição ou renomeação. O ajuste posterior ficou em um bloco da spec financeira; nenhum código de produto foi alterado para fazê-la passar.

A dev incorporou #577 e #578 depois da revisão original. #578 acrescenta o estado opcional busy ao componente compartilhado de revisão; por isso repetimos todas as jornadas do bloco e das seis áreas anteriores. O entrypoint de Sourcing veio da dev e foi atualizado no inventário, sem contar CAP25 como área retrabalhada desta campanha.

## Jornadas reais na composição

| Jornada | Run | Resultado | Capturas completas |
| --- | --- | --- | ---: |
| Pessoas e Portfólio | [44954159569](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44954159569) | 2 passaram · 3.9m | 58 |
| Finanças e Planner | [44954850512](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44954850512) | 2 passaram · 4.0m | 47 |
| Serviço e Segurança | [44954168895](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44954168895) | 2 passaram · 2.7m | 23 |
| Riscos, Stakeholders e Performance | [44954172715](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44954172715) | 3 passaram · 4.1m | 24 |
| Operações em português | [44954176866](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44954176866) | 1 passaram · 1.8m | 25 |
| Regressão das seis áreas anteriores | [44954180769](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44954180769) | 2 passaram · 6.5m | 67 |

São **10 testes do bloco e 2 de regressão**, todos verdes. As jornadas do bloco verificam **11 gravações com releitura da fonte**. Nenhuma confirmação de exclusão foi executada. Os cinco grupos do bloco registraram diagnósticos sem erros de console ou de página. As 177 capturas do bloco e as 67 da regressão estão completas, sem preview pulado. A galeria permanente conserva suas 177 imagens originais; as imagens da nova execução não são contadas como áreas ou estados adicionais.

Os snapshots, jobs e artefatos completos, com digests e prazos, estão em [MERGE.json](MERGE.json). Todos usam a instalação nativa isolada e os produtores originais; nenhuma autenticação, permissão ou resposta de domínio foi simulada.

## Gates técnicos

[Run 44954855228](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44954855228), job `137000586437`, snapshot `16ba1fbbd7fa3369cc051b3bb37d7cd90cbc16e7`, no candidato `141336f8b17fe661cb0370ef99a7ff528737ef23`:

- Tipos da aplicação e E2E: PASS.
- Guards: **78 regras, zero erros, zero approvals**; 24 avisos de timeout dos E2E, sem bloqueios.
- Paleta: sete arquivos gerados byte a byte iguais.
- CAS: três casos; DTO de contratos com Solid no browser: quatro casos; zero falhas.
- Seis checks do wrapper: PASS. O wrapper de snapshot só atualizou a constante da base para a dev incorporada; os mecanismos de CI e guards permanecem iguais.

## Falha encontrada antes do merge

A primeira execução financeira, [44954163996](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44954163996), teve um teste aprovado e um reprovado. A asserção HTTP passou, mas o Playwright não conseguiu obter o corpo da resposta CAP19 pelo CDP depois de aguardar o clique. A execução foi tratada como falha e impediu o merge.

A leitura e as duas asserções da resposta agora começam assim que a promessa da resposta resolve, em paralelo com o único clique. Foram preservados o mesmo filtro de requisição, HTTP válido, body ok, exatamente um POST, fechamento da revisão e releitura do registro pela entrada nativa. Não houve retry de comando, supressão de erro, aumento de timeout ou alteração de produto. O evento interno exato que retirou o body do CDP não foi estabelecido; não se afirma abort do comando. A nova execução financeira passou integralmente.

Como o delta posterior à composição é somente a spec financeira, a evidência dos demais cinco grupos permanece válida para o candidato final. Os gates foram repetidos após o ajuste. Alterações finais de aceite e documentação mantêm o código executável e as specs idênticos ao candidato testado.

## Contagem e limites preservados

A campanha contém **21 áreas implementadas e aceitas para integração, de 70**, e **49 por retrabalhar**. Seis foram mescladas antes deste PR; quinze pertencem a esta integração. O registro do merge fica no PR, sem antecipar seu resultado no commit que o precede.

O bloco mantém 15 áreas, 56 padrões de rota, 88 estados funcionais, 79 estados fotografados, 177 imagens e 98 variantes. Nove estados financeiros não possuem captura dedicada. Reflow de 320/390 CSS px não é zoom real; outros navegadores e uma matriz completa de falhas/revogação não foram qualificados. As indisponibilidades e as ausências de fonte continuam explícitas.
