# Propostas inertes para as duas falhas Procurement de R2

**Estado: PREPARED_NOT_APPLIED; qualificação: NOT_RUN.** Este diretório contém dois patches completos para dependências compartilhadas fora da autoridade de escrita da missão63. Nenhum arquivo de produto compartilhado foi alterado. Os cinco oráculos originais permanecem intactos.

## Evidência observada

R2 executou as cinco jornadas originais em `W=4a8906bd638a51a95ff13b4c542f62ef7203f486`, `S=98522c038cba67a2552890e9daf8898caf146c41`, run `43666919712`, job `132668237542`: **1 PASS e 4 FAIL**, sem skip ou retry. O resultado integral está em `../../ci/R2-result.json`; o log está em `../../logs/R2-nominal.log.txt`. Os manifests deste diretório registram os hashes e as linhas pertinentes. Não foram copiados cookies ou conteúdo bruto de traces.

| Proposta | Falha observada | Correção proposta |
| --- | --- | --- |
| `procurement-money.patch` | OP-PROC-02 recebeu `30240.000000000004 USD` onde o texto original exige `30240 USD`. | Aplicar aos valores derivados mostrados no detalhe, fila, resumo de PO e comparação PO/sourcing a convenção de apresentação `Number(value.toPrecision(15))` já usada pelo mesmo renderer na comparação de propostas. |
| `field-errors.patch` | OP-PROC-03 recebeu duas cópias da mensagem de FX ausente na descrição acessível: o ID renderizado pelo servidor e o ID criado após o 422. | Na limpeza já existente antes do submit, remover feedback anterior marcado tanto por `data-error-for` quanto por `data-field-error`, desvinculando somente os controles que referenciam aquele ID. A resposta atual continua sendo apresentada pelo `showResult` original. |

## Limites da alteração

A proposta monetária modifica sete interpolações em quatro linhas da função `render`. Não altera cálculo, valor persistido, FX, snapshot submetido, tolerância, threshold, regra de aprovação, valor de input ou identidade C02. O uso de quinze algarismos significativos replica uma convenção de apresentação existente; não institui arredondamento financeiro canônico. A cobertura inclui os textos posteriores do mesmo caminho original, para que o primeiro ajuste não deixe a mesma cauda numérica na fila ou na comparação com o sourcing aprovado.

A proposta de acessibilidade modifica somente o bloco de limpeza de feedback no submit. Mantém `aria-labelledby`, descrições auxiliares sem relação com o erro, valores preenchidos, CAS, validação, resposta 422 e foco. A associação é tratada por ID; não se removem mensagens por comparação textual e não se altera a igualdade exata exigida pelo teste.

## Conteúdo e integridade

Cada proposta possui `.preimage.txt`, `.postimage.txt`, `.patch` e `.manifest.json`. As preimages e postimages são arquivos integrais. Os diffs têm caminhos reais de destino e identificam os blobs completos. Os manifests registram blobs Git, SHA-256, causa, critérios, resultado observado e limites.

As duas preimages foram lidas via GitHub MCP no baseline `7e1a36eb1d39ebd2e189dbb4adbe48abf1efcd85` e novamente no target inspecionado `d088708276b48f896ad4e0ecd2a95cb73dc413b1`; os blobs são idênticos. Os mesmos blobs foram confirmados por MCP no snapshot exato de R2, `98522c038cba67a2552890e9daf8898caf146c41`. `DEPENDENCIES.json` registra todos os imports diretos e os contratos produtores relevantes, sem novos imports ou dependências. As propostas podem ser revisadas separadamente; a exportação `esc` de `screen-shell.ts`, consumida pelo renderer, permanece intacta.

## Encaminhamento e ativação

O consumidor é **60**, único integrador de `sf2-stack`; **45** coordena os gates hospedados. Os dois destinos estão fora da missão63. A concessão da missão59 é limitada a LocalStore, contrato aditivo, snapshot e wrapper; ela não inclui `runtime/procurement.ts` nem `src/screen-shell.ts`. A missão53 exclui explicitamente o runtime Procurement e a missão61 limita sua atuação a outros produtores. Portanto, 60/S0 deve atribuir a revisão e aplicação ao owner compartilhado apropriado, consultando59 para coordenação de runtime sem presumir uma concessão ampliada. As fontes de autoridade e seus blobs constam em `MANIFEST.json`.

Antes da aplicação, o integrador deve reler o target e o blob real por MCP e reconciliar qualquer drift por CAS. As postimages completas não autorizam sobrescrever trabalho posterior. A proposta não autoriza merge, release ou fechamento de critério.

## Qualificação pendente

Nenhum teste de produto, browser, typecheck ou guard foi executado para estas postimages. A revisão realizada é estática e a geração dos diffs/hashes é apenas verificação dos artefatos.

Após composição autorizada, usar a seleção original de `../../ci/R2/request.json` pelo fluxo hospedado existente, preservando as cinco jornadas, `60000 ms` por teste, `10000 ms` por expect e retries `0`. Registrar novo W/S/run/job e verificar o texto monetário, identidade C02, snapshot submetido, recusa sem nova versão e descrição acessível única. A alteração no shell também requer revisão do feedback de outros formulários pelo owner.

O FAIL de R2 permanece evidência histórica. Estas propostas não corrigem nem qualificam as falhas independentes de importação/documentos, o scanner ClamD, C06, formatos documentais ou o candidato integrado C.
