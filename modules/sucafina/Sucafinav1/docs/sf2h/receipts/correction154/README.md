# Missão 154 — A13 — handoff para 132

**Estado:** ARTIFACT_READY de fonte, **NOT_RUN** de prova nova, **NOT_CONSUMED** por 132. Não é release.

- Branch existente: `sf-ux-a13`, PR #139, epoch `ux-native-a13-e2-browser154` (ator ChatGPT, GPT-6, sessão ID não exposta).
- ACK real: https://github.com/gustavomhss/Orchestra-SF/pull/139#issuecomment-6901163035
- Fonte antes: `6c72b5d8e7cbaddf39a14f1640057488e53fe79d` / tree `a11971f849cc8d8cfcdbbd5e60948844529b84cb`.
- Correção e teste: `6bc352f8b04f575fa30f256217e92f9bd4f64862` / tree `c8b129402e7c2574976cc4fc01c23f6f47f7698b`.
- Consumidor 132 observado: `8094e599e3d18609e269548d24619a3246fbc735` / tree `b064e8c0ef63e9a3eb2bf6b699592fbdb184dee8`; os dois blobs são exatamente os preimages. Tree projetada **não publicada na branch**: `f5f5f8a424027c94bb9389659d2e4d106f2bb4a0`.
- Patch seletivo: [A13-selective.patch](A13-selective.patch) (somente duas folhas autorizadas, sem importar histórico da branch).
- Detalhes: [HANDOFF.json](HANDOFF.json); [ACK.json](ACK.json).

**Defeito real:** run 43758731378/job 132948475697, comentário #6901001279, decoder de leituras vazias aceitava `{operation: "grant", principalRef: "anyone"}`. Producer real confirma `keys: []` para `selection-version` e `recipients`. F02 usa `Schema.decodeUnknownOption(operation.input)` antes de IO. Agora as duas entradas expõem `Schema.Record(Schema.String, Schema.Never).check(Schema.isMaxProperties(0))`, com testes de regressão no decoder Sync e Option.

**Ação:** 132 reconcilia atuais preimages e aplica patch; 149 compila/gera SDK/guards; 150 executa testes cirúrgicos hospedados em candidato W novo. A13 **não** executou testes locais nem ações de integração/CI. A nova qualificação segue NOT_RUN até prova hospedada.
