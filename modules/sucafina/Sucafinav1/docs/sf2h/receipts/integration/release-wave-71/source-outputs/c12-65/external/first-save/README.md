# Primeiro save / lost-register — proposta externa para60

**NOT_APPLIED / NOT_RUN / NOT_TYPECHECKED.** Os três arquivos de produção abaixo não pertencem ao lease65. Este diretório contém seus preimages e postimages completos, diff integral e manifesto; não fornece código executado por nenhum teste. O integrador60 deve reconciliar o head de destino e obter a autoria adequada antes de integrar. O consumidor de UI pertence a52.

## Semântica e lacuna atual

O finding histórico `IR-EXT-FIRST-SAVE-LOOKUP`, em `docs/sf2h/receipts/ui-split/ui-recovery/{handoff.md,findings.json,patches/README.md}`, refere-se ao primeiro registro de um rascunho de Hot Topic. Antes de receber `draftRef`, a UI conserva apenas `{ caseRef, key }`. Após reload, não possui o corpo privado necessário para repetir `register`. O teste histórico de dois rascunhos reais com texto igual comprovou o bloqueio seguro, sem qualificar recuperação.

Na base `7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85`, o store oferece `register`, `readCurrent` e `list`; o host Dashboard repassa essas três portas. O HTTP Dashboard oferece as rotas `draft`, `drafts`, `operation`, `prepare`, `review` e `apply`; o HTTP Decisions genérico oferece registro/lista/leitura por `draftRef`. Não há lookup do resultado por chave original. `list`/`discover` não correlacionam a chave e `readCurrent` exige uma identidade que ainda não chegou ao cliente. O dispatcher genérico não cria essa capacidade ausente.

Os novos testes65 `first-save-register.test.ts` foram escritos para exercitar separadamente a criação canônica do caso e o retry de `HotTopic.register` com o **corpo original retido**, depois de perda do ACK de um commit C08 real e reabertura de SQLite/serviços sem reseed. Seus resultados devem ser lidos no recibo hospedado W/S da missão; a autoria dos testes não é PASS. Eles não qualificam este endpoint proposto, a UI sem corpo, ou reinício do processo Orchestra. Nenhuma escolha, recibo de aplicação ou aprovação financeira é semeada.

## Contrato proposto

`POST /sf/dashboard?sf=dashboard-hot-topic-draft-outcome`, com corpo fechado `{ caseRef }` e o `Idempotency-Key` original. O mount real continua configurável pelo host. A rota reutiliza a admissão humana `decisions.edit`, a origem e a identidade atuais. O host conserva a identidade de comando `sf-human:decisions.edit` usada pelo registro; o cliente não calcula essa identidade e não apresenta um lease serializado.

O store procura exclusivamente a transação C08 de preferences indexada por principal, caso e `hot-topic-draft:<operationIdentity>`. Confere a encarnação do estado, namespace, scope digest, alvo, principal e resultado fechado. O `draftRef` vem desse resultado, nunca da ordem da lista, texto, título ou alvo de outra intenção.

A proposta é intencionalmente limitada ao **primeiro registro**, `version=1`, `expectedVersion=0`, sem `draftRef` anterior. O rascunho protegido contém todos os campos necessários para reconstruir o digest do pedido original e compará-lo ao `commandDigest` da transação. Essa reconstrução não cria autorização. O método exige a admissão humana atual e as fontes atuais antes de devolver o ACK original `{ draftRef, version }`.

Uma alteração legítima posterior da versão do caso é admitida apenas se o caso conservar a mesma encarnação, participação e escopo pertinente do draft. O pedido de lookup conserva a referência da intenção original. Um draft já avançado, alvo substituído, mudança de política/escopo, recibo ausente/inconsistente ou revogação mantém indisponibilidade/recusa; ausência nunca chama `register`.

A última leitura C08 confere juntos os bytes do caso, transação, histórico e draft ativo, além do fence síncrono de fontes Dashboard sob o snapshot atual. Não há callback de domínio após essa retenção. A resposta contém apenas o ACK; não inclui campos privados do rascunho nem o comando original.

## Arquivos e integração

| Arquivo | Delta proposto |
| --- | --- |
| `modules/sucafina/Sucafinav1/product/decisions/hot-topic-draft.ts` | `lookupFirstSave` somente leitura, concessão explícita opcional e fence síncrono obrigatório para esse lookup. Callers sem as duas dependências continuam fechados. |
| `apps/cli/src/sucafina-product/dashboard-decisions.ts` | Concede o lookup por `human.authorize(..., decisions.edit, payload)`, conserva o ambiente real e fornece a verificação de fontes no snapshot. |
| `apps/cli/src/sucafina-product/dashboard-http.ts` | Rota privada com body fechado, admissão existente, reautorização e mapeamento de status existentes. |

Os preimages têm bytes idênticos aos três blobs do manifesto, também reconferidos pela branch `c12-recovery-proof` durante a missão. O diff foi gerado dessas imagens exatas; não foi aplicado ao produto ou usado como import de teste. Revalidar preimages no head que60 realmente integrar.

Depois da publicação da porta,52 deve conectar uma ação humana explícita ao lookup usando apenas o `{ caseRef, key }` já retido, oferecer nova admissão, e remover a pendência somente depois de um ACK completo. Sem ACK, a UI continua bloqueando uma segunda intenção. Esta proposta não altera arquivos da UI nem afirma que esse consumo já existe.

## Gates exigidos do owner

- Perder a resposta depois de commit real, antes de entregar `draftRef`; reabrir SQLite/serviços e recuperar exatamente o primeiro resultado sem repetir registro.
- Criar duas intenções independentes com os mesmos campos e alvo; cada chave deve devolver seu próprio resultado, sem heurística de latest.
- Manter uma edição legítima do caso e demonstrar recusa para caso/encarnação/principal incorretos, chave ausente ou sem correlação, política/escopo alterados, alvo substituído, draft avançado e resultado ausente ou inconsistente. Outra chave válida da mesma pessoa/caso deve retornar apenas seu próprio resultado.
- Revogar a permissão entre lookup e egress; não divulgar `draftRef` e não modificar caso, draft, domínio ou recibos.
- Provar o consumidor real da52 após reload com apenas a correlação mínima, sem guardar novamente campos privados e sem redispatch automático.
- Executar testes cirúrgicos somente no Actions e solicitar a45 `bun typecheck` em `modules/sucafina` e `bun run check:guards --base origin/dev` no W integrado. Esta proposta não substitui nenhum desses gates.

Este pacote não fecha `IR-EXT-FIRST-SAVE-LOOKUP`, o consumidor UI, AM04 integral ou aceite global. A prova ativa65 e esta proposta externa têm estados separados.
