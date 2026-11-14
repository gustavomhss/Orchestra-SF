# UI recipient ACK — handoff terminal

**READY_FOR_INTEGRATION do delta UI.** Há implementação e evidência composta para 12 cenários funcionais distintos. O typecheck do package permanece **FAIL** por nove diagnósticos externos. A instalação da closure completa no host é intake de Collaboration/Composition; não há DONE global.

## Continuidade e autoridade

Mesma `ui-work` / [PR47](https://github.com/gustavomhss/Orchestra-SF/pull/47), base `interface-resume`. Head inicial reconciliado: `79ebf5555eddaa4b5b8b57cbe1df7c5ad22b1244`, árvore `d0508747f0818b3467f44bac845ca6a878bdb7ea`. O handoff terminal anterior e todos os commits/recibos foram preservados. A nova atribuição do usuário autoriza esta sucessão; não foi inferida de silêncio.

Missão em `5e5c6b6ad29b985376880b4da40cb51c7424849b`; COMMON em `c708ec0609dbfc95b259707d8c38481617f74f11`; pack completo S1-A e anexos no planning SHA `dbf9547211d9b0fade619790de7c19c0869b7c7d`; CI em `a3d29d011ba3607a57914701300f09117a3e2de9`. Inventário em [inputs.json](inputs.json). Escopo da campanha 15 WP / 74 tasks / 17 contratos / 1610 critérios intacto.

Única alteração de produto: `product/ui/work-collaboration.ts`, blob **d9362a92e0bc71c8068790bf308e2a88adcb3243**. Testes/helpers novos e recibos estão somente nos prefixos autorizados. Nenhum merge, reset, force, branch de produto ou PR adicional. Apenas refs técnicas efêmeras do protocolo CI.

## Comportamento entregue

O ACK recipient exige o receipt real da intenção original: kind/action, principal, chave idempotente, thread, commandDigest, intentDigest e mensagem única por id/incarnation/version. A sourceIncarnation deve coincidir com a mensagem identificada. A projeção corrente, texto/autor iguais, posição ou quantidade isolados não reconhecem a operação.

A tentativa incerta conserva body/chave/expectedStorageVersion em sessionStorage da aba, com escopo de origem/mount, instalação/projeto/policy, principal/revisão de acesso, caso/incarnation e thread. O prazo de 30 minutos é verificado em mount/restore/retry. A recuperação só renderiza após leitura real de thread e GET de caso autorizados; o retry é explícito. Não há autosend nem conteúdo em URL/logs/histórico.

ACK válido limpa a tentativa; revogação, escopo divergente, envelope inválido/expirado e conversa ausente em página que monta o script purgam conforme o contrato local. Epoch/AbortController impedem respostas antigas de ressuscitar estado revogado. pagehide remove conteúdo protegido; pageshow persistido pede nova navegação GET. A prova desse lifecycle usa eventos sintéticos e navegação real, sem reivindicar BFcache nativo.

Replay de uma resposta cujo thread já foi resolvido conserva estado/histórico e não duplica mensagem. O caminho ordinary-thread mantém o snapshot C08 aprovado. **ACK C03 não é confirmação C06, attachment nem aprovação financeira.**

## Produtor realmente consumido

`collab-resume@62e5629dbf31be2bb662dda152c96021f22b0ca5`; `recipient-actions.ts` blob **22c6309c61b27b89914086a7602bf3bea61a988b**; contrato blob `b007f61c444af37a4fcb788bd512baad34b7071a`.

A fixture própria preserva os bytes publicados verbatim e compõe o factory com SQLite/C08, autoridade, fontes e HTTP reais. O loader verifica quatro dependências e reloca somente os seus specifiers de import no input de compilação; não altera algoritmo ou produtor. [producer-manifest.json](producer-manifest.json) e [producer-manifest.02.json](producer-manifest.02.json) documentam a closure. Não há receipt fabricado em caso positivo.

A rota HTTP retida já devolve o resultado do port e serializa mutationReceipt, sem patch necessário. O host retido não incorpora toda a closure publicada, particularmente callbacks C05; produto/host/rotas estrangeiros ficaram readonly. [owner-intake.json](owner-intake.json) e [owner-intake.02.json](owner-intake.02.json) contêm preimages e a próxima ação: Composition deve compor a closure completa com este consumidor e provar a jornada no host instalado.

Validação anterior do produtor foi lida: run43628901092 teve 20 pass / 0 fail; o follow-up43630483191 teve 3 pass / 0 fail / 5 filtered. Nenhum deles é promovido a prova de recuperação browser.

## Candidatos e resultados reais

| Tentativa | W / árvore | S / árvore | Run / job / resultado |
|---|---|---|---|
| 01 | `7c9bbd966483b94d21a4c30961a8174be7ed6804` / `6c55ee7399780575a61af242e79676a472d038af` | `5ef3284a31973be8e3c14c8db23887574754a657` / `00a2da15699e759733003ef9c788da43acf41c6e` | [43632801654](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43632801654), job132562905431: **failure**, 3 pass / 12 fail / 30 assertions |
| 02 | `359ab99db8aaec23e885b492876bc0a3df3d0a33` / `9793849ac18d0c664fabfec49e7e3b3a9ffd0605` | `d482772e85f117e95f70dbaabed7b0518e9f5b1e` / `eeda391d690537249607f294afaf32b1f0556b2c` | [43633483813](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43633483813), job132565093216: **failure**, 11 pass / 3 fail / 308 assertions |
| 03 | `d8524169e0de188312f6c2d3b6877562c47e664d` / `3ee21c140ca1647ed36989bd2203c1134eec08d6` | `a53551af20e1476173cbeed8b54ae8f61c9872fe` / `ea77baf645e92d06e4cded0123de5337506cd311` | [43634168745](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43634168745), job132567207864: **failure**, 6 pass / 1 fail / 113 assertions |

Cada S é filho direto do W correspondente e difere apenas em `.ci-run.json`. Os blobs de produto/testes/config/fixtures são idênticos W→S. Requests exatos em `ci-request.01/02/03.json`; recibos [run.01.json](run.01.json), [run.02.json](run.02.json), [run.03.json](run.03.json) preservam seleção, dedupe, hashes dos logs, jobs e limitações. Nenhum teste local, epic ou full suite; no máximo um run da missão em voo.

No run01, ordinary/startup/lifecycle passaram; onze recipient não chegaram às assertions por import relativo do loader. No run02 o loader corrigido permitiu nove recipient PASS; a prova gated de lifecycle e o matcher do erro503 falharam. Essas duas provas foram corrigidas sem alterar a UI ou elevar timeout. No run03, os quatro cenários dos arquivos afetados passaram; a única falha remanescente é typecheck externo.

### Matriz funcional consolidada

| Casos distintos | Evidência válida |
|---|---|
| Ordinary-thread: perda pós-commit, mensagens iguais, retry/reload sem duplicação | 1 PASS no run01, reutilizado com blobs idênticos |
| Intenção/payload/versão divergentes; escopo project/policy; 12 variantes de receipt inválido; detach+revoke; Boolean C08 persistido; edição exata; revogação/troca de principal | 7 PASS no run02, reutilizados com closure idêntica |
| ACK exato entre mensagens iguais; lifecycle; SQLite reopen/reload/replay resolvido; troca de encarnação física da fonte | 4 PASS no run03 |

**12 casos distintos sustentados por três runs**, não uma execução única com 12 passes. [test-matrix.json](test-matrix.json) registra input/ação/oracle de cada caso e dos 12 subcasos negativos. [blobs.03.json](blobs.03.json) prova o reuso: após W1 só mudaram loader/testes recipient e recibos; após W2 só mudaram os dois arquivos revalidados e recibos. UI, ordinary, refusal e suas respectivas dependências permanecem idênticos.

## Gates e pendências externas

Run03: guards exit0, 78 regras / 948 paths / 0 gate / 54 warnings / 0 errors. Omni positive control PASS, quatro spawns e zero delegated. Browser encerrou sem contexts/processos pendentes. Esses resultados não transformam o typecheck ou o run em green.

Typecheck exit2, nove diagnósticos externos e zero nos own paths:

| Owner / arquivo | Preimage | Falha |
|---|---|---|
| Host nativo — `apps/cli/src/sucafina-product/host-context.ts` | `4aca959eaba4f30aa7ee4f89eb95030afc2fa02b` | Cinco TS2322 em 193, 225, 281, 404 e 420 |
| WP07 — `test/product/wp07/review-port.test.ts` | `0b10585a9ea34b26a132816a4e56670ac5de23a8` | Quatro TS2739 em 40, 45, 56 e 221 |

Preimages iguais ao baseline e diagnósticos completos em [external-typecheck.01.json](external-typecheck.01.json). Encaminhamento durável por arquivo/descrição desta PR; nenhuma mensagem externa. Owners corrigem seus próprios paths sob suas autoridades.

Uma página de saída/erro que não monta este módulo não executa seu purge. Source-replacement prova recusa e ausência de renderização, não purge na página503. O shell owner conserva os eventos globais de revogação. A recuperação aqui nunca renderiza conteúdo sem autorização fresca.

## Envelope final e próximo consumo

Este fechamento acrescenta somente dados evidenciais UTF-8, sem alterar os blobs testados de W3. A lista finita e hashes estão em [delivery-index.json](delivery-index.json); o índice não inclui o próprio hash. O guard final usa o teste existente `ui-split/ui-work/guards.test.ts`, request [ci-request.04.json](ci-request.04.json). **O SHA do commit documental, seu S e run/job/resultado do guard serão publicados externamente na descrição da PR47**, após gravar e verificar o envelope. Não se edita este handoff para gravar seu próprio SHA ou resultado posterior.

O consumidor reconhece o contrato publicado no recorte comprovado; a próxima ação é a composição pelo owner, seguida da jornada de host instalado e resolução dos erros externos. Os critérios afetados em [validation.json](validation.json) recebem evidência apenas no recorte ACK. Não se concluem WP01 inteiro, G03, C06/reuso/attachment, C05 instalado, native/AM01–AM06, BFcache nativo ou GLOBAL_RELEASE. Revisões auxiliares participaram de implementação/testes; não são as três aprovações finais independentes de um mesmo C.

