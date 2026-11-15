# Handoff terminal 147 → única integradora 132 / PR65

**Condição:** `PRELIMINARY_FIX_FIRST`; não existe parecer R02 FINAL ou waiver. Fonte material `d8f14f81855858120f914af4f3934406bfdb74f1`, e integração lida novamente em `8094e599e3d18609e269548d24619a3246fbc735`. Não aplicar recebimentos como fonte de produto nem confundir HEAD de receipt com candidato.

## Ação exata a partir daqui

1. **132** vincular este parecer ao candidato em composição, sem introduzir mudança em `sf2-stack` por parte de 147. Registrar `ACK-147.json` e `FINDINGS-147.json` por blob; comparar source vs branch de autores, não só descrição de PR. Preservar todos os blobs e outros escritores.
2. **152/PR152 — U32/UI48/UI49:** corrigir `PRE147-R02-01` incompatibilidade para escopos diferentes de instalação/projeto (sem supor que dupla leitura cria autoridade); `PRE147-R02-02` mostrar unidade/moeda/evidenceState em before/after; `PRE147-R02-03` comparar linhagem `sourceRefs`/version/incarnation/cut e distinguir “valor inalterado” de “origem alterada”. Fornecer **patch/commit SHA, blobs antes/depois, contrato preservado**, e nenhum novo endpoint. Recheck contra `reviews/preserved/model.ts` preimage `0e3c9a84fb2b534e563bde3cbf915ecf121b6cfe`, `reviews/compare/index.tsx` preimage `ca8ac3c301df09a4932bd5b1a09994090287fb50`.
3. **157/PR157 — U23/UI55:** corrigir `PRE147-R02-04`; mudanças nos filtros de período invalidam o destino e os targets periodizados e forçam descoberta atual antes de `files.import-admit`; o host mantém validação negativa. Preimage `imports/index.tsx` blob `3f3ff8a2d307bf57fe95f3f212c230758f01297b`; entregar novo SHA/blob e cenários.
4. **132** consumir **somente** os blobs autoria dessas PRs com GitHub MCP/CAS `expected_sha`, `force:false`, e composição compatível com I00; registrar trecho source->consumer e commit integrado, sem reset/force, devmerge, deploy ou Goal. Não reivindicar achados resolvidos com comentário ou intenção de PR.
5. **149/PR107** realizar somente compilação e geração SDK autorizadas no **SHA integrado exato**. **150/PR106** executar CI cirúrgico dos oráculos `U32-AC01/02`, `U23-AC01/02`, regressões da comparação monetária/zero/missing, fronteira negativa de identidade e destino import; gravar run ID, SHA, binário/fixture, resultado e evidências brutas. Se erro, `NOT_RUN/FAIL`, nunca PASS por descrição.
6. **132** reabrir a revisão independente R02 após cortes congelados e provas admitidas; reconciliar PR100/97/98 sem duplicar findings, revalidar correções reais por SHA/path/linha e registrar pendências C/D/G7/G8. Apenas depois considerar parecer final externo, nunca nesta preliminar.

## Proveniência

- ACK real commit `a18df9c92b749e819fab68192be4a46b5c179150` (blob `c6f18f61e3eaa313a4592cf730a21119c7493e38`, tree `3bd568122b08ffd950a962527a817b6364562388`).
- 152/U32: source head anterior `969d1757d307429a6b27d35fe1091cd1024e1cfc`, integrado por 132 no material `d8f14f81855858120f914af4f3934406bfdb74f1`.
- 157/U23: source head anterior `19b0a65713287d0285b192a5f3c055a4ead6ec64`, integrado por 132 no material `d8f14f81855858120f914af4f3934406bfdb74f1`.
- Baseline histórica PR100/97/98 original `eecbdacb21734695094332deb6142aa35d5c9c3c`; não convertê-la em prova do corte atual.
- Ações reais desta sessão: GitHub MCP leitura + ACK + documentação via Git Data CAS + PR; produto/teste sem escrita, nenhum check local, sem execução/correção. Testes/CI/candidate C/D: **NOT_RUN** neste review.

`AUTHORITY`: 132 única integradora; 149 compilação/SDK; 150 CI; reviewer147 apenas receipts. `GLOBAL_RELEASE=false`, `Goal=paused`. `ACK by comment` não substitui ACK/epoch/fence reais.
