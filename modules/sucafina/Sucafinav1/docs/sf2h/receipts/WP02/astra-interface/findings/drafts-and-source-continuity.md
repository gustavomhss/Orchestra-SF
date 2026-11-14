# WP02 — revisão de consumidores e seams pendentes

Esta leitura usa PR #21 em `6ce14163ec6de963b50ada3d610aa8161176adee`, a composição publicada `ff7a99753d1fd1bc8b68b4f2642fed26e3cadbdf` e os incrementos locais entregues ao root. Não é recibo de execução. Nenhum teste de produto foi executado localmente.

## WP02-F01 — save novo confirmado no servidor, resposta perdida e reload antes de receber o selector

### Fato e consumidor afetado

`product/decisions/hot-topic-draft.ts#register` persiste, na mesma transação C08, o draft e a transação:
`[principalRef, "preferences", caseId, "hot-topic-draft:" + operationIdentity]`.
Seu resultado público é somente `{draftRef, version}`; não é um HotTopicDraft completo.

O consumidor Dashboard agora conserva corpo e chave em memória para repetir exatamente um save incerto. Depois de um resultado conhecido, encontra o draft por draftRef/version na discovery autorizada e normaliza a seleção por id/incarnation. Nenhum texto, fields ou evidence é persistido no navegador.

Se o primeiro save tiver commit e o usuário confirmar um reload antes de receber draftRef, ainda falta consulta inequívoca por operação. A lista pode mostrar o draft salvo, mas o consumidor não deve inferir identidade por título, target ou posição. O aviso nativo protege saída acidental; não substitui a consulta.

### Contrato privado mínimo sugerido ao owner de integração

Rota somente leitura, por exemplo `dashboard-hot-topic-draft-outcome`:

```ts
type Request = {
  caseRef: { id: string; incarnation: string; version: number } // versão atual descoberta
  requestKey: string // a Idempotency-Key da tentativa original; não é uma concessão
}
type Value =
  | { state: "committed"; draft: { id: string; incarnation: string; draftRef: string; version: number } }
  | { state: "not-observed" }
```

A chave continua como seletor opaco. O host resolve internamente a identidade original de operação de `sf-human:decisions.edit`; o browser não deve duplicar a fórmula ou passar principal/accessRevision/policyVersion. Admitir a leitura atual de cases/preferences, exigir o mesmo principal que produziu o draft, a mesma incarnation do caso e participação atual. Verificar a transação, seu targetIncarnation e o draft ativo/histórico antes de devolver apenas o selector. Revalidar fonte e autoridade imediatamente antes do egress.

`not-observed` não significa cancelado e não autoriza criar outra intenção: a resposta pode continuar incerta. Se o draft foi editado depois, devolver stale ou selector para a mesma identidade com versão atual explicitamente discriminada, nunca trocar por outro draft do mesmo título. O domínio Hot Topics não é escrito por esta rota.

O browser pode então guardar somente `{caseId, caseIncarnation, requestKey}` antes de enviar o save e, após reload, consultar a operação. Não se propõe localStorage, persistence de fields, readback por nome, nem novo motor de drafts.

### Negativos necessários

- Commit real com perda de resposta; reload; lookup retorna a identidade única e o domínio permanece intacto.
- Dois drafts do mesmo título/target em operações distintas não são confundidos.
- Principal diferente, participante removido, case reincarnado, fonte revogada ou key alterada não expõem selector/dados.
- Operação sem commit informa not-observed; lookup não cria, reenvia ou aprova nada.

Owners: `apps/cli/src/sucafina-product/dashboard-http.ts`, `dashboard-decisions.ts` e eventual helper privado de operação são integração; o consumidor WP02 fica pronto para consumir a versão publicada.

## WP02-F02 — correlação de criação C06 não vincula a incarnation da ação

### Fato

Na composição ff7, `product/dashboard/hot-topics.ts` (blob `3f1e411fee14260fc4c9eb5d6a26cd4fea100079`) guarda criação como `{digest,id}`. O replay lê o registro atual por id. `product/collaboration/hot-topic-host.ts` (blob `aaae9db90459f8e6b34d9a1a2a1aedfda2a4affb`) valida sourceRefs atuais e digest/id da correlação, mas não fixa a incarnation do target. Uma remoção seguida de recriação do mesmo id pode ser confundida com o efeito original.

O incremento próprio WP02 agora registra a incarnation real em correlações de UPDATE. Replay de update só devolve o recibo se a incarnation atual for a original. Correlação legada sem binding resulta em `action-identity-unbound`; substituição resulta em `action-replaced`. O novo negativo usa SQLite, C08, papel real e source lifecycle real, com delete canônico, recriação do id e reopen. Ainda precisa do recibo Actions do novo head.

Isso não encerra CREATE nem a ausência de expected incarnation na primeira submissão de um update antigo. Não declarar todo C06 concluído.

### Por que o provider é necessário para CREATE

`createSfSourcePersistence` sincroniza identities somente depois que o callback da transação retorna. Quando `DashboardPeople.domain.execute` cria o registro dentro de HotTopicHost.work, sua source incarnation canônica ainda não existe. Atribuir uma incarnation no port, alterar diretamente sfSources, usar hash/audit como substituto ou fazer read+bind posterior não é seguro; o guard rejeita mutação direta de sfSources e um bind posterior pode aceitar uma substituição entre commits.

### Seam requerido

O provider deve permitir que a correlação nova e a incarnation canônica sejam vinculadas no MESMO commit durável. Duas formas aceitáveis:

1. Reserva privada oficial do source lifecycle para `{recordType:"hotTopics", recordId}`, consumida e validada no commit; o port usa a id/incarnation reservadas, sem que a reserva conceda leitura/escrita.
2. Finalizer confiável depois da sincronização, dentro da mesma transação, que só complete as correlações novas produzidas pelo callback autorizado e preserve os guards C08/source lifecycle.

Postcondição: uma correlação CREATE durável nunca fica vinculada apenas ao id. O replay exige targetIncarnation exata, com fontes atuais e autoridade real. Uma correlação antiga sem esse binding não deve ser reatribuída ao registro atual. Nenhum fix foi escrito em host/provider alheio.

Negativo proposto ao owner: criar por C03 real, perder a resposta logo após commit antes de criar a relação de handoff, remover ação por comando canônico, recriar mesmo id com nova incarnation, reabrir SQLite e repetir a mesma correlação. Deve devolver unavailable/conflict sem retornar a ação substituta nem alterá-la. Controle positivo: atualização/completion normais da mesma incarnation mantêm a referência original.

## Consumidores presentes na composição atual

- `host-context.ts` expõe `work: business.collaboration.work`; composição, HTTP work-list/work-destination e UI work-collaboration existem. Não registrar “Work ausente”.
- `workspace-services.ts` compõe ReviewApplication com agenda Dashboard, record sources, BI e autorização corrente; Dashboard workbench fornece consumidor real para pauta, preservação, captura e histórico.
- `business-services.ts` registra createDashboardCapabilities e consumidores Dashboard/C12; testes de native-capabilities usam SessionV2 skill/admission e wrapper privado reais, mas não qualificam LLM/GNATIVE.
- Atlas tests exercitam Atlas real, scanner Gitleaks e egress C17 com limites declarados. Não qualificam automaticamente scanner instalado/ClamD ou gates globais.
- `host-context.ts` cria routine-services sem `native` e declara que não instala portas públicas C07 native/publication. Status/discovery de rotinas existem e falham com causa explícita. É indisponibilidade real do adapter de integração/runtime; não é ausência do consumidor UI nem algo a substituir por mock no WP02.

## Mapa preservado

`wp02-consumer-review-78.json` relaciona exatamente os 78 critérios: WP 15, T01 21, T02 15, T03 14, T04 13. É inventário estático de produtores, consumidores, testes e findings; o root/ci_reconcile associa os runs e SHAs exatos, e S0 mantém o aceite composto/global.

## WP02-F03 — caso aplicado C12 fica indisponível no BusinessContext Dashboard

Inspeção da composição publicada atual: PR32 head `5866bcb2ed610f80138aaabc261acac4acf709cd`, confirmada por wp01_read via GitHub MCP. `business-context.ts` blob `0ac4c11d4eddb6e4a67c2c41efe40a7ff34fa47e` despacha receipt apenas de Procurement. `source-access.ts` blob `9a29a61dca38f723aca5c0bcd416c26a1cc636b1` usa digest corrente exato em `createSfDashboardRecordSourceAccess`, sem histórico de registro Dashboard. A evidência é inspeção, não falha executada atribuída àquele SHA.

Cadeia real: `decisions/apply.ts` mantém as fontes originais da escolha e acrescenta a receipt ref; `case-port.ts#read` exige cada evidência como fresh ou historical com autoridade corrente. Depois do efeito do update, a fonte original já não corresponde ao valor atual, e a receipt Dashboard não tem leitor no router. `business-services.initializeAtlas` usa esse router; `dashboardDecisions.discover` chama cases.read. Logo o caso aplicado pode sumir da discovery, impedindo recuperação de receipt após reload e histórico/retomada desse caso.

O fixture novo WP02 deixou de usar um adapter artesanal que só resolvia fresh Dashboard e agora instancia `createSfBusinessServices`, bundle residente e `initializeAtlas` reais. Não inventa fresh/historical nem enfraquece o teste `Dashboard recovers the same C12 application receipt after a committed response is lost and the page reloads`. Sem scanner neste fixture, não se alega publicação de memória.

Correção do owner de integração deve publicar leitores reais e privados para:

- Receipt Dashboard: validar id/surface/version/idempotencyKey/commandDigest/targetIncarnation contra C08/C12, participação atual no caso e atual read authority; retornar projeção restrita e revalidar no egress.
- Registro Dashboard histórico: original durável e íntegro, fonte atual autorizada e prova oficial de continuidade física que rejeite delete/recreate. Não usar recordId, label ou hash inventado como identidade, nem tratar stale como fresh.
- Wiring das capacidades BusinessContext atuais de `createSfBusinessServices`, usado por case read e workbench discovery.

Negativos: caso removido/reincarnado, participante removido, source substituída sob mesmo ID e receipt alterada permanecem indisponíveis. Positivo: lost apply response + reload + discovery autorizada + mesmo body/key devolve exatamente a receipt original sem novo efeito/versão de domínio.

## WP02-F04 — continuidade de rascunho novo quando o escopo de leitura muda

O source `incarnation` do DTO Hot Topic é a incarnation do ESCOPO C17, não a incarnation física da linha. `dashboard/sources.ts` @5866 blob `c32c973c0b4111e4ac7df0c5d934e094277823f6` resolve `sf-source:<scoped incarnation>:<version>` e exige principal/accessRevision/policy atuais. O selector inclui actor.canWrite; retirar apenas escrita muda a referência embora a leitura do mesmo Hot Topic continue legítima. O Dashboard HTML atual não entrega binding de acesso/principal ao widget.

O incremento W4 agora exclui private fields/correlação quando a discovery corrente perde o caso, o draft salvo (mesmo id/incarnation) ou a referência EXATA da origem do draft novo (incarnation, refId e refDigest); também substitui os catálogos visíveis pelos rótulos novamente autorizados. Nunca reatribui o write binding ou o request incerto à nova referência. Não aceita presença de ID/label para reter dados. O negativo inclui exclusão canônica e nova source incarnation real, mesmo ID e campos idênticos, mantendo o caso legível.

Bloqueio residual explícito: para draft novo ainda não salvo, `recordId` presente mas scoped incarnation diferente não distingue mudança somente de escrita, troca de principal/ACL ou delete/recreate. O consumidor agora fecha conteúdo em toda diferença não comprovada; a assertion relevante existente de preservar edição com canWrite=false permanece intacta e deve revelar a dependência do produtor. Aceitar a nova incarnation seria vincular outro alvo sem prova. O seam não pode ser fechado apenas no consumidor com os DTOs publicados. A UI explica que não conseguiu confirmar a identidade autorizada da origem e removeu os dados locais; não alega que fonte textual equivalente seja a mesma entidade.

Proposta privada aditiva ao owner: `reauthorizeDraftSource({originalEvidenceRef}, currentContext)` devolve `{state:"same-source", currentRef, authorizedProjection}` somente após validar o original contra C17 persistido e provar physical incarnation/tombstones, principal original e leitura corrente; devolve unavailable/replaced quando não houver prova. O parâmetro é selector, não autoridade. Revalidar duas vezes e no egress. O DTO pode expor apenas prova de continuidade e ref atual, sem tornar a identidade física pública. Para troca legítima de escopo de escrita, os campos originais só permanecem visíveis se novamente autorizados; a escrita continua na versão original até rebase explícito.

Contraprovas necessárias: retirar apenas escrita preserva input local e proíbe write; remover acesso à fonte com caso ainda legível apaga input e catálogo; trocar principal mantendo caso legível apaga private draft; remover/recriar mesmo ID rejeita continuidade; concurrent same-inc version permite comparar base/diferenças com confirmação explícita. Não afrouxar `host-workbench` write-authority ou draft-conflict existentes.

A contraprova W4 de primeiro 403 póscommit usa mudança real transitória de canWrite: register real comita, HTTP egress real devolve403, a política é restaurada antes da entrega. A nova discovery então comprova exatamente o source original; repetir deve manter body/key e devolver o mesmo draft1. Este teste isola classificação de resultado incerto e não afirma retenção durante uma alteração permanente de escopo.
