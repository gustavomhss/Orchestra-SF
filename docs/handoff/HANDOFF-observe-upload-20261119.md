# Handoff — observe-upload-20261119

SHA: 5e6181b599c9ac9a7eefd9c0ed1926b342c9fec8 (código; o commit deste documento é posterior)
Data: 2026-11-19
Estado: partial

## Feito

- Inspeção somente leitura do artefato original 14579851540 do Operations8, run 44625548030. Não houve rerun, replay, upload novo ou acesso à máquina do dono.
- A auditoria 44629138826, job 135930827353, concluiu SUCCESS. Todos os stamps de contexto/CAP27 efetivamente capturados conservam installationId, projectId, hostId, principalRef, policyVersion e accessRevision. O relatório exporta apenas igualdades booleanas.
- O contexto imediatamente anterior ao upload, 22:15:38.328 UTC, aparece como HTTP 200, tamanho -1 e sem corpo no trace. Isso não comprova validade nem mudança da autoridade desse reply.
- Revisão fria identificou que o logger do renderer também deveria ficar isolado. O follow-up envolve somente os logs em try/catch, para uma exceção de diagnóstico nunca interromper o estado original de recusa. Não houve execução adicional.
- Este checkpoint adiciona somente estágios enumerados ao refresh original de files.asset.upload, mais o motivo enumerado retornado ao renderer e encaminhamento fechado desses eventos ao log do spec. Nenhum valor, header, cookie, arquivo, corpo, identificador de owner ou credencial é registrado.
- Todas as recusas, codecs, validações de stamp, igualdade de instalação/principal/política/acesso, disponibilidade e envio de bytes permanecem com o mesmo resultado. O diagnóstico não admite pedido algum.

## Pendente

- packages/client/src/sucafina/transport.ts:957 — observar o estágio efetivo do refresh no próximo gate nominal. Ainda não há causa comprovada para o upload sem POST.
- packages/app-shell/e2e/sucafina/operations-support/documents.ts:108 — a prova original de POST continua ativa; no Operations8 ela expirou antes de observar um upload. Não foi removida, pulada ou afrouxada.
- packages/app-shell/src/orchestra/chapters/sucafina/shared/attachments/bound-assets.tsx:179 — remover o diagnóstico temporário depois de isolar e corrigir a causa, preservando a mensagem e o comportamento originais.
- Este delta ainda não recebeu typecheck ou gate de produto. A auditoria acima apenas leu evidência já existente.

## Decisões e justificativas

- Asserções removidas: nenhuma. Timeouts, retries e gates: inalterados.
- A hipótese de accessRevision diferente não está confirmada; os corpos existentes mostram igualdade, e o reply decisivo não está disponível no artefato.
- Não substituímos o refresh autenticado por disponibilidade anterior, nem reutilizamos um stamp como autorização.
- Não modificamos runtime/application.ts, o scanner ou os produtores.
- A base é Assembly33 57070fcc1968090b6df188b8ea759ed5f72eefe5. O transport deste branch NÃO contém o delta separado de recuperação de escolha 175d8d2; ao compor ambos, aplicar somente o hunk refreshSfFileAuthority deste commit.

## Como retomar

1. Compor este delta de três arquivos, a correção de total numérico 460706e14903bc821aa04ab903b2526ceb69e701 e o observador de Imports 1a1d830379c810b5ff1a7500f690bfe06ff09ab7 no candidato do root.
2. Executar o gate Operations9 já autorizado, com a configuração nominal e ClamD real.
3. Ler o estágio literal sf-file-authority / sf-asset-upload. Corrigir apenas a causa demonstrada, preservar todas as asserções e remover a observação temporária.
4. Não declarar sucesso de upload sem o POST original e seus checks de bytes/scan/CAS/readback.

## Comandos e resultados

- Operations8: run 44625548030 FAILURE, 1 passed / 4 failed. Três typechecks e ClamD passaram. OP-PROC-01 passou; o upload ficou antes do POST.
- Auditoria original: run 44629138826 SUCCESS, job 135930827353. Relatório: https://github.com/gustavomhss/Orchestra-SF/blob/audit-upload8-20261119/docs/handoff/observed-upload8-authority-44625548030.md
- Typecheck / guards / test:ci deste checkpoint: não executados separadamente; serão cobertos pela composição nominal do root.
