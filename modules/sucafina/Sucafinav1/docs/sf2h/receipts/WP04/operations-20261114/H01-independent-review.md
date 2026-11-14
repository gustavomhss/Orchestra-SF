# Revisão independente de H01 — OPS-HOST-01B

**Nenhum defeito material confirmado no escopo revisado.** O teste ainda exige execução no candidato composto pelo GitHub Actions. Esta revisão cobre somente H01 e o agendamento da fixture, no blob congelado `b65dc1e315f88dd535881b1f8a895661e95e485b`, anterior a H09.

Reconstruí o arquivo a partir do before-image W4 e do patch salvo, verificando cada contexto e os hashes finais: 52.614 bytes, SHA256 `e4ae25d909719b84d26b7926963520b4e858f8d5629264afa0766d4111261c06`. Os oito títulos originais estão preservados; os outros sete corpos de teste são byte-idênticos.

## O que o teste prova quando passar

O novo caso chama diretamente `business.procurementDossier.prepare`, usando Request e sourcing do produtor real. Ele exige que sourcing, comparação, versão, contexto e cada sourceRef sejam iguais à observação independente do produtor. A origem dos termos é o Request; o Supplier register permanece não selecionado.

O contraste de FX é discriminante: Request submetido em EUR1.08, settings atuais EUR2, proposta B EUR28000. O valor exigido é USD30240; usar o settings atual produziria56000. Ofertas, versões, taxas submetidas, escolha humana B e justificativa são comparados, sem reproduzir o motor de scoring no consumidor. O snapshot de Procurement precisa permanecer igual depois do read.

O agendamento envolve `sources.transaction`, aguarda a transação real e devolve o mesmo resultado. Apenas após uma resposta de fatos reconhecida por stage/offers/evidence ele decrementa o contador. No segundo read injeta uma edição real pela mesma persistência, ou revoga o principal usado pelo authenticate da fixture. Limpa o gancho antes do callback e exige que o callback tenha sido atingido. Não fabrica payload, PortResult, recibo ou boolean de autorização.

A recusa composta coincide com o produtor: falha na releitura torna revalidateProcurement falso, e o dossiê retorna denied/access-changed sem value. A chamada seguinte ao selector antigo deve ser stale ou denied. A mudança de fonte também invalida a referência; portanto esse caso não isola sozinho a igualdade do membro sourcing.

## Preservação e limites

Continuam presentes a confirmação C06 real, isolamento de principal, dossiê sem comparação, leitura repetida sem mutação, distinção entre descrição não material e subject material, anexo sem extração e recusa final após revogação. As propostas são fixture controlada em Request editável: não substituem a jornada de aprovação de sourcing. A autoridade é a fixture local real, não prova de identidade nativa/Entra, medida humana ou GNATIVE.

Nenhum produto/teste foi executado localmente e nenhum arquivo de produto foi modificado. H09 não faz parte desta revisão. O JSON contém pins, testemunhos e limites completos para o revisor de integração.
