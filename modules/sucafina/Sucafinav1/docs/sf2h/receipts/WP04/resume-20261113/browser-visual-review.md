> **Validação final pelo integrador:** produto `dae18b4f43f0daecf46264e876810025684a919d`; Bun 257 pass, Playwright 10 pass, zero falhas/skips/retries, geração oficial e typecheck aprovados. Recibos e escopo em [ci-evidence.json](ci-evidence.json). O texto histórico abaixo conserva a atribuição e o estado da revisão em sua data; estes resultados hospedados não são atribuídos a execução pelo revisor. Permanecem 10 limites nativos e 4 observações humanas.

# WP04 — revisão visual dos artefatos hospedados W8

Produto `dae18b4f43f0daecf46264e876810025684a919d`, tree `ceb9615bb5bbd5f829d2e9569a2797e3124236a5`; snapshot `23f527266a8bf0da2c015624d40db417e2d9bb80`. [Run 43534795463](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534795463), job `132261059694`, conclusão success. [Artefato 14088094597](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534795463/artifacts/14088094597), nome `playwright-ubuntu-24.04-1`, 1.850.222 bytes, SHA-256 `379a94caec10edce2da7afb7f5d0e376eaefbb05f92db93c7cf535962b0c6d84`.

O integrador baixou o ZIP pelo GitHub MCP, calculou seu hash e ligou report, seleção, request e anexos aos membros do arquivo. O resultado é **10 pass, 0 fail, 0 skip, 0 retry**, 1 worker, dois arquivos: oito casos de Procurement no host HTTP/SQLite/C02 real e dois casos isolados do controller. Nenhum teste foi executado localmente. Este parecer decorre da inspeção das imagens já produzidas no CI e da leitura do relatório/observações e das assertions executadas; não é uma sessão interativa adicional nem um teste com participante humano.

## Imagens inspecionadas pelo integrador

| Anexo | Observação visual e relação com o teste |
| --- | --- |
| `keyboard-422.png` | O campo Justification está focado e possui mensagem de obrigatoriedade adjacente. Os campos preenchidos continuam visíveis; a verificação dos valores completos e do HTTP 422 vem das assertions. |
| `cas-explicit-review-step.png` | Tabela comparativa legível e botão explícito “Use reviewed version and keep my entries”. A captura está rolada até a escolha; a versão 2 e a contagem de um POST anterior à escolha constam da observação e das assertions. O cenário confirma que os três formulários save não confundem a seção revista. |
| `approval-comment-preserved.png` | Comentário digitado preservado, aviso de ação indisponível e versão atual 3. O botão antigo continua desenhado no formulário preservado; a recusa de reaplicação e a ausência de segundo POST são comprovadas pelo teste. A imagem isolada não concede autorização. |
| `later-edits-preserved.png` | Description mantém “Later edits remain unsaved” e foco após a resposta tardia. O valor já persistido é distinguido pela leitura/assertion do host, não pela imagem sozinha. |
| `abc-submitted-comparison.png` | A/B elegíveis, C não conforme; 32400 USD para A e 28000 EUR/30240 USD com FX submetido 1.08 para B. Pesos 60/40, componentes e justificativa visíveis; texto identifica prêmio de 2160 USD (7.14%). As colunas finais da tabela ultrapassam a porção capturada; não se alega que toda a tabela cabe nesse viewport. |
| `queue-keyboard-filter-restored.png` | Filter All e busca PR-2026-0001 visíveis após navegação por teclado. O registro e seus fatos C02 ficam abaixo do recorte; o valor preservado de 32400 é prova das assertions DOM, não desta imagem do topo. |

O integrador não observou sobreposição que impedisse o uso dos controles visíveis nesses recortes. Capturas roladas e controles com largura limitada não substituem a conferência dos valores completos feita pelos testes. Este parecer não qualifica responsividade em outros viewports, acessibilidade integral ou tempo de compreensão humana.

## Complemento de revisão dos outros cinco anexos

As imagens de revalidação bancária, viewer, fornecedor reativado, PO e retorno após Reset foram inspecionadas pelo autor do teste UI em revisão separada, preservada em `browser-ui-review.md` (fonte SHA-256 `7f7e84d9d72a5162dee9de25ec70e1acd246eb1f92aa303ef1b7982b6e6b5ed2`), com autoria e limites próprios. A imagem de retorno após Reset coincide com o topo de Requests capturado no caso de filtro; não é tratada como prova visual da tela Settings ou da taxa de câmbio. A prova comportamental depende das respostas HTTP, leitura autorizada e assertions observadas no mesmo run. O parecer registra o rótulo read-only `tradingName` como detalhe residual de apresentação, sem falha funcional demonstrada no recorte.

## Limites preservados

Todas as onze observações JSON anexadas mantêm `humanTimingMeasured: false`. Os quatro critérios humanos permanecem `NOT_RUN_HUMAN`; as capturas não medem se uma pessoa compreende a decisão em 30 segundos. Os dez critérios nativos permanecem `BLOCKED_NATIVE`: host de teste, cookies sintéticos e controller isolado não representam SessionV2/SkillLoadReceipt ou transporte MCP empresarial reais.

Os hashes individuais e membros exatos dos onze PNGs e onze JSONs estão no relatório normalizado de testes e no índice de observações do integrador. Os corpos brutos, stdout, cookies e URLs assinadas ficam fora da publicação dos recibos.
