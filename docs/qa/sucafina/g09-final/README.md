# G09 — entrega técnica do candidato atual

## Resultado comprovado

O candidato **edd15e422dd8b1008a1a32ff4c8d5108e8e2e3a2** concluiu a [execução 44999398244](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44999398244), tentativa 1, com os quatro jobs em sucesso. O pacote está disponível no [artefato 14745363273](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44999398244/artifacts/14745363273).

| Verificação | Resultado |
| --- | --- |
| Testes de fonte, fallback TUI e paleta | 82 passaram, 0 falhas, 2.044 asserções |
| Typecheck de TUI, CLI e app-shell | Passou nos três pacotes |
| Compilação CLI/Web/factory, hashes e instalação temporária | Passou |
| Web instalada em Chromium e cenário Teams/C17 | Passou |
| Tree-sitter instalado para TypeScript e Python | Passou |
| Jornadas reais de terminal, usando o mesmo ELF | 8/8 passaram |
| Controles HTTP da instalação Microsoft | 53/53 passaram |
| Testes canônicos do auditor | 17/17 passaram |
| Guards após o acabamento do harness | 78 regras, 19 paths, zero gates, avisos ou erros |

Os 53 controles HTTP são 12 negativas PermissionSaved, 36 negativas de API genérica, quatro contextos Teams e uma exigência de ingresso confiável. A factory instalada recusou registro como daemon com a mensagem correta e saída 1. Quatro configurações de repositório inválidas permaneceram presentes e inalteradas enquanto as requisições Microsoft funcionaram. Sete observações não encontraram Core DB, arquivos auxiliares ou descritores desse banco; nenhum evento correspondente foi observado. Processos, listener e diretórios temporários foram encerrados/removidos.

A revisão de código cobriu a entrada Web, seleção e descoberta Teams, schemas e clientes gerados, exclusão do contexto legado na composição Microsoft, consumidores de conteúdo empacotado, entrada CLI/daemon e o delta de observações Atlas. Os três registros identificam blobs, consumidores, testes lidos e limites. Eles não alegam leitura integral de todo Atlas ou classificação de cada ocorrência automática.

## Integração concluída

As correções de produto já estavam mergeadas: [#617](https://github.com/gustavomhss/Orchestra-SF/pull/617) (fallback TUI), [#621](https://github.com/gustavomhss/Orchestra-SF/pull/621) (estado do editor antes do encerramento) e [#629](https://github.com/gustavomhss/Orchestra-SF/pull/629) (Team pendente durante refresh).

O suporte do candidato e sua validação foram mergeados em [#642](https://github.com/gustavomhss/Orchestra-SF/pull/642), commit **b60b14aee897596d56854697adb00bdc5ecce7b4**. O acabamento de sete emissões do harness foi mergeado em [#645](https://github.com/gustavomhss/Orchestra-SF/pull/645), commit **4e9beb3e209a0c85f9b73e5cf745d58c5e27d86e**.

O [CI focal 45001125294](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45001125294) conferiu a cabeça exata **61f5731e1ef18af30fb0381e44f94075e34ab61d** em checkout isolado: sintaxe válida e guards sem nenhum achado nos 19 paths do candidato. A mudança conserva os sete textos de stdout; não muda o runtime nem reconstrói o pacote.

Os pais dos merges preservam a dev concorrente **325a907d8de892c82d9b5b654db1836d73232f75**. O artefato continua vinculado ao candidato congelado; não foi reidentificado como um build da dev após os merges.

Os PRs históricos #610 e #619 foram fechados como substituídos. Branches, falhas e evidências anteriores continuam preservados.

## Identidade dos bytes

- Fonte: `edd15e422dd8b1008a1a32ff4c8d5108e8e2e3a2`.
- Árvore: `f3e59ed0a3f77400757ca3377241cebcb1afcc2e`.
- Base de produto: `babc660b2cda3e20ed6b68ecab86b973110652cb`.
- ZIP SHA256: `748e5fdf181bd37f80e51fb8206fd17e365f52a467823dbc7dc5bf21ebad9597`.
- Tar SHA256: `81b7c2ed9e54b6e1d259a270c84bb88d3048a0dec11b31a5ce436158c7adb07c`.
- ELF SHA256: `fdd56c5e1b12f238113224c041cdb3a960242ed3a98a2518d41db6e12bd2af8a`.
- Factory SHA256: `fdcb3fbc2348b3e1a8a8054c7ea518c21df504e02e60e372ae4c5c8565606297`.

## Estado do aceite formal

**O auditor canônico retorna DIAGNOSTIC_UNQUALIFIED. FormalG09Pass continua false.** O sucesso dos jobs demonstra as verificações executadas; não representa a assinatura que o auditor exige.

O inventário preservado registra 19.914 ocorrências e 3.170 lacunas de alcance, com zero disposições canônicas. Esses registros não equivalem a 23.084 defeitos confirmados. Tampouco o contador activeLegacy 0 comprova ausência global de legado: o inventário ainda não recebeu a classificação autenticada.

Os bloqueios exatos são: revisão independente vinculada à fonte ausente, ocorrências/alcance sem classificação e envelope de obrigações executadas ausente. O briefing operacional exige revisão e provas em dois envelopes completos autenticados por autoridades provisionadas independentemente do candidato. As revisões diretas aqui registradas não foram convertidas nesse catálogo completo, e nenhuma chave ou identidade de signatário foi inventada.

A execução usou Entra/Graph controlados e o produto instalado em ambiente temporário. Não é certificação de tenant real ou implantação Azure. O modo opcional de mapas externos exige dist novo; uma segunda invocação no mesmo dist falha de modo fechado com EEXIST.

## Arquivos da entrega

- [delivery.json](delivery.json): identidades, merges, métricas, artefatos e limites.
- [source-tests-receipt.json](source-tests-receipt.json): arquivos/hashes, nomes dos casos e resultados.
- [installed-host-receipt.json](installed-host-receipt.json): 53 controles, configuração inválida, processo, banco e limpeza.
- [tui-journeys-receipt.json](tui-journeys-receipt.json): oito jornadas, bytes e identidade de execução.
- [harness-guard-receipt.json](harness-guard-receipt.json): acabamento e gate final sem achados.
- [canonical-inventory-status.json](canonical-inventory-status.json): estado canônico real e hashes do inventário.
- [web-contract-content-review.json](web-contract-content-review.json), [cli-authority-review.json](cli-authority-review.json) e [memory-delta-review.json](memory-delta-review.json): revisões de fonte por fronteira.

Os JSON de execução foram transcritos ou extraídos dos logs GitHub. Os arquivos originais e traces completos permanecem nos quatro artefatos identificados em delivery.json, com retenção até 22 de dezembro de 2026. Os registros de fonte são observações sem assinatura; o conteúdo desta pasta não é um envelope autenticado.
