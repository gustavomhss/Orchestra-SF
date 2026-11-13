# Contratos de produto v1

Fonte: plano `dbf9547211d9b0fade619790de7c19c0869b7c7d`, canônico SHA-256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`. O inventário `product/contracts/freeze-v1.json` liga C01–C17 a módulos, exports, produtores, consumidores e às 39 operações. O recibo externo de G0 identifica o commit aceito e os consumidores; este arquivo não atesta implementação, GNATIVE ou liberação global.

| Contrato | Exemplo admitido | Exemplo recusado ou pendente |
| --- | --- | --- |
| C01 | Seletores de período explícito, moeda e referência; identidade injetada pelo host autenticado. | `principalRef`, provider ou concessões nos argumentos; período ausente ou impossível. |
| C02 | Componentes calculados pelo domínio com origem, granularidade, ausência e drilldown. | Um total de BI recalculado por outra fórmula; soma de moedas sem conversão comprovada. |
| C03 | Comando com versão esperada, alvo/encarnação e chave/digest idempotentes. | Versão velha, mesma chave com outro conteúdo ou alvo substituído. |
| C04 | Prévia sobre a mesma origem e comandos canônicos; manifest público aponta para operações privadas. | Prévia que grava, Apply sem reprévia após mudança ou metadados de instalação importados. |
| C05 | Captura preservada com fontes, versões, competência e comentários históricos. | Reescrever revisão antiga após mudança da origem; exportar sem revalidar acesso. |
| C06 | Confirmar o escopo observado com fingerprint canônico e CAS da unidade de armazenamento. | Confundir versão observada com versão de armazenamento; tratar ausência como zero ou revisão como aprovação. |
| C07 | Receita publicada/pinada, admissão vigente, run nativo e retorno revisável. | Run inventado, nova aprovação financeira implícita ou recursão de `routine-result`. |
| C08 | Uma Persistence existente, metadados protegidos, Request mantido no host e operação direta pela UI. | Quarto Surface, listener/store paralelo, papel Dashboard usado como acesso transversal ou Session de IA obrigatória para edição. |
| C09 | Caso persistido, fontes C17 resolvidas, alternativas, escolhas históricas e recibos. | Caso fictício em memória para satisfazer GNATIVE; alterar silenciosamente a escolha histórica. |
| C10 | Inventário versionado de custos; comparação `conditioned` mantém diferença completa nula. | Omitir training para obter `complete`, dobrar componente compartilhado ou chamar subtotal de benefício confirmado. |
| C11 | Saída decodificada por tipo, versões, modelo real e proveniência de execução. | Payload desconhecido marcado ready, resultado atrasado sobre versão nova ou import-preview apresentado como domínio aplicado. |
| C12 | Aplicação pelo domínio, recibo no mesmo snapshot e recuperação depois de resposta perdida. | Prometer atomicidade entre surfaces ou repetir mutação porque o caso ainda não recebeu o recibo. |
| C13 | Reavaliação e recall autorizados, com diferenças atuais e escolha original preservada. | Selo de atualidade em cache depois de revogação; causalidade inventada. |
| C14 | PDF digital, DOCX ou texto com origem/trecho e confirmação; portfólio com cobertura explícita. | Alegar OCR, aceitar caminho arbitrário, confundir extração com fato confirmado ou combinação incompleta com elegível-completo. |
| C15 | Cinco perfis, dezoito fontes reais, digests de bytes/instruções e carga observada antes do prompt. | Catálogo sem carga, digest pendente, fonte com hash de si própria ou Revisor na execução do autor. |
| C16 | Lease privada por identidade, Tool.Context real, skill/grant/ACL atuais e transporte MCP privado. | Binding/lease/UI fabricados por JSON, provider homônimo, reuso de lease ou bypass de skill no harness direto. |
| C17 | Ledger oficial, referência empresarial, scanner real e Atlas derivado no commit protegido. | Owner técnico/PR fictício, referência sem autorização atual, sucesso antes do commit ou memória local substituindo Atlas. |

`runtime.ts` fornece as assinaturas das factories T06. `TrustedCallContext` nativo e `TrustedUiContext` pertencem a registries privados distintos; seus campos e brands não autenticam por si. A ponte MCP aceita somente o caminho nativo. Ambos convergem no handler de domínio, que reautentica o Request e aplica a ACL/CAS vigente. Recibos discriminam proveniência nativa, UI e recusa sem binding: não há run ou generation fictícios para UI.

O provider C08 usa `expectedStorageVersion` por namespace, separado da versão observada da fonte e da revisão agregada. `additionalNamespaces` admite uma operação atômica de metadados, por exemplo Atlas e outbox, somente com autorização e CAS de todas as seções. Não cria transação global entre domínios. `preview` não é commit; retry exato revalida autoridade e encarnação atual antes de recuperar o resultado. Import, export, projeções e auditoria genérica ainda precisam integrar a proteção em seus entrypoints reais antes do aceite de produto.

Os schemas das 24 contribuições e das 39 saídas são gerados dos tipos por `bun run modules/sucafina/Sucafinav1/product/contracts/generate-output-schemas.ts`. `--check` exige os mesmos bytes; `schema-admission.ts` recusa argumentos extras, referências sem definição e estados estruturais incompatíveis. Validação estrutural não substitui a autorização, os cálculos originais ou as verificações semânticas dos produtores.

As dependências adicionadas em `@orchestra/sucafina` são necessárias às portas já previstas: `@orchestra/core` e `effect` para o host nativo, `@modelcontextprotocol/sdk` 1.32.0 para o par MCP em memória, `@orchestra/atlas-boundary` para os módulos canônicos e `@orchestra/rag-studio` para documentos. Os três pacotes Orchestra são workspaces existentes; Effect usa o catálogo existente e o SDK usa a versão já pinada pelo Core. Nenhum cliente ou serviço global é instalado.

O corpus financeiro v2 usa os vetores FX01/FX03 explicitamente fornecidos: budget 600000, actual fechado 400000 e forecast aberto 190000, com a licença de 72000 já incluída em novembro. Substituí-la por 84000/78000 produz outlook 602000/596000. O v1 de staging foi rejeitado para consumo; volume e medições só recebem aceite após os consumidores e provas correspondentes.

## Consumer corrections before G0

DecisionCase stores its append-only CaseLedgerEvent ledger; read returns AuthorizedCaseProjection. Its context discriminates native (profileId required) from UI (no resident profile fabricated). The case factory receives a host-resolved creation target tied to the current installation and a privately validated operation identity. Only an explicitly uninitialized state admits section version zero; invalid stored state fails closed. Case membership and each current evidence reference are authorized before disclosure and rechecked at egress without nested cross-surface transactions.

Directory lookup returns authorized IDs only. Public backups, legacy projections, dataset conflicts and audit rendering exclude __sfProductV1; imported private product metadata is refused and existing private state survives ordinary business dataset replacement. These boundaries require hosted acceptance; this document is not their execution proof.
