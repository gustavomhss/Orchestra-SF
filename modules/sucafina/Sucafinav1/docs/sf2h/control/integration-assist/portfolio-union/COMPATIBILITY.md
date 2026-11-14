# Compatibilidade semântica e fronteiras

## Resultados de sensibilidade

O finalizador proposto tem quatro formas internas. A forma é uma regra determinística de serialização; não é uma concessão, uma seleção temporal ou uma licença para reutilizar evidência.

| Forma | Origem verificada | Condições e evidência |
| --- | --- | --- |
| bundle-v1 | Bundle `46cb4dd02f0a6d11b3fa7a0deac7f839e7b7af3c`, finalizador `fe4ab56201fd1898905ac7bc810f0495a64f8602` | Condições das amostras; preview-coverage; evidência de threshold em união deduplicada de Finance. |
| pr37-v1 | PR37, evaluator `527db7238ae9e7c5a5233e2fedfbb8431017e3d5` e finalizador `3dec070ca5f56f7bd03a09b4b19468c950d82214` | known-components-threshold antes das condições da comparação; evidência de threshold Finance; não acrescenta observações originais ausentes nessa forma. |
| intelligence-v1 | PR36, finalizador `ee1a9586231ec9027bb323a817c4a469c4b207a6` | Observações originais de cenário e baseline; known-subtotal-threshold no final; exact conserva referências do certificado canônico; sampled conserva a ordem binding/baseline/result da fonte. |
| union-v1 | Proposta P01 | Dois identificadores, condições originais e de amostra, evidência canônica deduplicada de Finance. É a forma padrão para novos resultados. |

Os pins completos dos arquivos retidos estão em disposition.json e os pins Intelligence em input-manifest.json.

O verificador primeiro autentica o envelope e o pedido, resolve unidades/regra/caso, lê os C08 originais e amostras, reproduz os previews e refaz a prova estrutural e a fronteira IEEE. Só então reconstrói as formas pertinentes. Se há ambos os identificadores, exige union-v1; só components exige pr37-v1; só subtotal exige intelligence-v1. Sem marcador, as formas explícitas possíveis são reconstruídas e comparadas, inclusive históricos sampled/complete. Uma delas precisa produzir exatamente o digest integral armazenado. Nenhum array de condição ou prova armazenada fornece o resultado reconstruído.

A autoridade corrente, regras de completude e recusa de pontos null prevalecem em todos os formatos. Um resultado antigo que hoje não passa nas provas atuais continua recusado. A compatibilidade não permite retirar uma ressalva, trocar unidade, reordenar arbitrariamente evidências, substituir caso/fonte ou reviver uma prova revogada. Os novos testes incluem adulteração das condições mesmo com resultDigest recalculado.

Finance conserva a recertificação por intervalo atual + dois previews adjacentes, sem nova busca da mesma raiz. O patch não remove callbacks, checks de Request/headers/lease, identidade de reader/store/binding, poison de escopo ou a última publicação controlada. A captura final continua ocorrendo apenas depois de uma reconstrução integral correspondente.

## Cobertura e números

Os produtores mantêm seus cálculos. Os patches não criam algoritmo financeiro, regra fiscal, cancelamento ou interpolação. O limiar condicionado não resolve custos omitidos; total null não vira zero. Coverage qualificada exige os registros C10 e autoridade originais, incluindo predicate A ainda que uma resolução B tenha os mesmos dados. A classificação de failed definitivo continua ineligible mesmo com outro custo pendente.

Os consumidores de referência conservam os controles 55000/55001, 15000/15001, subtotal 210000, treinamento 40000, total 250000, teto 240000 e vantagem mínima 20000. O sinal da diferença depende do contrato do produtor: não trocar selected-minus-baseline por vantagem narrativa. Os testes existentes, fontes sintéticas e oráculos foram preservados literalmente.

## Duas histórias C08 válidas

O teste admitido source-scenario usa a fixture especializada com a referência original de baseline e unicidade do envelope. A variante adicional usa a história PR37 de envelopes equivalentes e exige seleção explícita de referências autenticadas. A descoberta por alternativa continua recusando ambiguidade; não se escolhe por data e não se apaga registro para fazer o teste passar. As observações de fonte nua/C10 do companion são locais ao teste; não são instaladas como um novo atalho de produção.

## Aplicação humana e reserva

Os testes controlados de handoff recebem um Request estável e indisponibilidade de produtor antes de dispatch, verificada por ausência de applicationAttempts. Isso preserva o retry esperado sem contornar uma reserva já persistida. A falha após reserva segue exigindo o recibo/protocolo C12 original; o teste real handoff-domain-integration é mantido na seleção. Nenhum arquivo de produto de C12, aprovação, ledger ou recibo é alterado.

## História, reabertura e C17

O leitor histórico conserva autorização atual N/N e N/N+1, encarnação, escolha, ledger, C08 exato e evidências. O teste adicional Finance tenta CAS real na última callback, exige recusa sem valor divulgado e sem alteração de storageVersion, e exige nova execução no read seguinte.

As regressões de serialização recriam serviços sobre um LocalStore ainda aberto. Não são prova de restart. Os testes admitidos renewal-sensitivity/renewal-restart-reader e os consumidores reais de C17 continuam necessários. C17-BETWEEN-OBSERVATIONS, Memory e CurrentChoice permanecem com seus owners e sem fechamento por esta proposta.
