# W04 / F03 — handoff à integradora 114

**Estado: patch de autoria independente completo e INERTE; OUTPUT NÃO ADMITIDO.** Sessão real GPT-6, rótulo pedido Astra; branch `sf-ux-w04`, epoch `ux-native-w04-e1` ainda reservada. ACK antes de material: [c3f567a](https://github.com/gustavomhss/Orchestra-SF/commit/c3f567ac57d8d124573fc7762f4e681414797604). [Pedido de admissão à114](https://github.com/gustavomhss/Orchestra-SF/pull/65#issuecomment-6896814145).

## Entrega por hashes

- `F03-FULL.patch`: **oito arquivos novos** inteiros, preimages ABSENT em `sf-ux-w04` no ACK, git blob `462d1b0401009aad7ca6c689a36bfbd019648cfb`. A árvore de produto não foi alterada. O arquivo contém diffs `new file mode 100644` mecanicamente aplicáveis após admissão.
- `SHARED-I18N.patch`: **somente para 114**, três inserções exatas em `packages/app-shell/src/i18n/orchestra.ts`, preimage `2eeaa42e02a45b3301fc765c6c92635af5101079` e postimage proposto `9c1d5ef7e785e56439db5ef3b9a7d0ad2ff46dd7`. Fazer três-way/rebase se o arquivo tiver avançado; jamais sobrescrever um registry posterior.
- `MANIFEST.json`: os oito paths, SHA de cada blob, contrato, premissas, flags e gates. `ACK.json`: preflight real, comparação do protocolo e leases.
- I00/114 não deve mergear a branch inteira: ela contém o envelope documental da coorte além do patch F03. Consumir **somente arquivos explicitamente admitidos**, por blob/preimage, e aplicar patch compartilhado separado. PR draft não equivale a consumo.

## Ordem de admissão e provas

1. A114 reconcilia a própria autoridade `S0-C-e17-browser114`, HEAD/tree material, os pins `component-signatures.ts@e283b20`, `surface-manifest.json@50e2993`, `component-locks.json@818728d`, e confirma `F03/W04` sem conflito de owners. **Sem silêncio=GO.**
2. Após aceite, a114 importa os oito blobs correspondentes aos caminhos da allowlist sem writers cruzados, com pre/postimages registrados. `SfPageFrame`, `SfContextBar`, `SfChartFrame` vêm de `shared/frame/index.tsx`; `SfStatePanel` e `SfRunState` de `shared/states/index.tsx`.
3. F01 precisa fornecer os tipos opacos `SfHref`, `SfRef`, `SfVersion` a partir de `context/contracts` ao integrar; F03 os importa **apenas como tipos**, sem stub runtime. A marca `SfCopyKey` deverá convergir com o dicionário tipado do I00 sem casts permissivos.
4. A114 registra `SF_COMMON_COPY`/`SF_COMMON_COPY_BR` em `orchestra.ts` via patch, preservando todas as traduções existentes; F03 não edita o registry.
5. A119 executa compiler/typecheck/guards em Actions após composição, a120 executa `page-frame.test.ts` e testes visuais/zoom/teclado mediante autorização de despacho e SHA de produto qualificado. **Nenhum teste executado nesta sessão.**

## Limites transparentes

F03 não valida o servidor, não cria API, não decide permissão, não inventa zero nem resultado de run. Gráfico SVG específico deve vir do consumidor em `children`; a tabela e cobertura permanecem explícitas. A assinatura congelada de `SfContextBar` não oferece `labelKey` para o *controle* em si: o label atual é o `SfText` selecionado fornecido pelo produtor. A COPY-01 tampouco tem `moreActions`: o grupo mobile de ações secundárias usa `sf.common.showDetails`. A114 deve registrar decisão de UX/contrato se isso precisar de chave específica, sem mudança autônoma do freeze. `onOpenSource` não é acionado sem `sourceRef` verificável no DTO. Sem teste de contraste/zoom realizado: pendente de Action/inspeção.

**GLOBAL_RELEASE=false; source code authored, but NO PRODUCT INSTALL/CI/GO.**
