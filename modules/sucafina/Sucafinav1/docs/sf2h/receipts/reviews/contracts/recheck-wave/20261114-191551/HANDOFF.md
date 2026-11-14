# HANDOFF — S3-R3 contratos/runtime

## Estado terminal

**DONE — revisão finita publicada; produto em REQUEST_CHANGES/HOLD; GLOBAL_RELEASE NOT_GRANTED.**

Sessão independente, sem autoria de produto. Um único parecer S3-R3 com três auxiliares read-only. Produto e contratos permaneceram somente leitura. Nenhum teste/typecheck/guard/CI foi executado ou disparado. Não há aprovação final de C ou D.

A janela de escrita desta sessão encerra-se após publicação e readback destes arquivos. O próximo revisor deve consultar o HEAD/PR51 e este handoff; silêncio não comprova encerramento de qualquer outro writer.

## Pins preservados

| Papel | SHA examinado |
| --- | --- |
| WP10/PR29, W30 | `d4fb072fa9bd32ebfef2b9cbc9b27b998d34f4e7` |
| Colaboração/PR41 | `62e5629dbf31be2bb662dda152c96021f22b0ca5` |
| ACK/PR54 | `92243fc68ff81df7fc563ec081ac9db686a24dfa` |
| Reuso/PR61 | `854f3dd9a5257c83b703424a8fd73d831f705f46` |
| Comparador histórico PR44 | `ad7fcdef7739e1bc471e42fac082452799de751b` |
| Planejamento | `dbf9547211d9b0fade619790de7c19c0869b7c7d` |
| Missão/namespace | `c708ec0609dbfc95b259707d8c38481617f74f11` |

PR29 avançou depois do freeze para `54317229d7f8fcb7e92921c2f4a8dc6f9310270b`: filho direto com 40 adições evidenciais. Mantido W30 como produto; U30/CHECK30/X29 indexados com W/S próprios. Não é novo C nem aceite D. Qualquer fonte posterior exige delta de recheck.

## Decisões para consumo

- **CR-C11-001: RESOLVED_WITH_EVIDENCE em WP10.** Já corrigido no W27; quatro casos lifecycle A21 PASS e seis blobs pertinentes iguais. A21 inteiro é FAILURE. A composição PR44 antiga conserva a ocorrência histórica. Não pedir reimplementação.
- **CR-C03-001: P2 OPEN no caller WP10.** UI montada correlaciona ACK por mensagem nova/texto/autor e apaga a intenção pendente; producer retido persiste Boolean. Edição autorizada de M1 seguida de M2 com mesmo texto torna possível a atribuição incorreta descrita estaticamente. Primeira publicação: `7124fce97198ca37a866ee2e39641c85c0694a48`.
- **Produtor ACK da PR41 corrigido.** Recibo durável, intenção completa, tupla exata, replay e release com fences. 24 execuções PASS/22 nomes/285 assertions em três W/S próprios; não provam intenção persistida e ACK após reload do browser. Gate exato: FAILURE por 69 diagnósticos iguais ao baseline; guards PASS.
- **F07/recipientAuthority/C05 continuam abertos na composição.** Ausência do resolver nega destinatário distinto. C05 no transporte compartilhado C16 retorna indisponível até contrato carregar pin imutável. Não retirar a proteção ou fabricar grants.
- **4→2 aplicado**, mantendo 2 observações, 6 autenticações e 4 revalidações no positivo. C29 estrutural e F29 fences confirmam o recorte. **X29 continua FAILURE 0/1 no prazo de 285 s**; não há speedup integral comprovado.
- **A27 e R1-W23-C17-BETWEEN-OBSERVATIONS: NEEDS_RECHECK**, causas separadas de observation. Não alegar vazamento/bypass executado.
- **U30: FAILURE 3/1**, Cancelar visível quando esperado oculto; assertions posteriores não alcançadas. CHECK30 confirma geração Atlas/guards, mas falha com 13 diagnósticos externos ao WP10.
- F01–F15 históricos preservados por referência, sem redução do universo de 15 WPs, 74 tasks, 17 contratos e 1.610 critérios.

## Próximas ações por owner

1. **WP01/UI + WP10/S0:** consumir a closure já publicada do recibo PR41 e adaptar o caller real. Validar ACK pela intenção/principal/chave/thread/tupla. Preservar intenção para retry/reload e provar mensagens iguais, perda de resposta, alteração de intenção/versão, resolução, substituição e revogação.
2. **S0/WP10 + WP08 + WP00/C16:** compor autoridade real do destinatário e pin C05 no transporte correto. Conferir preimages e dependências por arquivo. O endpoint `decision-answer-question` já existe; não criar outro.
3. **WP10 e owners pertinentes:** investigar custo residual a partir da primeira recertificação X29; recheck captura A27 e janela C17; corrigir U30 por seu owner. Preservar positivos, fences, assertions e deadlines. Não reexecutar cortes inalterados por rotina.
4. **S0:** integrar um único C, obter provas AM01–AM06 e seleções/geração/typechecks/guards pertinentes, além dos três pareceres finais independentes. Só então verificar D pelo envelope e guard próprio.

Essas ações são recomendações de handoff; esta revisão não enviou mensagens/comandos aos autores nem disparou runs.

## Arquivos desta rodada

- [REVIEW.md](REVIEW.md): parecer, matriz dos contratos, código instalado, cenários, evidência e limites.
- [FINDINGS.json](FINDINGS.json): onze disposições de recheck com origem/severidade/owner, não onze bugs novos.
- [EVIDENCE.json](EVIDENCE.json): SHAs/trees/blobs, leitura integral do pack/anexos, W/S/runs/jobs, equivalências e resultados.
- [FINDING-CR-C03-001.md](FINDING-CR-C03-001.md): registro inicial append-only do caller ACK.
- Este HANDOFF.

Publicação exclusivamente em `review-contracts`, namespace autorizado. O SHA de entrega será o commit que contém estes documentos e será publicado na descrição da PR51, evitando autorreferência. O compare/readback da entrega deve confirmar apenas adições; os quatro arquivos da revisão anterior permanecem byte a byte.

Nenhuma branch/PR adicional, merge, deploy, fonte alheia, contrato, fixture ou teste foi alterado. Guard próprio desta revisão: **NOT_RUN por instrução explícita de não executar/disparar testes**, sem alegação de aprovação global.
