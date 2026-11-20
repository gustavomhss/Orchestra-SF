# HANDOFF — sf-ops-current-artifact-audit

## SHA e estado

- Branch autorizada: `sf-ops-current-artifact-audit`.
- Base: `12dd4126441861fb62f9306a3fa7ff0a1b47c656`, reader Operations2 já executado.
- SHA de código: `874dc5d52e012a8c12c435bd093caff0c54bf6bf`.
- Tree de código: `6315b4be794dece64a2b8b4075e0d06febde1c2a`.
- Estado: **PARTIAL — adaptação publicada, ainda sem execução Actions**.
- Nenhum PR, merge, workflow dispatch, ci-run snapshot ou rerun foi criado nesta entrega. O integrador centraliza a próxima leitura.

## Fonte original fixada

| Campo | Valor |
| --- | --- |
| Repositório / id | gustavomhss/Orchestra-SF / 1455724710 |
| Workflow original | 416464764 — .github/workflows/test-ci.yml |
| Run / attempt | 44662419134 / 1 |
| Snapshot | 9ea42e72f6aebed5685cd5b2b48df993a1e8f33d |
| Parent de produto | 69340e89c46825b6556d36e8d6a09dce2122c901 |
| Artefato / nome | 14596666417 / playwright-ubuntu-24.04-1 |
| Tamanho do artefato | 68608517 bytes |
| Digest declarado pelo GitHub | sha256:28ca71a87e76cb8fc85cb370d0da714b5d8e8503f574b396c192c7efa4cd5cd3 |

[Run original](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662419134), job de produto `136043588889`: failure; 1 passed / 4 failed. PROC-01 passou. PROC-02 (`operations.spec.ts:18:3`) e PROC-03 (`:23:3`) registraram timeout global de 60000 ms sem stack do await interno. Esse é o limite atual da evidência de log; `runtime.ts:176` ainda não é uma localização comprovada da falha.

## O que mudou

- `apps/cli/audit-operations-retained.node-smoke.mjs`: reaproveita o parser limitado do reader verde e troca somente os pins de fonte; acrescenta leitura de ações dos traces originais de PROC-02/03.
- `.github/workflows/test-ci.yml`: mantém trigger, matriz, permissões, Actions pins e seletor exato do reader. Atualiza os pins e acrescenta GET de metadata do run para verificar repositório, workflow, SHA, attempt 1, evento push e conclusão failure antes do download.
- `docs/handoff/HANDOFF-sf-ops-current-artifact-audit.md`: este checkpoint. A adaptação de workflow é temporária para diagnóstico, não uma alteração destinada à integração de produto.

A validação do request/runtime original agora ocorre sempre, inclusive quando houver HTML admissível. Exige SHA, Linux/x64, package app, directory packages/app-shell, runner Playwright, config de produção e somente operations.spec.ts; exige os cinco casos nas linhas originais, Chromium e retry zero.

Para cada um de PROC-02 e PROC-03, exige resultado timedOut e um único attachment trace ligado ao path original publicado no log. Só abre `test.trace` e `[N-]trace.trace` dentro desse ZIP. Os limites existentes de tamanho, quantidade de entradas e expansão permanecem; leitura de caminhos ambíguos ou simbólicos falha fechada.

## Saída permitida e ordem real

- Mantém somente fases fixas de Operations, categorias/APIs enumeradas, comandos CDP enumerados, tempos numéricos e stack frames de arquivos de fonte autorizados.
- Descarta DOM, recursos, arquivos network, stdout/stderr, logs e outros tipos de evento antes do parse. Não emite URL, seletor, headers, payload, corpo, mensagens arbitrárias ou credenciais.
- Usa before/after do `test.trace` no mesmo relógio. Liga class.method e o nome do comando CDP ao passo somente pelo stepId gravado no trace original.
- Emite últimas chamadas iniciadas/concluídas antes do erro real e chamadas abertas nesse instante. Não confunde DFS do relatório com ordem temporal.
- A implementação oficial Playwright 1.59.1 registra `type:error` sem timestamp: a fronteira usa a posição original no stream e declara `time: not-recorded`. Não fabrica um timestamp para esse evento.
- Um await em Promise comum pode não estar representado no trace. A saída declara `unrecordedPromiseAwait: not-inferred`; nenhum file:line é inventado para completar essa lacuna.
- O reader lê arquivos retidos. Não importa produto, abre browser, executa replay, refaz comando ou realiza rede. A rede do workflow é somente download/metadata autenticada do artefato GitHub fixado.

O digest acima é do artefato Playwright, não do pacote de distribuição. O parser recebe arquivos extraídos; não afirma recalcular o SHA do ZIP externo. O download permanece na Action oficial pinada já usada pelo reader verde.

## Verificação e limites

- O reader anterior passou no diagnóstico [44662154584](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662154584), snapshot `7412b83b83a67b78b567214c5238978725ba43a1`. Isso é proveniência do leitor de relatório, não qualificação desta ampliação para trace.
- Fonte oficial consultada: [Playwright testTracing.ts v1.59.1](https://github.com/microsoft/playwright/blob/v1.59.1/packages/playwright/src/worker/testTracing.ts), blob `65367a1062df201245244349c01eb6a65ac791d6`; [tracing.ts](https://github.com/microsoft/playwright/blob/v1.59.1/packages/playwright-core/src/server/trace/recorder/tracing.ts), blob `7b0239d53341d0f1d97455d59c90959a7d6b71d1`. A versão 1.59.1 foi conferida no package.json do snapshot original.
- Revisão e comparação de texto por GitHub concluídas. Execução da adaptação: **pendente**. Nenhum resultado causal novo é atribuído a PROC-02/03 antes da leitura real.
- Guards, sf-ci, baseline, pacote e sha256 de pacote: não produzidos por este diagnóstico. Nenhuma aceitação de produto, GO, deploy ou SF_ORCHESTRA_WEB_PACKAGE_VERIFIED.

## Como retomar

1. O integrador revisa o SHA de código e o diff dos dois arquivos. Conferir pins, allowlists e ausência de conteúdo privado na saída.
2. Criar uma única seleção existente `package=cli, runner=node, args=[audit-operations-retained.node-smoke.mjs]`, em ci-run-* sem [skip ci] no snapshot. Não executar Operations novamente nessa leitura.
3. Registrar run/attempt/source e somente as linhas sanitizadas `AUDIT_OPS_RETAINED_*`. Separar sucesso do reader de qualificação do produto.
4. Usar a última chamada/stack real para localizar a causa. Se o trace não contiver o await, registrar unbound; não atribuir automaticamente o timeout a `captured.promise`, bridge, codec ou servidor.
5. Somente após causa concreta e correção correspondente, o integrador pode preparar o próximo gate de Operations, respeitando a economia de CI.
