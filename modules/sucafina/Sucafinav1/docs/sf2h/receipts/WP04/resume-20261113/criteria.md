# WP04 — matriz final dos 111 critérios

Produto `dae18b4f43f0daecf46264e876810025684a919d`. **97 PASS_SCOPED, 10 BLOCKED_NATIVE e 4 NOT_RUN_HUMAN**. A qualificação é cirúrgica; aceitação integral permanece bloqueada. Recibos: [ci-evidence.json](ci-evidence.json), [test-results.json](test-results.json), [proof-boundaries.md](proof-boundaries.md).

| Critério e texto literal | Resultado | Razão e limites | Testes observados |
| --- | --- | --- | --- |
| **WP04.DOD.01** — As cinco páginas e o inventário de comandos/estados originais têm cobertura explícita, com views exportadas, C02/C03 reais e evidências locais reproduzíveis. | PASS_SCOPED | As cinco páginas permanecem exportadas; campos/IDs/comandos do baseline têm casos explícitos. Requests e My approvals agora recebem a fila C02 real no host, com fence de material/acesso antes do render. C03 usa o domínio atual e recibo real. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_08094ef71a3f06d0d266](#test_08094ef71a3f06d0d266), [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_4d1bf09c609d665f42d0](#test_4d1bf09c609d665f42d0), [test_636c917673d6d1ca810e](#test_636c917673d6d1ca810e), [test_6ec0aaad82d767ef6d90](#test_6ec0aaad82d767ef6d90), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_7db1565aa04b1bd60e57](#test_7db1565aa04b1bd60e57), [test_7f36b3f5c2b6ce56a211](#test_7f36b3f5c2b6ce56a211), [test_7fb9bd61e2a0d844dcfe](#test_7fb9bd61e2a0d844dcfe), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_a7f1ee5535ca0a5020ce](#test_a7f1ee5535ca0a5020ce), [test_b66e531a2da6e4681149](#test_b66e531a2da6e4681149), [test_f72276a4ca0247e5b52d](#test_f72276a4ca0247e5b52d), [test_fd97f7c525436361e6e6](#test_fd97f7c525436361e6e6) |
| **WP04.DOD.02** — Fila, pedido guiado, comparação, resumos por etapa e fornecedores estão demonstrados com os mesmos registros e versões, sem um store paralelo de demonstração. | PASS_SCOPED | Filas e formulários são ligados por ID ao mesmo domínio autorizado dentro do fence; valores da tabela vêm de C02, e comparação/reutilização/fornecedor usam os registros e snapshots submetidos reais. Versão de fonte C02 e revisão CAS continuam identificadas como versões de contratos distintos, sem exigir igualdade numérica indevida. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_16e6710da78f60574528](#test_16e6710da78f60574528), [test_612b88a3e9700edca00f](#test_612b88a3e9700edca00f), [test_665a15fd31367d3aafd9](#test_665a15fd31367d3aafd9), [test_7dacfef73083a802eab4](#test_7dacfef73083a802eab4), [test_7f36b3f5c2b6ce56a211](#test_7f36b3f5c2b6ce56a211), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_a896da26bab38d48f910](#test_a896da26bab38d48f910), [test_bf481403d481f938378b](#test_bf481403d481f938378b), [test_c79004b8258e38abd7d9](#test_c79004b8258e38abd7d9), [test_f72276a4ca0247e5b52d](#test_f72276a4ca0247e5b52d) |
| **WP04.DOD.03** — O handoff lista consumidores, casos adversos, artefatos de evidência e verificações de composição reservadas a WP10; não declara entrega integrada com base apenas em fixtures. | PASS_SCOPED | Há consumidores montados e casos discriminantes concretos, incluindo HTTP/SQLite, dispatcher e browsers de produção. O handoff final precisa atribuir as provas ao SHA/seleção e separar limites nativos e humanos. | [test_159cd3e85ec06bf5fef7](#test_159cd3e85ec06bf5fef7), [test_45a88b09f681f263f4a4](#test_45a88b09f681f263f4a4), [test_4c10b52c957255b3a1cc](#test_4c10b52c957255b3a1cc), [test_612b88a3e9700edca00f](#test_612b88a3e9700edca00f), [test_7f36b3f5c2b6ce56a211](#test_7f36b3f5c2b6ce56a211), [test_fd97f7c525436361e6e6](#test_fd97f7c525436361e6e6) |
| **WP04.DOD.10** — As entregas residentes atribuídas a WP04 têm produção, consumo e provas reais completos. | BLOCKED_NATIVE | Produção, tipos, schemas fechados, montagem C16 e consumidores de negócio existem. Os testes exercitam código de produção, mas a obrigação de prova residente completa excede os recibos disponíveis. Limites: Falta recibo de execução real com SessionV2/SkillLoadReceipt e chamadas sf_request_read pela UI/native/MCP sob a mesma base e autoridade, comparando handler, resultado, versão e recusas. Catálogo/manifesto, UI e dispatcher real não substituem essa prova. Não há prova AM02/GNATIVE nem execução real de receita C07 residente atribuível a este checkpoint. | [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_45a88b09f681f263f4a4](#test_45a88b09f681f263f4a4), [test_612b88a3e9700edca00f](#test_612b88a3e9700edca00f), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_9b1d7f1d61ff5bd1daa8](#test_9b1d7f1d61ff5bd1daa8), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.INV.01** — Alçadas, papéis, autorização por holder, opção de bloquear autoaprovação, política de fornecedores e transições legais permanecem os do domínio; decidir continua sendo ato explícito da pessoa autorizada. | PASS_SCOPED | Papéis, holder, self-approval, políticas e transições permanecem em domain.execute/act. Renderer só informa ação; C12 exige intenção humana revisada e autoridade corrente. Casos negativos verificam recusas sem mutação. | [test_04d58ac83c173a6387af](#test_04d58ac83c173a6387af), [test_159cd3e85ec06bf5fef7](#test_159cd3e85ec06bf5fef7), [test_16e6710da78f60574528](#test_16e6710da78f60574528), [test_1b731c02abaff1e0f580](#test_1b731c02abaff1e0f580), [test_1d4c2f1fc88efc258e49](#test_1d4c2f1fc88efc258e49), [test_41d25e7b44f10c3c469f](#test_41d25e7b44f10c3c469f), [test_6722bdf3f450851b51a3](#test_6722bdf3f450851b51a3), [test_868acd09c14bbc5badb7](#test_868acd09c14bbc5badb7), [test_cc83f18a6e6b41f8c245](#test_cc83f18a6e6b41f8c245), [test_d75f0c6d9b77fc7d80e9](#test_d75f0c6d9b77fc7d80e9) |
| **WP04.INV.02** — Histórico, identificadores já emitidos, versões esperadas e snapshots de aprovação/câmbio são preservados; po_issued continua significando emissão interna. | PASS_SCOPED | Campos/histórico/allocações PR/PO/SUP, revisões esperadas e snapshots financeiros são preservados. PO issued mantém texto de emissão interna. Retentativas reconciliam recibo durável sem repetir efeito. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_2b9422c6a67a4c2497e4](#test_2b9422c6a67a4c2497e4), [test_3dc7eb0ffcaa7ae2b2c9](#test_3dc7eb0ffcaa7ae2b2c9), [test_636c917673d6d1ca810e](#test_636c917673d6d1ca810e), [test_69d6f081e0cdfc30a58a](#test_69d6f081e0cdfc30a58a), [test_6b99f2ee2f1e8da8fb2f](#test_6b99f2ee2f1e8da8fb2f), [test_79177e5f3c3f904f61c5](#test_79177e5f3c3f904f61c5), [test_8978c27ba56c5840645d](#test_8978c27ba56c5840645d), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_b66e531a2da6e4681149](#test_b66e531a2da6e4681149), [test_f72276a4ca0247e5b52d](#test_f72276a4ca0247e5b52d), [test_ff56fdea15b62cb8e720](#test_ff56fdea15b62cb8e720) |
| **WP04.INV.03** — Recortes autorizados e restrições bancárias valem para tela, exportação, resumo e C02; referência textual ou ausência nunca vira relação, autorização ou valor zero. | PASS_SCOPED | Mesmo recorte em filas, C02, detalhe e exportações; todos os seis campos bancários seguem o privilégio existente. Testes inspecionam bytes reais dos produtores CSV/PO; faltas monetárias não viram zero. Referências textuais não conferem autoridade. Limites: Os testes CSV citados chamam o produtor download real e inspecionam bytes; não são rotulados como percurso HTTP autenticado desses downloads. Essa distinção não acrescenta requisito ao enunciado. | [test_0dbe4a7e68e8770c4320](#test_0dbe4a7e68e8770c4320), [test_0ee9c599f7b129d16b7b](#test_0ee9c599f7b129d16b7b), [test_16e6710da78f60574528](#test_16e6710da78f60574528), [test_2cedc9096e6d2392995e](#test_2cedc9096e6d2392995e), [test_2d86a5c91f2a22b4f0d5](#test_2d86a5c91f2a22b4f0d5), [test_3de28c6bcef4fcb14cdd](#test_3de28c6bcef4fcb14cdd), [test_4c10b52c957255b3a1cc](#test_4c10b52c957255b3a1cc), [test_5219e856659a559a2907](#test_5219e856659a559a2907), [test_651e0ea6cd19c23b35e2](#test_651e0ea6cd19c23b35e2), [test_7d32b8d1a40a03da1d9d](#test_7d32b8d1a40a03da1d9d), [test_8181d121b72f370d2603](#test_8181d121b72f370d2603), [test_b5a7210f089cbcf92847](#test_b5a7210f089cbcf92847), [test_bf481403d481f938378b](#test_bf481403d481f938378b), [test_da0cdc62b37d2701a8c1](#test_da0cdc62b37d2701a8c1), [test_edca1cde9e870eb8083f](#test_edca1cde9e870eb8083f), [test_fd97f7c525436361e6e6](#test_fd97f7c525436361e6e6) |
| **WP04.INV.10** — WP04 conserva autoridade, dados oficiais e ownership; não assume identidade técnica ou novo acesso empresarial. | PASS_SCOPED | Autoridade é recebida do host e revalidada; chamadas sem concessão, dados forjados, participante indevido e fontes sem continuidade são negadas. O novo hook usa sf_request_read existente e período privado por contexto, sem nova identidade ou grant. | [test_04d58ac83c173a6387af](#test_04d58ac83c173a6387af), [test_159cd3e85ec06bf5fef7](#test_159cd3e85ec06bf5fef7), [test_41d25e7b44f10c3c469f](#test_41d25e7b44f10c3c469f), [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_4c10b52c957255b3a1cc](#test_4c10b52c957255b3a1cc), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_868acd09c14bbc5badb7](#test_868acd09c14bbc5badb7), [test_9b1d7f1d61ff5bd1daa8](#test_9b1d7f1d61ff5bd1daa8), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051), [test_fd97f7c525436361e6e6](#test_fd97f7c525436361e6e6) |
| **WP04.QLT.01** — Cada etapa informa próxima ação, responsável conhecido e motivo concreto da restrição, sem expor uma parede de comandos que só falham depois do clique. | PASS_SCOPED | Cada etapa descreve próximo passo/responsável/pendência; holder desconhecido e história incompleta ficam explícitos. Comandos de edição/decisão seguem o estágio e papel correntes; o holder alheio não é sobrescrito pela apresentação. | [test_1b731c02abaff1e0f580](#test_1b731c02abaff1e0f580), [test_6722bdf3f450851b51a3](#test_6722bdf3f450851b51a3), [test_6edb3b8d0deca3633eab](#test_6edb3b8d0deca3633eab), [test_7f36b3f5c2b6ce56a211](#test_7f36b3f5c2b6ce56a211), [test_81b1cd16baa1d21f71a4](#test_81b1cd16baa1d21f71a4), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_c094b536461ad6b8b697](#test_c094b536461ad6b8b697), [test_cc83f18a6e6b41f8c245](#test_cc83f18a6e6b41f8c245), [test_d75f0c6d9b77fc7d80e9](#test_d75f0c6d9b77fc7d80e9) |
| **WP04.QLT.02** — Valores, ranking e resumos mostram origem, moeda, versão e limitações; notas humanas não são apresentadas como medida objetiva de qualidade do fornecedor. | PASS_SCOPED | Base/original, moeda, FX submetido, versão e limitações aparecem no produtor e na interface. Ranking deriva do avaliador existente; avaliações humanas são identificadas como avaliações/configurações, e falta de material impede ranking completo. | [test_2b9422c6a67a4c2497e4](#test_2b9422c6a67a4c2497e4), [test_3dc7eb0ffcaa7ae2b2c9](#test_3dc7eb0ffcaa7ae2b2c9), [test_4794310ac9ebf90fb3e0](#test_4794310ac9ebf90fb3e0), [test_665a15fd31367d3aafd9](#test_665a15fd31367d3aafd9), [test_6b99f2ee2f1e8da8fb2f](#test_6b99f2ee2f1e8da8fb2f), [test_79177e5f3c3f904f61c5](#test_79177e5f3c3f904f61c5), [test_7dacfef73083a802eab4](#test_7dacfef73083a802eab4), [test_8a9f00368b47495ca8e4](#test_8a9f00368b47495ca8e4), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_a38d4034ab1d0f718782](#test_a38d4034ab1d0f718782), [test_a896da26bab38d48f910](#test_a896da26bab38d48f910), [test_c79004b8258e38abd7d9](#test_c79004b8258e38abd7d9) |
| **WP04.QLT.03** — Formulários e ações críticas são operáveis por teclado, mantêm foco após erro/conflito e apresentam a correção junto ao campo correspondente. | PASS_SCOPED | Browser de produção usa teclado, observa foco no erro422 real, preserva rascunho/comentário e exige escolha explícita da revisão no conflitoCAS. Resposta de save antigo não apaga edição posterior. Limites: Os dois testes de sourcing-controller são isolados e não são usados como substitutos desses journeys HTTP reais. | [test_1d4c2f1fc88efc258e49](#test_1d4c2f1fc88efc258e49), [test_8978c27ba56c5840645d](#test_8978c27ba56c5840645d), [test_8b456816a9ed2059980a](#test_8b456816a9ed2059980a), [test_c094b536461ad6b8b697](#test_c094b536461ad6b8b697), [test_cc83f18a6e6b41f8c245](#test_cc83f18a6e6b41f8c245) |
| **WP04.QLT.10** — Interfaces são concretas, versões/digests são verificáveis e falhas possuem causa e estado explícitos. | PASS_SCOPED | Interfaces tipadas e schemas fechados, source digest/ref/version, erro explícito e CAS/recibo durável são concretos. A view exibe proveniência recebida; o fence verifica material e acesso atual antes de entregar HTML. | [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_4c10b52c957255b3a1cc](#test_4c10b52c957255b3a1cc), [test_612b88a3e9700edca00f](#test_612b88a3e9700edca00f), [test_69d6f081e0cdfc30a58a](#test_69d6f081e0cdfc30a58a), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_86fdcce9cd94f8c153fa](#test_86fdcce9cd94f8c153fa), [test_fd97f7c525436361e6e6](#test_fd97f7c525436361e6e6), [test_ff56fdea15b62cb8e720](#test_ff56fdea15b62cb8e720) |
| **WP04.CMP.01** — A matriz de cobertura inclui requester, buyer, approver, supplier admin, admin, viewer e combinações já permitidas; estados normais, rejeitados, cancelados e emitidos não ficam fora. | PASS_SCOPED | Casos nomeados cobrem requester puro, buyer, holder/approver, supplier admin, admin, viewer e combinações já permitidas, incluindo estados normais/rejeitados/cancelled/issued. O caso HTTP novo inclui todos os 12 estados conhecidos e estado importado desconhecido. Limites: Não se exige um produto cartesiano de todos os papéis por todos os estados; isso não consta do critério. | [test_04d58ac83c173a6387af](#test_04d58ac83c173a6387af), [test_08094ef71a3f06d0d266](#test_08094ef71a3f06d0d266), [test_0dbe4a7e68e8770c4320](#test_0dbe4a7e68e8770c4320), [test_0ee9c599f7b129d16b7b](#test_0ee9c599f7b129d16b7b), [test_16e6710da78f60574528](#test_16e6710da78f60574528), [test_1b731c02abaff1e0f580](#test_1b731c02abaff1e0f580), [test_1d4c2f1fc88efc258e49](#test_1d4c2f1fc88efc258e49), [test_41d25e7b44f10c3c469f](#test_41d25e7b44f10c3c469f), [test_651e0ea6cd19c23b35e2](#test_651e0ea6cd19c23b35e2), [test_6722bdf3f450851b51a3](#test_6722bdf3f450851b51a3), [test_6ec0aaad82d767ef6d90](#test_6ec0aaad82d767ef6d90), [test_7f36b3f5c2b6ce56a211](#test_7f36b3f5c2b6ce56a211), [test_868acd09c14bbc5badb7](#test_868acd09c14bbc5badb7), [test_a7f1ee5535ca0a5020ce](#test_a7f1ee5535ca0a5020ce), [test_cc83f18a6e6b41f8c245](#test_cc83f18a6e6b41f8c245), [test_d75f0c6d9b77fc7d80e9](#test_d75f0c6d9b77fc7d80e9), [test_da0cdc62b37d2701a8c1](#test_da0cdc62b37d2701a8c1) |
| **WP04.CMP.02** — A cobertura monetária inclui moeda base, moeda estrangeira, FX ausente, mudança de taxa após submissão, proposta incompleta e divergência entre total informado e quantidade vezes preço. | PASS_SCOPED | Casos monetários incluem base e estrangeira, FX ausente/inválido, troca posterior de taxa/base, proposta incompleta, overflow, ambiguidade e total divergente de quantidade×preço; o produtor e a apresentação preservam indisponibilidade. | [test_2b9422c6a67a4c2497e4](#test_2b9422c6a67a4c2497e4), [test_3dc7eb0ffcaa7ae2b2c9](#test_3dc7eb0ffcaa7ae2b2c9), [test_4794310ac9ebf90fb3e0](#test_4794310ac9ebf90fb3e0), [test_665a15fd31367d3aafd9](#test_665a15fd31367d3aafd9), [test_6b99f2ee2f1e8da8fb2f](#test_6b99f2ee2f1e8da8fb2f), [test_79177e5f3c3f904f61c5](#test_79177e5f3c3f904f61c5), [test_7dacfef73083a802eab4](#test_7dacfef73083a802eab4), [test_8a9f00368b47495ca8e4](#test_8a9f00368b47495ca8e4), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_a38d4034ab1d0f718782](#test_a38d4034ab1d0f718782), [test_a896da26bab38d48f910](#test_a896da26bab38d48f910), [test_c79004b8258e38abd7d9](#test_c79004b8258e38abd7d9) |
| **WP04.CMP.03** — Cadastro/ativação/bloqueio/inativação/banco de fornecedor, configurações/reset, histórico, registros/exportações e referências existentes permanecem acessíveis. | PASS_SCOPED | Cadastro e quatro estados de fornecedor, banco/revalidação, configurações/reset, campos originais, referências/linked requests, histórico e downloads permanecem no produto real com testes por comportamento. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_08094ef71a3f06d0d266](#test_08094ef71a3f06d0d266), [test_0dbe4a7e68e8770c4320](#test_0dbe4a7e68e8770c4320), [test_0ee9c599f7b129d16b7b](#test_0ee9c599f7b129d16b7b), [test_16e6710da78f60574528](#test_16e6710da78f60574528), [test_4d1bf09c609d665f42d0](#test_4d1bf09c609d665f42d0), [test_636c917673d6d1ca810e](#test_636c917673d6d1ca810e), [test_6ec0aaad82d767ef6d90](#test_6ec0aaad82d767ef6d90), [test_7fb9bd61e2a0d844dcfe](#test_7fb9bd61e2a0d844dcfe), [test_8978c27ba56c5840645d](#test_8978c27ba56c5840645d), [test_a7f1ee5535ca0a5020ce](#test_a7f1ee5535ca0a5020ce), [test_b66e531a2da6e4681149](#test_b66e531a2da6e4681149), [test_f72276a4ca0247e5b52d](#test_f72276a4ca0247e5b52d) |
| **WP04.CMP.10** — Todas as obrigações 5/18/8/C17 desta frente têm task, owner, paths, consumidor e negativos discriminantes. | PASS_SCOPED | Manifesto contém perfis/skills/packs/routes reais e descritores atribuem producerTask/handler/export/schema. O catálogo final de 111 critérios deve mapear owner, consumidor e negativos para as obrigações WP04; a mera ausência de Session não invalida essa estrutura. | [test_159cd3e85ec06bf5fef7](#test_159cd3e85ec06bf5fef7), [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_45a88b09f681f263f4a4](#test_45a88b09f681f263f4a4), [test_4c10b52c957255b3a1cc](#test_4c10b52c957255b3a1cc), [test_612b88a3e9700edca00f](#test_612b88a3e9700edca00f), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_9b1d7f1d61ff5bd1daa8](#test_9b1d7f1d61ff5bd1daa8), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.SUC.01** — No roteiro sintético, o aprovador identifica em até 30 segundos a etapa que decide, o valor, a diferença relevante, a razão da escolha e o próximo passo, sem abrir Settings. | NOT_RUN_HUMAN | Interface automatizada mostra etapa, valor, diferença e motivo. Isso não mede tempo de compreensão de uma pessoa. Limites: Não foi observado um aprovador humano completar o roteiro em até 30 segundos sem abrir Settings. Playwright e screenshots não constituem cronômetro humano. | [test_1b731c02abaff1e0f580](#test_1b731c02abaff1e0f580), [test_665a15fd31367d3aafd9](#test_665a15fd31367d3aafd9), [test_6722bdf3f450851b51a3](#test_6722bdf3f450851b51a3), [test_7dacfef73083a802eab4](#test_7dacfef73083a802eab4), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_a896da26bab38d48f910](#test_a896da26bab38d48f910), [test_c79004b8258e38abd7d9](#test_c79004b8258e38abd7d9), [test_d75f0c6d9b77fc7d80e9](#test_d75f0c6d9b77fc7d80e9) |
| **WP04.SUC.02** — No roteiro PR até PO, o buyer não redigita fornecedor, moeda e quantidade já selecionados quando esses valores podem ser reutilizados; sugestões identificam a origem e preservam ajustes negociados. | PASS_SCOPED | Journey real PR→PO reutiliza fornecedor/moeda/quantidade identificados e mantém valores negociados. Origem/sugestão é explicada e não substitui ajustes registrados. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_11be8600feabcc3939a3](#test_11be8600feabcc3939a3), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_a66dd1a7afd35a7c619f](#test_a66dd1a7afd35a7c619f), [test_cd95359b933ff26f6988](#test_cd95359b933ff26f6988), [test_f72276a4ca0247e5b52d](#test_f72276a4ca0247e5b52d) |
| **WP04.SUC.03** — Os casos adversos distinguem aprovado de emitido, desconhecido de zero e versão atual de versão desatualizada; nenhuma dessas diferenças é ocultada por um resultado visual aparentemente correto. | PASS_SCOPED | Aprovado e emitido, zero e ausência, FX atual/submetido e revisão corrente/stale têm resultados distintos. Browser observa conflito real e aprovação cancelada; fonte alterada entre leitura e render não produz HTML aparentemente atual. | [test_1d4c2f1fc88efc258e49](#test_1d4c2f1fc88efc258e49), [test_2b9422c6a67a4c2497e4](#test_2b9422c6a67a4c2497e4), [test_335a0ecbd0f6e78e1f92](#test_335a0ecbd0f6e78e1f92), [test_37ca611787de8cd9f60e](#test_37ca611787de8cd9f60e), [test_3dc7eb0ffcaa7ae2b2c9](#test_3dc7eb0ffcaa7ae2b2c9), [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_612b88a3e9700edca00f](#test_612b88a3e9700edca00f), [test_69d6f081e0cdfc30a58a](#test_69d6f081e0cdfc30a58a), [test_6b99f2ee2f1e8da8fb2f](#test_6b99f2ee2f1e8da8fb2f), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_79177e5f3c3f904f61c5](#test_79177e5f3c3f904f61c5), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_cc83f18a6e6b41f8c245](#test_cc83f18a6e6b41f8c245), [test_fd97f7c525436361e6e6](#test_fd97f7c525436361e6e6), [test_ff56fdea15b62cb8e720](#test_ff56fdea15b62cb8e720) |
| **WP04.SUC.10** — O consumidor integrado utiliza a saída de produção sem substituto fictício e o revisor consegue reproduzir o resultado. | PASS_SCOPED | Consumidores montados usam C02/C06/C12/dossiê/dispatcher reais e persistência real, com teste reproduzível de HTTP e browser. O cenário de escolha C12 é dado persistido de teste e não se apresenta como saída de modelo. Limites: Este alcance não é aceitação de todo o residente: DOD.10 e os critérios nativos explicitamente listados permanecem bloqueados por seus recibos próprios. | [test_45a88b09f681f263f4a4](#test_45a88b09f681f263f4a4), [test_612b88a3e9700edca00f](#test_612b88a3e9700edca00f), [test_7f36b3f5c2b6ce56a211](#test_7f36b3f5c2b6ce56a211), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_9b1d7f1d61ff5bd1daa8](#test_9b1d7f1d61ff5bd1daa8), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.T01.CHK.01** — Comparar a leitura do mesmo conjunto por requester puro e buyer: o requester recebe apenas seus pedidos também em totais, pendências e referências; inserir um pedido alheio deve alterar o buyer e não o requester. | PASS_SCOPED | Requester só recebe seus registros, inclusive stock/aging/drilldown; adicionar registro de outro ator mantém sua seleção e torna a do buyer stale/atualizável. Página real também exclui target estrangeiro. | [test_651e0ea6cd19c23b35e2](#test_651e0ea6cd19c23b35e2), [test_7f36b3f5c2b6ce56a211](#test_7f36b3f5c2b6ce56a211), [test_bf481403d481f938378b](#test_bf481403d481f938378b), [test_da0cdc62b37d2701a8c1](#test_da0cdc62b37d2701a8c1) |
| **WP04.T01.CHK.02** — Dado pedido submetido, rejeitado, ressubmetido e salvo depois, a idade usa a última entrada na etapa pendente; alterar apenas o horário do save não altera essa idade. | PASS_SCOPED | Última submissão comprovada e aprovação do nível anterior definem entrada; rejeição/ressubmissão são consideradas. Save posterior não reinicia idade; view C02 não relê nem inventa história. | [test_4a7570a102f62d022524](#test_4a7570a102f62d022524), [test_4b4ffc93a4e81f446cdb](#test_4b4ffc93a4e81f446cdb), [test_6edb3b8d0deca3633eab](#test_6edb3b8d0deca3633eab), [test_81b1cd16baa1d21f71a4](#test_81b1cd16baa1d21f71a4), [test_bf481403d481f938378b](#test_bf481403d481f938378b), [test_e6bba87aaafbd0babca3](#test_e6bba87aaafbd0babca3) |
| **WP04.T01.CHK.03** — Retirar o evento que comprova a entrada na etapa: C02 marca idade indisponível e a fila mantém o pedido; não usa criação como fallback nem calcula uma duração fictícia. | PASS_SCOPED | Retirada de evento mantém registro na fila e marca ageDays ausente; a apresentação usa null/Unavailable da projeção e preserva o grupo sem calcular idade de criação/save. | [test_335a0ecbd0f6e78e1f92](#test_335a0ecbd0f6e78e1f92), [test_37ca611787de8cd9f60e](#test_37ca611787de8cd9f60e), [test_4a7570a102f62d022524](#test_4a7570a102f62d022524), [test_4b4ffc93a4e81f446cdb](#test_4b4ffc93a4e81f446cdb), [test_6edb3b8d0deca3633eab](#test_6edb3b8d0deca3633eab), [test_7f36b3f5c2b6ce56a211](#test_7f36b3f5c2b6ce56a211), [test_81b1cd16baa1d21f71a4](#test_81b1cd16baa1d21f71a4), [test_bf481403d481f938378b](#test_bf481403d481f938378b), [test_e6bba87aaafbd0babca3](#test_e6bba87aaafbd0babca3) |
| **WP04.T01.CHK.04** — Um pedido com holder diferente do ator não oferece aprovação como próxima ação; holder ausente aparece explicitamente sem responsável, sem criar autorização nova. | PASS_SCOPED | Agrupamento deriva do holder observado. A possibilidade de decidir continua em approvalDecision/domínio; holder alheio bloqueia e ausente é exibido como Unassigned, sem identidade ou poder inventado. | [test_1b731c02abaff1e0f580](#test_1b731c02abaff1e0f580), [test_6722bdf3f450851b51a3](#test_6722bdf3f450851b51a3), [test_7f36b3f5c2b6ce56a211](#test_7f36b3f5c2b6ce56a211), [test_cc83f18a6e6b41f8c245](#test_cc83f18a6e6b41f8c245), [test_d75f0c6d9b77fc7d80e9](#test_d75f0c6d9b77fc7d80e9) |
| **WP04.T01.CHK.18** — Executar sf_request_read pela UI/native/MCP com base e autoridade iguais produz o mesmo handler, resultado e versão; chamada direta sem concessão ou após revogação é recusada pelo destino. | BLOCKED_NATIVE | UI binding aciona dispatcher e handler reais; há recusa antes de concessão consumida, unknown source, stale e revogação do produtor. Não há recibo de chamadas correspondentes nas superfícies nativas. Limites: Falta recibo de execução real com SessionV2/SkillLoadReceipt e chamadas sf_request_read pela UI/native/MCP sob a mesma base e autoridade, comparando handler, resultado, versão e recusas. Catálogo/manifesto, UI e dispatcher real não substituem essa prova. | [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_86fdcce9cd94f8c153fa](#test_86fdcce9cd94f8c153fa), [test_fd97f7c525436361e6e6](#test_fd97f7c525436361e6e6) |
| **WP04.T01.DOD.01** — As filas exportadas consomem a projeção C02 de Procurement e cobrem cada estado atual do baseline. | PASS_SCOPED | Lacuna anterior fechada estaticamente: queue-page prepara a seleção real antes do lock; queue-view apresenta C02 e runtime.render consome as rows em Requests/My approvals. current confere actor/grant, coleção, moeda, digest material e fonte dentro do lock. Estados do baseline e unknown têm caso HTTP; nenhum contexto/evidenceRef sintético é criado pelo adaptador. | [test_335a0ecbd0f6e78e1f92](#test_335a0ecbd0f6e78e1f92), [test_37ca611787de8cd9f60e](#test_37ca611787de8cd9f60e), [test_7f36b3f5c2b6ce56a211](#test_7f36b3f5c2b6ce56a211), [test_89cb3069fbd8c7923a51](#test_89cb3069fbd8c7923a51), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_bf481403d481f938378b](#test_bf481403d481f938378b), [test_fd97f7c525436361e6e6](#test_fd97f7c525436361e6e6) |
| **WP04.T01.DOD.02** — O mapa estado/papel/próxima ação e a proveniência da idade estão anexados ao handoff local. | PASS_SCOPED | coverage-inventory já contém12 estados, papéis, ações e regra de entrada/ausência. A atualização final deve trocar o limite obsoleto sobre UI legado pelo seam atual, com fontes exatas. | [test_1b731c02abaff1e0f580](#test_1b731c02abaff1e0f580), [test_4a7570a102f62d022524](#test_4a7570a102f62d022524), [test_4b4ffc93a4e81f446cdb](#test_4b4ffc93a4e81f446cdb), [test_6722bdf3f450851b51a3](#test_6722bdf3f450851b51a3), [test_6edb3b8d0deca3633eab](#test_6edb3b8d0deca3633eab), [test_81b1cd16baa1d21f71a4](#test_81b1cd16baa1d21f71a4), [test_d75f0c6d9b77fc7d80e9](#test_d75f0c6d9b77fc7d80e9), [test_e6bba87aaafbd0babca3](#test_e6bba87aaafbd0babca3) |
| **WP04.T01.DOD.18** — Descritores C16 de sf_request_read são implementados e consumidos por T06 com referências reais. | BLOCKED_NATIVE | Descritor sf_request_read, handler, schemas e rotas/profil/skill existem e estão montados. A estrutura está pronta, mas o consumo T06 indicado no pack é a ponte nativa WP10.T06 e não foi executado neste checkpoint. Limites: Falta execução real do consumidor WP10.T06 pela ponte nativa com fonte emitida e SkillLoadReceipt; não confundir registro do descritor ou chamada UI real com esse consumo. | [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_9b1d7f1d61ff5bd1daa8](#test_9b1d7f1d61ff5bd1daa8), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.T01.INV.01** — Filas, totais e deep links compartilham o mesmo recorte autorizado de requests. | PASS_SCOPED | Filas/stock/aging vêm da mesma coleção autorizada. Renderer une seus detalhes somente aos IDs da coleção atual sob fence. Drilldown URL é reautorizado na nova página; ref de coleção em HTML é proveniência efêmera, não ticket durável. | [test_651e0ea6cd19c23b35e2](#test_651e0ea6cd19c23b35e2), [test_7f36b3f5c2b6ce56a211](#test_7f36b3f5c2b6ce56a211), [test_bf481403d481f938378b](#test_bf481403d481f938378b), [test_da0cdc62b37d2701a8c1](#test_da0cdc62b37d2701a8c1), [test_fd97f7c525436361e6e6](#test_fd97f7c525436361e6e6) |
| **WP04.T01.INV.02** — Salvar um campo não reinicia a idade da etapa; histórico insuficiente não produz data presumida. | PASS_SCOPED | Produtor único usa evento de entrada comprovado; adapter apenas ordena datas/valores recebidos e preserva null. Salvar campo sem transição não altera idade da etapa. | [test_335a0ecbd0f6e78e1f92](#test_335a0ecbd0f6e78e1f92), [test_37ca611787de8cd9f60e](#test_37ca611787de8cd9f60e), [test_4a7570a102f62d022524](#test_4a7570a102f62d022524), [test_4b4ffc93a4e81f446cdb](#test_4b4ffc93a4e81f446cdb), [test_6edb3b8d0deca3633eab](#test_6edb3b8d0deca3633eab), [test_81b1cd16baa1d21f71a4](#test_81b1cd16baa1d21f71a4), [test_bf481403d481f938378b](#test_bf481403d481f938378b), [test_e6bba87aaafbd0babca3](#test_e6bba87aaafbd0babca3) |
| **WP04.T01.INV.18** — Permissões, locks, cálculos e comandos finais continuam no domínio; o transporte não cria poder novo. | PASS_SCOPED | O transporte não executa mutação nem concede poder. UI grant é consumido, autoridade é revalidada e domínio continua dono de cálculo/comando/holder/lock. O novo fence usa currentSnapshots durante o lock e não inicia transação de port.list aninhada. | [test_04d58ac83c173a6387af](#test_04d58ac83c173a6387af), [test_41d25e7b44f10c3c469f](#test_41d25e7b44f10c3c469f), [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_868acd09c14bbc5badb7](#test_868acd09c14bbc5badb7), [test_86fdcce9cd94f8c153fa](#test_86fdcce9cd94f8c153fa), [test_fd97f7c525436361e6e6](#test_fd97f7c525436361e6e6) |
| **WP04.T01.QLT.01** — Cada linha explica estado, próxima ação e responsável conhecido sem depender de códigos internos. | PASS_SCOPED | Rows mostram descrição da etapa, próximo passo C02, responsável conhecido ou Unassigned e motivo concreto; identificadores só complementam pessoa não resolvida. Campos ausentes continuam indisponíveis. | [test_1b731c02abaff1e0f580](#test_1b731c02abaff1e0f580), [test_6722bdf3f450851b51a3](#test_6722bdf3f450851b51a3), [test_6edb3b8d0deca3633eab](#test_6edb3b8d0deca3633eab), [test_7f36b3f5c2b6ce56a211](#test_7f36b3f5c2b6ce56a211), [test_81b1cd16baa1d21f71a4](#test_81b1cd16baa1d21f71a4), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_d75f0c6d9b77fc7d80e9](#test_d75f0c6d9b77fc7d80e9) |
| **WP04.T01.QLT.02** — Ordenação e filtros são visíveis, reversíveis e operáveis por teclado. | PASS_SCOPED | Ordenação é anunciada por entrada comprovada, datas ausentes por último e ID para desempate. Sexto browser agora percorre filtro/busca com Home/ArrowDown/Tab/Enter e desfaz a seleção com End/Tab/Enter, reencontrando a mesma linha e valor. | [test_6edb3b8d0deca3633eab](#test_6edb3b8d0deca3633eab), [test_81b1cd16baa1d21f71a4](#test_81b1cd16baa1d21f71a4), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf) |
| **WP04.T01.QLT.18** — Schema fechado, ausência/falha explícitas e provenance permitem comparar UI/native/MCP. | PASS_SCOPED | Schemas fechados, ausência/stale/unavailable/denied explícitos, refs/digests/version e recibo UI permitem comparar resultados. O enunciado pede estrutura comparável; sua conclusão estrutural não depende de inventar uma Session executada. Limites: A comparação realmente executada nas três superfícies pertence a CHK.18/SUC.18 e permanece bloqueada separadamente. | [test_335a0ecbd0f6e78e1f92](#test_335a0ecbd0f6e78e1f92), [test_37ca611787de8cd9f60e](#test_37ca611787de8cd9f60e), [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_86fdcce9cd94f8c153fa](#test_86fdcce9cd94f8c153fa), [test_fd97f7c525436361e6e6](#test_fd97f7c525436361e6e6) |
| **WP04.T01.CMP.01** — Incluir rejeitados, cancelados, emitidos, sem holder e históricos incompletos, além do caminho feliz. | PASS_SCOPED | Caso de página inclui12 estados correntes e unknown; casos separados cobrem sem holder, história incompleta, rejeição, cancelamento e emissão interna. Não limita o teste ao caminho feliz. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_1b731c02abaff1e0f580](#test_1b731c02abaff1e0f580), [test_335a0ecbd0f6e78e1f92](#test_335a0ecbd0f6e78e1f92), [test_37ca611787de8cd9f60e](#test_37ca611787de8cd9f60e), [test_651e0ea6cd19c23b35e2](#test_651e0ea6cd19c23b35e2), [test_6722bdf3f450851b51a3](#test_6722bdf3f450851b51a3), [test_7f36b3f5c2b6ce56a211](#test_7f36b3f5c2b6ce56a211), [test_d75f0c6d9b77fc7d80e9](#test_d75f0c6d9b77fc7d80e9), [test_da0cdc62b37d2701a8c1](#test_da0cdc62b37d2701a8c1), [test_f72276a4ca0247e5b52d](#test_f72276a4ca0247e5b52d) |
| **WP04.T01.CMP.02** — Entregar referência estável de drilldown e contexto de versão para cada pedido visível. | PASS_SCOPED | C02 inclui evidence ref e versão por pedido. Links Requests/My approvals identificam target autorizado e contexto C02; abrir o link reautoriza o record e produz seleção atual. Ref de seleção expira/libera com a página e não é vendida como concessão ou ticket persistente. | [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_7f36b3f5c2b6ce56a211](#test_7f36b3f5c2b6ce56a211), [test_89cb3069fbd8c7923a51](#test_89cb3069fbd8c7923a51), [test_bf481403d481f938378b](#test_bf481403d481f938378b) |
| **WP04.T01.CMP.18** — Cobrir todos os exports desta task (1), caso autorizado, direto proibido, stale e indisponível. | PASS_SCOPED | Único export desta task é readRequest: caso autorizado real, chamada direta antes de consumo negada, referência não emitida unavailable e fonte modificada stale estão assertados no mesmo teste com lifecycle/SQLite. Schema forjado tem negativo próprio. Limites: Não se inventa uma matriz cartesiana nativa para este enunciado; execução UI/native/MCP é a obrigação distinta de CHK.18. | [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_86fdcce9cd94f8c153fa](#test_86fdcce9cd94f8c153fa) |
| **WP04.T01.SUC.01** — Requester e buyer localizam seus pedidos e distinguem falta de informação de espera por outra pessoa sem executar uma ação inválida. | PASS_SCOPED | Requester e buyer navegam os mesmos registros reais sob seus recortes, localizam linha/target e distinguem falta de dados de espera por holder. Browser/HTTP exercitam esses fluxos; o enunciado não acrescenta observador humano ou prazo de30 segundos. Limites: Esta avaliação não é a medição humana exigida por WP04.SUC.01. | [test_1b731c02abaff1e0f580](#test_1b731c02abaff1e0f580), [test_6722bdf3f450851b51a3](#test_6722bdf3f450851b51a3), [test_6edb3b8d0deca3633eab](#test_6edb3b8d0deca3633eab), [test_7f36b3f5c2b6ce56a211](#test_7f36b3f5c2b6ce56a211), [test_81b1cd16baa1d21f71a4](#test_81b1cd16baa1d21f71a4), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_bf481403d481f938378b](#test_bf481403d481f938378b), [test_cc83f18a6e6b41f8c245](#test_cc83f18a6e6b41f8c245), [test_d75f0c6d9b77fc7d80e9](#test_d75f0c6d9b77fc7d80e9) |
| **WP04.T01.SUC.02** — Aging e contagens fornecidos a WP05 reproduzem a seleção autorizada e não divergem da fila. | PASS_SCOPED | queue-lifecycle compõe createProcurementBiSource real: BI05 é igual ao stock real do port, BI06 repete aging (com ID prefixado), sem fórmula nova; recorte, alteração alheia, missing age, stale e revogação são preservados. Limites: Prova descrita é execução do adaptador WP05 real junto da porta; não se atribui a ela uma jornada na página completa de BI. | [test_4a7570a102f62d022524](#test_4a7570a102f62d022524), [test_4b4ffc93a4e81f446cdb](#test_4b4ffc93a4e81f446cdb), [test_7f36b3f5c2b6ce56a211](#test_7f36b3f5c2b6ce56a211), [test_89cb3069fbd8c7923a51](#test_89cb3069fbd8c7923a51), [test_bf481403d481f938378b](#test_bf481403d481f938378b), [test_e6bba87aaafbd0babca3](#test_e6bba87aaafbd0babca3) |
| **WP04.T01.SUC.18** — O usuário recebe a mesma capacidade e resultado pelas superfícies sem divergência ou efeitos adicionais. | BLOCKED_NATIVE | UI real passa pelo mesmo descritor/handler exportado; não existe resultado verificado correspondente de native/MCP que permita concluir igualdade final das superfícies. Limites: Falta recibo de execução real com SessionV2/SkillLoadReceipt e chamadas sf_request_read pela UI/native/MCP sob a mesma base e autoridade, comparando handler, resultado, versão e recusas. Catálogo/manifesto, UI e dispatcher real não substituem essa prova. | [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b) |
| **WP04.T02.CHK.01** — Percorrer PR aprovada até a proposta de PO: fornecedor, moeda e quantidade selecionados reaparecem sem redigitação; uma condição negociada já presente na PO não é substituída por default do fornecedor. | PASS_SCOPED | Real PR→issued-PO browser plus source-guidance/address-default unit tests prove reuse and negotiated values. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_11be8600feabcc3939a3](#test_11be8600feabcc3939a3), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_c86a66c74112c7dba39a](#test_c86a66c74112c7dba39a), [test_e53c4313f3b741674de2](#test_e53c4313f3b741674de2) |
| **WP04.T02.CHK.02** — Alternar compra recorrente e não recorrente e estratégia existing/new: campos e validações aplicáveis acompanham o estado sem apagar valores previamente salvos nem aceitar submissão que o validador existente recusa. | PASS_SCOPED | Browser recurring toggle and existing/new strategy plus real validator unit refusal preserve saved values. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_a66dd1a7afd35a7c619f](#test_a66dd1a7afd35a7c619f), [test_cd95359b933ff26f6988](#test_cd95359b933ff26f6988), [test_e51b65c2845be17a5dde](#test_e51b65c2845be17a5dde) |
| **WP04.T02.CHK.03** — Dois atores abrem a mesma versão; o segundo tenta salvar após a alteração do primeiro: o comando retorna conflito, os valores do segundo continuam visíveis e o primeiro registro não é sobrescrito silenciosamente. | PASS_SCOPED | Two real authenticated actors; actual409/currentCAS, explicit review and no automatic replay. | [test_1d4c2f1fc88efc258e49](#test_1d4c2f1fc88efc258e49), [test_3d58223cc007ea33c1c5](#test_3d58223cc007ea33c1c5), [test_8b456816a9ed2059980a](#test_8b456816a9ed2059980a), [test_f72276a4ca0247e5b52d](#test_f72276a4ca0247e5b52d) |
| **WP04.T02.CHK.04** — Tentar excluir pedido fora de draft ou cancelar po_issued continua recusado; ocultar o botão não substitui a recusa do comando real. | PASS_SCOPED | Runtime command negatives prove terminal cancel/delete denial; legal draft deletion is separately tested. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_41d25e7b44f10c3c469f](#test_41d25e7b44f10c3c469f), [test_636c917673d6d1ca810e](#test_636c917673d6d1ca810e) |
| **WP04.T02.DOD.01** — PR, sourcing e PO têm apresentação progressiva e roundtrip completo dos campos originais. | PASS_SCOPED | Root full-field sentinel roundtrip, recorded enum preservation, and actual rendered-row saves now cover the identified preservation gaps. PO metadata follows a request-bound omitted-metadata digest with original-index hint across repeated saves/removal/reorder; quote metadata follows unique IDs. Explicit payload edits win, new rows never inherit, ambiguous references are refused after CAS and role gates. Hosted execution remains required. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_08094ef71a3f06d0d266](#test_08094ef71a3f06d0d266), [test_2fa9e9772cbb800072e6](#test_2fa9e9772cbb800072e6), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_a66dd1a7afd35a7c619f](#test_a66dd1a7afd35a7c619f), [test_e51b65c2845be17a5dde](#test_e51b65c2845be17a5dde), [test_e6041c1e1bc3abb0dfd6](#test_e6041c1e1bc3abb0dfd6), [test_eb9fea80269b71e960bd](#test_eb9fea80269b71e960bd) |
| **WP04.T02.DOD.02** — Os estados de erro e conflito conservam entradas locais e permitem retomar a tarefa. | PASS_SCOPED | Browser422,409, cancelled-approval and delayed-save scenarios preserve inputs and enable deliberate recovery. | [test_1d4c2f1fc88efc258e49](#test_1d4c2f1fc88efc258e49), [test_3d58223cc007ea33c1c5](#test_3d58223cc007ea33c1c5), [test_8b456816a9ed2059980a](#test_8b456816a9ed2059980a), [test_a66dd1a7afd35a7c619f](#test_a66dd1a7afd35a7c619f), [test_c094b536461ad6b8b697](#test_c094b536461ad6b8b697), [test_cc83f18a6e6b41f8c245](#test_cc83f18a6e6b41f8c245), [test_f72276a4ca0247e5b52d](#test_f72276a4ca0247e5b52d) |
| **WP04.T02.INV.01** — Pré-preenchimento é sugestão identificada ou cópia de dado existente; não inventa condição comercial nem substitui ajuste negociado. | PASS_SCOPED | Identified sources/defaults in guidance; browser negotiated terms remain after another save. | [test_11be8600feabcc3939a3](#test_11be8600feabcc3939a3), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_c86a66c74112c7dba39a](#test_c86a66c74112c7dba39a), [test_e53c4313f3b741674de2](#test_e53c4313f3b741674de2) |
| **WP04.T02.INV.02** — Ocultar uma seção ou comando não altera a autorização, a transição legal ou os dados persistidos. | PASS_SCOPED | Actual command role/transition negatives, dual-role cases and hidden recurrence persistence; no UI permission replacement. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_04d58ac83c173a6387af](#test_04d58ac83c173a6387af), [test_41d25e7b44f10c3c469f](#test_41d25e7b44f10c3c469f), [test_a66dd1a7afd35a7c619f](#test_a66dd1a7afd35a7c619f), [test_cc83f18a6e6b41f8c245](#test_cc83f18a6e6b41f8c245) |
| **WP04.T02.QLT.01** — A pendência aponta o campo e a correção necessária, sem um erro genérico no fim do formulário. | PASS_SCOPED | Dynamic422 accessible name/description/focus assertions plus adjacent-source error units. | [test_5cef8551fb09ae7191f1](#test_5cef8551fb09ae7191f1), [test_5dd1a303f67143bd69ff](#test_5dd1a303f67143bd69ff), [test_760e91b918f1f5be8465](#test_760e91b918f1f5be8465), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_c094b536461ad6b8b697](#test_c094b536461ad6b8b697) |
| **WP04.T02.QLT.02** — Ações de salvar, revisar conflito e continuar mantêm foco e contexto do pedido. | PASS_SCOPED | W5 save focus, conflict-review focus and request/version context are asserted in the real browser. | [test_1d4c2f1fc88efc258e49](#test_1d4c2f1fc88efc258e49), [test_5cef8551fb09ae7191f1](#test_5cef8551fb09ae7191f1), [test_c094b536461ad6b8b697](#test_c094b536461ad6b8b697), [test_f72276a4ca0247e5b52d](#test_f72276a4ca0247e5b52d) |
| **WP04.T02.CMP.01** — Cobrir os campos obrigatórios/condicionais de PR, sourcing e PO, defaults, linhas repetidas e histórico. | PASS_SCOPED | Required/conditional positive journey, recurrence/contract negative validators, defaults, multi-quote/repeated-row normalization and Porta history assertions combine without needing all combinations. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_a66dd1a7afd35a7c619f](#test_a66dd1a7afd35a7c619f), [test_c094b536461ad6b8b697](#test_c094b536461ad6b8b697), [test_c86a66c74112c7dba39a](#test_c86a66c74112c7dba39a), [test_cd95359b933ff26f6988](#test_cd95359b933ff26f6988), [test_e51b65c2845be17a5dde](#test_e51b65c2845be17a5dde), [test_eb9fea80269b71e960bd](#test_eb9fea80269b71e960bd) |
| **WP04.T02.CMP.02** — Cobrir retomada, rejeição, cancelamento e exclusão somente nas condições existentes. | PASS_SCOPED | Porta reject PR/SRC/PO, PR and sourcing resubmission, cancel preservation, actual draft delete/terminal negatives combine with actual UI cancellation conflict. No new Cartesian stage × role demand. | [test_004803f588e1eb524a49](#test_004803f588e1eb524a49), [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_636c917673d6d1ca810e](#test_636c917673d6d1ca810e), [test_774ae7de798e5e2c67bb](#test_774ae7de798e5e2c67bb), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_93beeae51b7da70de4e1](#test_93beeae51b7da70de4e1), [test_ca755c19cb9ff8232be3](#test_ca755c19cb9ff8232be3), [test_cc83f18a6e6b41f8c245](#test_cc83f18a6e6b41f8c245) |
| **WP04.T02.SUC.01** — O roteiro de compra reutiliza os dados já confirmados e deixa visível a origem de cada sugestão. | PASS_SCOPED | Confirmed source values and origins visible in real PO journey; ambiguity/default behavior in unit tests. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_11be8600feabcc3939a3](#test_11be8600feabcc3939a3), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_c86a66c74112c7dba39a](#test_c86a66c74112c7dba39a), [test_e53c4313f3b741674de2](#test_e53c4313f3b741674de2) |
| **WP04.T02.SUC.02** — Uma edição concorrente não destrói entrada local nem produz confirmação de salvamento inexistente. | PASS_SCOPED | Actual stale save and delayed response tests distinguish committed values from later unsaved edits. | [test_1d4c2f1fc88efc258e49](#test_1d4c2f1fc88efc258e49), [test_3d58223cc007ea33c1c5](#test_3d58223cc007ea33c1c5), [test_8b456816a9ed2059980a](#test_8b456816a9ed2059980a), [test_f72276a4ca0247e5b52d](#test_f72276a4ca0247e5b52d) |
| **WP04.T03.CHK.01** — Fixture: A USD 32.400, notas técnicas [5,4,4,4,4], comerciais manuais [4,4]; B EUR 28.000 a 1,08, notas [4,4,4,3,4] e [5,4]; C USD 29.000 não conforme. Esperar A 87,9333..., B 85, C fora do ranking, diferença A versus menor conforme USD 2.160/7,142857...%; a UI deve mostrar o arredondamento sem alterar a ordem. | PASS_SCOPED | O fixture canônico atravessa motor, schema fechado e dispatcher com componentes exatos; o browser verifica 87.9/85.0, ranking A/B, exclusão C e prêmio 2160 USD/7.14%. | [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_a38d4034ab1d0f718782](#test_a38d4034ab1d0f718782), [test_c79004b8258e38abd7d9](#test_c79004b8258e38abd7d9), [test_da582267b77c61f4c987](#test_da582267b77c61f4c987), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.T03.CHK.02** — Deixar uma nota obrigatória vazia ou manter somente uma proposta: a UI declara incompletude/comparação limitada e a submissão segue exatamente o validador vigente; não inventa nota zero nem nova exceção. | PASS_SCOPED | Ausência de nota manual e proposta única mantêm scores/ranking indisponíveis; os validadores vigentes continuam responsáveis pela submissão e pelo feedback. Não se exige repetir toda combinação em browser. | [test_3dc7eb0ffcaa7ae2b2c9](#test_3dc7eb0ffcaa7ae2b2c9), [test_5cef8551fb09ae7191f1](#test_5cef8551fb09ae7191f1), [test_7dacfef73083a802eab4](#test_7dacfef73083a802eab4), [test_896c646fb46b2be532fe](#test_896c646fb46b2be532fe), [test_c094b536461ad6b8b697](#test_c094b536461ad6b8b697), [test_dd8764a3fcf1fa32068a](#test_dd8764a3fcf1fa32068a) |
| **WP04.T03.CHK.03** — Mudar a taxa configurada depois da submissão: a decisão pendente preserva o valor/câmbio congelado; remover FX de uma comparação sem snapshot produz indisponibilidade/pendência, nunca total zero. | PASS_SCOPED | FX submetido 1.08 continua produzindo 30240 USD após taxa atual 2; ausência permanece null. FR-03 cobre também base PR congelada USD quando Settings passa a GBP, sem converter por taxa live. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_2b9422c6a67a4c2497e4](#test_2b9422c6a67a4c2497e4), [test_4794310ac9ebf90fb3e0](#test_4794310ac9ebf90fb3e0), [test_8978c27ba56c5840645d](#test_8978c27ba56c5840645d), [test_8a9f00368b47495ca8e4](#test_8a9f00368b47495ca8e4), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_a896da26bab38d48f910](#test_a896da26bab38d48f910), [test_a9ee78304a4fa786cafc](#test_a9ee78304a4fa786cafc), [test_da1763a95c4ea64c5c13](#test_da1763a95c4ea64c5c13), [test_dd8764a3fcf1fa32068a](#test_dd8764a3fcf1fa32068a), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.T03.CHK.04** — Misturar PO em moeda base e estrangeira, uma po_approved e outra po_issued: totais por estado usam valores C02 comparáveis e apresentam itens não conversíveis; aprovado não vira emitido ou realizado. | PASS_SCOPED | Os testes de money/C02 mantêm totais approved/issued separados, moeda estrangeira congelada e itens não conversíveis; a jornada distingue aprovação e emissão interna. Não há alegação de gasto realizado. | [test_4794310ac9ebf90fb3e0](#test_4794310ac9ebf90fb3e0), [test_6b99f2ee2f1e8da8fb2f](#test_6b99f2ee2f1e8da8fb2f), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_b0b504bbf9f9dc258d25](#test_b0b504bbf9f9dc258d25), [test_de8fcd13641f882cba9b](#test_de8fcd13641f882cba9b) |
| **WP04.T03.CHK.05** — Introduzir total informado diferente de qty vezes unitPrice: ambas as bases e a discrepância aparecem; nenhum cálculo silencioso altera preço, política de aprovação ou documento. | PASS_SCOPED | Asserções existentes expõem total informado, quantidade vezes preço e discrepância; o produtor retém preço registrado e suspende ranking inconsistente. Nenhuma rotina corrige o documento automaticamente. | [test_3dc7eb0ffcaa7ae2b2c9](#test_3dc7eb0ffcaa7ae2b2c9), [test_665a15fd31367d3aafd9](#test_665a15fd31367d3aafd9), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.T03.CHK.18** — Executar sf_sourcing_compare pela UI/native/MCP com base e autoridade iguais produz o mesmo handler, resultado e versão; chamada direta sem concessão ou após revogação é recusada pelo destino. | BLOCKED_NATIVE | UI usa o export compareSourcing e o dispatcher reais, com recibo/versionamento; direto sem concessão, replay, fonte stale e revogação são exercitados. Limites: Falta execução qualificável do mesmo input/autoridade por native e MCP, com SessionV2/SkillLoadReceipt e recibos reais comparáveis ao recibo UI. O envelope adversarial de output não é essa prova. | [test_2e1b0dae155bc2ed6a0e](#test_2e1b0dae155bc2ed6a0e), [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_6b573073b4ba82ac590b](#test_6b573073b4ba82ac590b), [test_86fdcce9cd94f8c153fa](#test_86fdcce9cd94f8c153fa), [test_896c646fb46b2be532fe](#test_896c646fb46b2be532fe), [test_9b1d7f1d61ff5bd1daa8](#test_9b1d7f1d61ff5bd1daa8), [test_da582267b77c61f4c987](#test_da582267b77c61f4c987), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.T03.DOD.01** — A comparação visual utiliza o motor existente e entrega componentes reconciliáveis no C02. | PASS_SCOPED | CommercialComparison passou pela declaração integrada e pelo schema gerado oficialmente; o dispatcher recebe os mesmos componentes monetários e de scoring do motor consumido na UI. | [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_a38d4034ab1d0f718782](#test_a38d4034ab1d0f718782), [test_c79004b8258e38abd7d9](#test_c79004b8258e38abd7d9), [test_da582267b77c61f4c987](#test_da582267b77c61f4c987), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.T03.DOD.02** — Moeda, taxa/snapshot e estado monetário ficam definidos para cada valor exibido. | PASS_SCOPED | Origem, moeda, base submetida, taxa e estado monetário são explícitos em facts/C02/UI; quantidade nominal sem moeda permanece estimada e a moeda ausente, sem total convertido fictício. | [test_4794310ac9ebf90fb3e0](#test_4794310ac9ebf90fb3e0), [test_64e3912e8fb787acba9d](#test_64e3912e8fb787acba9d), [test_6b99f2ee2f1e8da8fb2f](#test_6b99f2ee2f1e8da8fb2f), [test_8a9f00368b47495ca8e4](#test_8a9f00368b47495ca8e4), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_b0b504bbf9f9dc258d25](#test_b0b504bbf9f9dc258d25), [test_de8fcd13641f882cba9b](#test_de8fcd13641f882cba9b), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.T03.DOD.18** — Descritores C16 de sf_sourcing_compare são implementados e consumidos por T06 com referências reais. | BLOCKED_NATIVE | Descritor C16 e consumo por builder/verifier/entrada T06 existem com referências reais de caso e fonte. O decoder fechado aceita o producer efetivo. Limites: A integração interna do consumidor T06 foi exercitada; falta um run residente real da skill sf-comparar-sourcing que consuma o export com sua própria cadeia de sessão/skill/recibo. | [test_1087711dcc0d0a7c8f2c](#test_1087711dcc0d0a7c8f2c), [test_147e9ad21fe37941a269](#test_147e9ad21fe37941a269), [test_2e1b0dae155bc2ed6a0e](#test_2e1b0dae155bc2ed6a0e), [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_896c646fb46b2be532fe](#test_896c646fb46b2be532fe), [test_9b1d7f1d61ff5bd1daa8](#test_9b1d7f1d61ff5bd1daa8), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.T03.INV.01** — Pesos, mínimo de propostas, critérios, elegibilidade e justificativas continuam os da configuração existente. | PASS_SCOPED | Pesos/criteria/required/eligibility vêm da configuração e são verificados contra material canônico; adulterações são recusadas. Políticas existentes não foram alteradas para satisfazer o fixture. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_5cef8551fb09ae7191f1](#test_5cef8551fb09ae7191f1), [test_7dacfef73083a802eab4](#test_7dacfef73083a802eab4), [test_896c646fb46b2be532fe](#test_896c646fb46b2be532fe), [test_8978c27ba56c5840645d](#test_8978c27ba56c5840645d), [test_a38d4034ab1d0f718782](#test_a38d4034ab1d0f718782), [test_dd8764a3fcf1fa32068a](#test_dd8764a3fcf1fa32068a), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.T03.INV.02** — Ausência de taxa/nota/valor não vira zero, precisão inventada ou confirmação de gasto realizado. | PASS_SCOPED | Ausência de valor, FX, moeda ou nota fica null/condicionada; zero permanece distinto; não se afirma realização financeira nem precisão extra. | [test_0dbe4a7e68e8770c4320](#test_0dbe4a7e68e8770c4320), [test_2e1b0dae155bc2ed6a0e](#test_2e1b0dae155bc2ed6a0e), [test_3de28c6bcef4fcb14cdd](#test_3de28c6bcef4fcb14cdd), [test_469e3e5df86b090c2144](#test_469e3e5df86b090c2144), [test_4794310ac9ebf90fb3e0](#test_4794310ac9ebf90fb3e0), [test_5219e856659a559a2907](#test_5219e856659a559a2907), [test_64e3912e8fb787acba9d](#test_64e3912e8fb787acba9d), [test_7dacfef73083a802eab4](#test_7dacfef73083a802eab4), [test_a34108a4a245992082d7](#test_a34108a4a245992082d7), [test_a896da26bab38d48f910](#test_a896da26bab38d48f910), [test_b0b504bbf9f9dc258d25](#test_b0b504bbf9f9dc258d25), [test_b5a7210f089cbcf92847](#test_b5a7210f089cbcf92847), [test_dd8764a3fcf1fa32068a](#test_dd8764a3fcf1fa32068a) |
| **WP04.T03.INV.18** — Permissões, locks, cálculos e comandos finais continuam no domínio; o transporte não cria poder novo. | PASS_SCOPED | A autoridade é revalidada no destino e os comandos/locks permanecem no domínio. Leases reais negam chamada direta sem consumo e revogação. A invariância estrutural não equivale à execução native positiva de CHK.18. | [test_159cd3e85ec06bf5fef7](#test_159cd3e85ec06bf5fef7), [test_41d25e7b44f10c3c469f](#test_41d25e7b44f10c3c469f), [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_6b573073b4ba82ac590b](#test_6b573073b4ba82ac590b), [test_868acd09c14bbc5badb7](#test_868acd09c14bbc5badb7), [test_9b1d7f1d61ff5bd1daa8](#test_9b1d7f1d61ff5bd1daa8), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.T03.QLT.01** — A comparação distingue avaliação humana, cálculo e informação ausente; diferença de preço e razão do ranking são legíveis juntas. | PASS_SCOPED | A tabela real apresenta técnica, preço calculado, comercial, overall, elegibilidade e limitações junto à razão registrada e ao prêmio de preço. Compreensão humana é avaliada separadamente em SUC.01. | [test_3dc7eb0ffcaa7ae2b2c9](#test_3dc7eb0ffcaa7ae2b2c9), [test_7dacfef73083a802eab4](#test_7dacfef73083a802eab4), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_a38d4034ab1d0f718782](#test_a38d4034ab1d0f718782), [test_c79004b8258e38abd7d9](#test_c79004b8258e38abd7d9), [test_dd8764a3fcf1fa32068a](#test_dd8764a3fcf1fa32068a), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.T03.QLT.02** — Arredondamento é de apresentação e não altera ranking, valor aprovado ou reconciliação. | PASS_SCOPED | Domínio conserva 87.933333..., 85 e valores monetários; browser verifica apenas arredondamento de exibição e a mesma ordem/rate congelada. | [test_6b99f2ee2f1e8da8fb2f](#test_6b99f2ee2f1e8da8fb2f), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_a38d4034ab1d0f718782](#test_a38d4034ab1d0f718782), [test_c79004b8258e38abd7d9](#test_c79004b8258e38abd7d9), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.T03.QLT.18** — Schema fechado, ausência/falha explícitas e provenance permitem comparar UI/native/MCP. | PASS_SCOPED | Schema fechado rejeita campos extras/NaN e envelope não-ready; provenance inclui versão, referência, handler e digests reais de UI. O formato permite comparar transportes; paridade native positiva permanece em CHK.18/SUC.18. | [test_2e1b0dae155bc2ed6a0e](#test_2e1b0dae155bc2ed6a0e), [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_9b1d7f1d61ff5bd1daa8](#test_9b1d7f1d61ff5bd1daa8), [test_dd8764a3fcf1fa32068a](#test_dd8764a3fcf1fa32068a), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.T03.CMP.01** — Cobrir moedas diferentes, snapshot, FX ausente, empate, proposta não conforme, menos propostas e notas incompletas. | PASS_SCOPED | A seleção cobre moeda base/estrangeira, snapshot, taxa ausente, empate estável sem regra nova, C inelegível, proposta única e notas incompletas. Cobertura por casos discriminantes é suficiente; não se exige produto cartesiano. | [test_043da2a674198f70dde9](#test_043da2a674198f70dde9), [test_3dc7eb0ffcaa7ae2b2c9](#test_3dc7eb0ffcaa7ae2b2c9), [test_469e3e5df86b090c2144](#test_469e3e5df86b090c2144), [test_7dacfef73083a802eab4](#test_7dacfef73083a802eab4), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_a38d4034ab1d0f718782](#test_a38d4034ab1d0f718782), [test_a896da26bab38d48f910](#test_a896da26bab38d48f910), [test_dd8764a3fcf1fa32068a](#test_dd8764a3fcf1fa32068a), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.T03.CMP.02** — Cobrir PR estimada, sourcing, PO aprovada e PO emitida internamente sem agregar estados como se fossem equivalentes. | PASS_SCOPED | PR estimado, sourcing, PO aprovado e emissão interna têm representações e testes próprios; acumuladores approved/issued permanecem separados. | [test_4794310ac9ebf90fb3e0](#test_4794310ac9ebf90fb3e0), [test_64e3912e8fb787acba9d](#test_64e3912e8fb787acba9d), [test_6b99f2ee2f1e8da8fb2f](#test_6b99f2ee2f1e8da8fb2f), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_a38d4034ab1d0f718782](#test_a38d4034ab1d0f718782), [test_b0b504bbf9f9dc258d25](#test_b0b504bbf9f9dc258d25), [test_de8fcd13641f882cba9b](#test_de8fcd13641f882cba9b), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.T03.CMP.18** — Cobrir todos os exports desta task (1), caso autorizado, direto proibido, stale e indisponível. | PASS_SCOPED | O único export da task, compareSourcing, tem positivo no dispatcher, recusa direta no export antes da concessão, stale após mudança material, unavailable para referência não emitida e revogação; dados incompletos também permanecem condicionados. A observação de transporte native permanece um gate distinto. | [test_2e1b0dae155bc2ed6a0e](#test_2e1b0dae155bc2ed6a0e), [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_6b573073b4ba82ac590b](#test_6b573073b4ba82ac590b), [test_86fdcce9cd94f8c153fa](#test_86fdcce9cd94f8c153fa), [test_896c646fb46b2be532fe](#test_896c646fb46b2be532fe), [test_a896da26bab38d48f910](#test_a896da26bab38d48f910), [test_da582267b77c61f4c987](#test_da582267b77c61f4c987), [test_dd8764a3fcf1fa32068a](#test_dd8764a3fcf1fa32068a), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.T03.SUC.01** — O leitor explica a liderança de A e seu custo adicional no cenário sintético usando apenas a comparação e sua decomposição. | NOT_RUN_HUMAN | Cálculos e conteúdo necessário para explicar a liderança de A e seu prêmio estão cobertos no motor e no browser. Limites: Nenhuma resposta de um leitor humano foi registrada. É necessário pedir a explicação usando apenas a comparação/decomposição e registrar respostas corretas/incorretas. | [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_a38d4034ab1d0f718782](#test_a38d4034ab1d0f718782), [test_c79004b8258e38abd7d9](#test_c79004b8258e38abd7d9), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.T03.SUC.02** — O mesmo valor de domínio aparece coerentemente no detalhe, resumo e C02 entregue a consumidores. | PASS_SCOPED | Detalhe/resumo/queue usam a mesma base; C02 entra no dispatcher fechado e o dossier WP09 real consome a projeção. As antigas pendências de schema/composição não devem permanecer artificiais. | [test_45a88b09f681f263f4a4](#test_45a88b09f681f263f4a4), [test_4794310ac9ebf90fb3e0](#test_4794310ac9ebf90fb3e0), [test_64e3912e8fb787acba9d](#test_64e3912e8fb787acba9d), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_c79004b8258e38abd7d9](#test_c79004b8258e38abd7d9), [test_de8fcd13641f882cba9b](#test_de8fcd13641f882cba9b), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.T03.SUC.18** — O usuário recebe a mesma capacidade e resultado pelas superfícies sem divergência ou efeitos adicionais. | BLOCKED_NATIVE | O percurso UI/host possui resultado e recibo rastreáveis, sem efeito de negócio. Limites: Falta evidência do usuário recebendo a mesma capacidade/resultado pelas superfícies native e MCP no mesmo material e autoridade. Fixtures de verifier e envelopes sintéticos não substituem essa execução. | [test_2e1b0dae155bc2ed6a0e](#test_2e1b0dae155bc2ed6a0e), [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_6b573073b4ba82ac590b](#test_6b573073b4ba82ac590b), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_9b1d7f1d61ff5bd1daa8](#test_9b1d7f1d61ff5bd1daa8), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_da582267b77c61f4c987](#test_da582267b77c61f4c987), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.T04.CHK.01** — Em cada variante, uma pessoa identifica em até 30 segundos o que está aprovando, valor, diferença relevante, razão/evidência e próximo passo; registrar respostas incorretas, não apenas tempo. | NOT_RUN_HUMAN | A UI e o roteiro automatizado apresentam os campos e decisões necessários. Limites: Falta sessão humana para cada variante PR/sourcing/PO: medir até 30s e registrar resposta sobre decisão, valor, diferença, evidência e próximo passo, inclusive respostas incorretas. | [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf) |
| **WP04.T04.CHK.02** — Aprovar uma etapa intermediária mantém o pedido pendente se ainda houver holder seguinte; concluir sourcing libera po_draft, nunca po_issued ou aprovação de PO implícita. | PASS_SCOPED | Os testes originais de domínio cobrem holders intermediários/finais em PR/sourcing/PO; o sourcing final abre po_draft e PO final aprova sem emitir. Browser cobre a jornada completa por comandos reais. | [test_1ebb93e9a6ec0380b2f2](#test_1ebb93e9a6ec0380b2f2), [test_68f59d25655edb3be8b4](#test_68f59d25655edb3be8b4), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_a1da3836d0ed8cd76883](#test_a1da3836d0ed8cd76883), [test_bac5fc66329bbd6d288e](#test_bac5fc66329bbd6d288e), [test_ddb6a9c27c5eb32a1788](#test_ddb6a9c27c5eb32a1788), [test_fb74f987b2b32b4ccefa](#test_fb74f987b2b32b4ccefa) |
| **WP04.T04.CHK.03** — Ator que não é o holder, inclusive admin sem direito de override, recebe a recusa existente também no comando; opção blockSelfApproval continua configurável e respeitada. | PASS_SCOPED | A matriz original holder/admin/blockSelfApproval e os comandos reais permanecem; a superfície não concede override pelo título de admin. Não se infere compreensão humana a partir da recusa técnica. | [test_159cd3e85ec06bf5fef7](#test_159cd3e85ec06bf5fef7), [test_41d25e7b44f10c3c469f](#test_41d25e7b44f10c3c469f), [test_4cd71886b4dddb4a9062](#test_4cd71886b4dddb4a9062), [test_667a0783877dc9fe39a9](#test_667a0783877dc9fe39a9), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_8f9ff172ddc220521190](#test_8f9ff172ddc220521190), [test_d75f0c6d9b77fc7d80e9](#test_d75f0c6d9b77fc7d80e9) |
| **WP04.T04.CHK.04** — Alterar a versão entre abertura e confirmação: decisão é recusada por conflito, comentário local permanece e nenhuma aprovação é reaplicada automaticamente após recarregar. | PASS_SCOPED | Browser cria a corrida real de versão: approve retorna409, comentário digitado permanece, a ação cancelada não reaparece e apenas1POST é enviado. C12 conserva conflitos e retries sem reaplicar domínio. | [test_1d4c2f1fc88efc258e49](#test_1d4c2f1fc88efc258e49), [test_3d58223cc007ea33c1c5](#test_3d58223cc007ea33c1c5), [test_41d25e7b44f10c3c469f](#test_41d25e7b44f10c3c469f), [test_69d6f081e0cdfc30a58a](#test_69d6f081e0cdfc30a58a), [test_7ba9c198f81ec1bb4f57](#test_7ba9c198f81ec1bb4f57), [test_8b456816a9ed2059980a](#test_8b456816a9ed2059980a), [test_cc83f18a6e6b41f8c245](#test_cc83f18a6e6b41f8c245), [test_ff56fdea15b62cb8e720](#test_ff56fdea15b62cb8e720) |
| **WP04.T04.CHK.05** — Executar a preparação determinística C02 consumida pela receita C07 de WP09 duas vezes na mesma versão: obter o mesmo conteúdo de decisão/pendências sem transição de estado, novo identificador de PO ou mensagem externa. | PASS_SCOPED | H01 executa o consumidor WP09 procurementDossier.prepare duas vezes com a mesma ref, compara o resultado inteiro e compara snapshots Procurement antes/depois (inclui requests, issued IDs e notices). Não exige execução de scheduler/modelo para provar preparação read-only. | [test_26b0e9b5e316fe5462e4](#test_26b0e9b5e316fe5462e4), [test_45a88b09f681f263f4a4](#test_45a88b09f681f263f4a4), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b) |
| **WP04.T04.DOD.01** — PR, sourcing e PO possuem resumos próprios ligados à versão e aos comandos reais. | PASS_SCOPED | As variantes PR/sourcing/PO usam resumos próprios, holders/etapas/versionamento e comandos reais. O browser verifica a evolução efetiva do pedido. | [test_1e00a798062e209ab08f](#test_1e00a798062e209ab08f), [test_7b024e3f261bd49386aa](#test_7b024e3f261bd49386aa), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_9dc9af7d2d9c73917159](#test_9dc9af7d2d9c73917159), [test_cc83f18a6e6b41f8c245](#test_cc83f18a6e6b41f8c245), [test_f72276a4ca0247e5b52d](#test_f72276a4ca0247e5b52d) |
| **WP04.T04.DOD.02** — Preparação read-only e ações humanas estão separadas no contrato exportado. | PASS_SCOPED | createProcurementDecisionPreparation só lê request/comparison; ações C12 exigem preparação/revisão/concessão humana distintas. H01 e HTTP negam autoridade ou comando injetado. | [test_159cd3e85ec06bf5fef7](#test_159cd3e85ec06bf5fef7), [test_26b0e9b5e316fe5462e4](#test_26b0e9b5e316fe5462e4), [test_45a88b09f681f263f4a4](#test_45a88b09f681f263f4a4), [test_612b88a3e9700edca00f](#test_612b88a3e9700edca00f), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_7ba9c198f81ec1bb4f57](#test_7ba9c198f81ec1bb4f57) |
| **WP04.T04.INV.01** — Aprovar uma etapa não pula outras aprovações nem muda os poderes do holder/admin. | PASS_SCOPED | Testes de transição e autoridade mantêm etapas intermediárias, poder do holder e política de autoaprovação; a jornada não cria aprovação implícita de PO. | [test_159cd3e85ec06bf5fef7](#test_159cd3e85ec06bf5fef7), [test_1ebb93e9a6ec0380b2f2](#test_1ebb93e9a6ec0380b2f2), [test_667a0783877dc9fe39a9](#test_667a0783877dc9fe39a9), [test_68f59d25655edb3be8b4](#test_68f59d25655edb3be8b4), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_8f9ff172ddc220521190](#test_8f9ff172ddc220521190), [test_a1da3836d0ed8cd76883](#test_a1da3836d0ed8cd76883), [test_bac5fc66329bbd6d288e](#test_bac5fc66329bbd6d288e), [test_ddb6a9c27c5eb32a1788](#test_ddb6a9c27c5eb32a1788), [test_fb74f987b2b32b4ccefa](#test_fb74f987b2b32b4ccefa) |
| **WP04.T04.INV.02** — Uma decisão desatualizada nunca é reaplicada automaticamente e referências textuais não ganham validação fictícia. | PASS_SCOPED | A mudança obsoleta não é reenviada automaticamente; histórico/recibo exige continuidade e autoridade atual. Referências contratuais textuais continuam referências, sem validação externa inventada. | [test_1d4c2f1fc88efc258e49](#test_1d4c2f1fc88efc258e49), [test_3d58223cc007ea33c1c5](#test_3d58223cc007ea33c1c5), [test_41d25e7b44f10c3c469f](#test_41d25e7b44f10c3c469f), [test_4c10b52c957255b3a1cc](#test_4c10b52c957255b3a1cc), [test_69d6f081e0cdfc30a58a](#test_69d6f081e0cdfc30a58a), [test_7ba9c198f81ec1bb4f57](#test_7ba9c198f81ec1bb4f57), [test_cc83f18a6e6b41f8c245](#test_cc83f18a6e6b41f8c245), [test_ff56fdea15b62cb8e720](#test_ff56fdea15b62cb8e720) |
| **WP04.T04.QLT.01** — O título nomeia a decisão concreta e a área de ação explica seu efeito e a próxima etapa. | PASS_SCOPED | Títulos e ações indicam requisição/sourcing/PO, efeito e próxima etapa; holders ausentes e limitações permanecem explícitos. A clareza observável não substitui o roteiro humano. | [test_1b731c02abaff1e0f580](#test_1b731c02abaff1e0f580), [test_1e00a798062e209ab08f](#test_1e00a798062e209ab08f), [test_7b024e3f261bd49386aa](#test_7b024e3f261bd49386aa), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_cc83f18a6e6b41f8c245](#test_cc83f18a6e6b41f8c245), [test_f72276a4ca0247e5b52d](#test_f72276a4ca0247e5b52d) |
| **WP04.T04.QLT.02** — Resumo curto e drilldown detalhado apresentam os mesmos valores, contexto e limitações. | PASS_SCOPED | Resumo, drilldown e C02/dossier preservam valores, moeda, snapshot e limitações; a comparação do browser e a igualdade do dossier integram as partes já testadas diretamente. | [test_26b0e9b5e316fe5462e4](#test_26b0e9b5e316fe5462e4), [test_45a88b09f681f263f4a4](#test_45a88b09f681f263f4a4), [test_4794310ac9ebf90fb3e0](#test_4794310ac9ebf90fb3e0), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf), [test_c79004b8258e38abd7d9](#test_c79004b8258e38abd7d9), [test_de8fcd13641f882cba9b](#test_de8fcd13641f882cba9b), [test_e603ec2e6d2f19ff3051](#test_e603ec2e6d2f19ff3051) |
| **WP04.T04.CMP.01** — Cobrir PR, sourcing, PO, aprovador intermediário/final, rejeição com motivo, autoaprovação configurável e holder alheio. | PASS_SCOPED | Casos de domínio já cobrem PR/sourcing/PO, holder intermediário/final, rejeição com motivo, autoaprovação configurável e holder alheio; browser integra a jornada e o conflito de comentário. | [test_004803f588e1eb524a49](#test_004803f588e1eb524a49), [test_159cd3e85ec06bf5fef7](#test_159cd3e85ec06bf5fef7), [test_1e00a798062e209ab08f](#test_1e00a798062e209ab08f), [test_1ebb93e9a6ec0380b2f2](#test_1ebb93e9a6ec0380b2f2), [test_667a0783877dc9fe39a9](#test_667a0783877dc9fe39a9), [test_68f59d25655edb3be8b4](#test_68f59d25655edb3be8b4), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_8f9ff172ddc220521190](#test_8f9ff172ddc220521190), [test_a1da3836d0ed8cd76883](#test_a1da3836d0ed8cd76883), [test_bac5fc66329bbd6d288e](#test_bac5fc66329bbd6d288e), [test_cc83f18a6e6b41f8c245](#test_cc83f18a6e6b41f8c245), [test_cfaebd2b0daf4d874a11](#test_cfaebd2b0daf4d874a11), [test_ddb6a9c27c5eb32a1788](#test_ddb6a9c27c5eb32a1788), [test_fb74f987b2b32b4ccefa](#test_fb74f987b2b32b4ccefa) |
| **WP04.T04.CMP.02** — Cobrir versão desatualizada, evidência incompleta e execução read-only por consumidor de rotinas. | PASS_SCOPED | H01 mostra preparação por consumidor WP09 com comparação ausente/limitações e recusa documento sem extração; stale é coberto no domínio/C12/browser. Não se exige transformar a receita read-only em uma execução de modelo. | [test_26b0e9b5e316fe5462e4](#test_26b0e9b5e316fe5462e4), [test_3d58223cc007ea33c1c5](#test_3d58223cc007ea33c1c5), [test_45a88b09f681f263f4a4](#test_45a88b09f681f263f4a4), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_a896da26bab38d48f910](#test_a896da26bab38d48f910), [test_cc83f18a6e6b41f8c245](#test_cc83f18a6e6b41f8c245), [test_ff56fdea15b62cb8e720](#test_ff56fdea15b62cb8e720) |
| **WP04.T04.SUC.01** — O aprovador completa o roteiro de compreensão sem abrir Settings nem reconstruir a comparação manualmente. | NOT_RUN_HUMAN | O roteiro de UI oferece decisão, valor, razão e próximo passo na superfície de trabalho. Limites: Nenhum aprovador humano completou o roteiro sem Settings/reconstrução manual. O teste automatizado não pode ser apresentado como medição humana de compreensão. | [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf) |
| **WP04.T04.SUC.02** — Uma preparação automática é útil como rascunho e demonstravelmente não produz decisão de negócio. | PASS_SCOPED | A preparação real fornece request/limitações/documentos e repete o mesmo rascunho com snapshot Procurement idêntico; a decisão de negócio exige a concessão e o apply humano separados. Utilidade aqui se limita ao conteúdo verificável do rascunho; aceitação humana permanece SUC.01. | [test_159cd3e85ec06bf5fef7](#test_159cd3e85ec06bf5fef7), [test_26b0e9b5e316fe5462e4](#test_26b0e9b5e316fe5462e4), [test_45a88b09f681f263f4a4](#test_45a88b09f681f263f4a4), [test_612b88a3e9700edca00f](#test_612b88a3e9700edca00f), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b) |
| **WP04.T05.CHK.01** — Fornecedor ativo tem IBAN/account alterado por ator permitido: volta a pending, validação é removida e a interface indica revalidação; ator sem permissão é recusado e não vê material bancário em view, erro, histórico, register ou C02. | PASS_SCOPED | Real bank-change→pending→revalidate browser plus bank-role/encryption/audit/C02 tests and W6 producer CSV redaction cover the scoped channels. | [test_0ee9c599f7b129d16b7b](#test_0ee9c599f7b129d16b7b), [test_16e6710da78f60574528](#test_16e6710da78f60574528), [test_2cedc9096e6d2392995e](#test_2cedc9096e6d2392995e), [test_7d32b8d1a40a03da1d9d](#test_7d32b8d1a40a03da1d9d), [test_8181d121b72f370d2603](#test_8181d121b72f370d2603), [test_d7a2e216fabd133388b6](#test_d7a2e216fabd133388b6), [test_edca1cde9e870eb8083f](#test_edca1cde9e870eb8083f) |
| **WP04.T05.CHK.02** — Fornecedor com taxId duplicado não é aceito; legalName duplicado segue o aviso existente; ativação incompleta aponta os requisitos reais sem declarar sanctions screening externo realizado. | PASS_SCOPED | Real duplicate tax refusal/duplicate-name warning units; W6 exact human-labelled activation prerequisites and subsequent permitted correction/activation. | [test_a7f1ee5535ca0a5020ce](#test_a7f1ee5535ca0a5020ce), [test_b66e531a2da6e4681149](#test_b66e531a2da6e4681149), [test_d7a2e216fabd133388b6](#test_d7a2e216fabd133388b6), [test_d9a58d1eea4de34dbdb9](#test_d9a58d1eea4de34dbdb9) |
| **WP04.T05.CHK.03** — Reset de Settings restaura exatamente os defaults do baseline sem apagar requests/suppliers; edição de matriz/câmbio não modifica snapshots já congelados. | PASS_SCOPED | Exact baseline reset snapshot equality plus real browser FX edit/reset and frozen request summary; runtime frozen approver-matrix test. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_4d1bf09c609d665f42d0](#test_4d1bf09c609d665f42d0), [test_5d3aa8e0deba9b4f7ef1](#test_5d3aa8e0deba9b4f7ef1), [test_8978c27ba56c5840645d](#test_8978c27ba56c5840645d), [test_9b3b6f4a891e4868dfcf](#test_9b3b6f4a891e4868dfcf) |
| **WP04.T05.CHK.04** — Após importação representativa ou exclusão permitida, criar PR/PO/SUP não reutiliza identificador já emitido; registro/PO exportados preservam campos de negócio e omitem material restrito. | PASS_SCOPED | See concrete gap findings; existing positive evidence remains valid within its scope. Root/finance W6 additions now supply expected scoped evidence for G2; hosted result is still required. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_0dbe4a7e68e8770c4320](#test_0dbe4a7e68e8770c4320), [test_2cedc9096e6d2392995e](#test_2cedc9096e6d2392995e), [test_59cc3a3b8d5ff59db2c0](#test_59cc3a3b8d5ff59db2c0), [test_636c917673d6d1ca810e](#test_636c917673d6d1ca810e), [test_69a5069acbfdcaa0bbf5](#test_69a5069acbfdcaa0bbf5), [test_b66e531a2da6e4681149](#test_b66e531a2da6e4681149), [test_eb9fea80269b71e960bd](#test_eb9fea80269b71e960bd) |
| **WP04.T05.CHK.05** — Percorrer create → submit_pr → approve → sourcing/select/submit → approve → PO/submit → approve → issue e caminhos de rejeição/cancelamento: estados e recusas coincidem com o inventário; po_issued permanece interno e terminal para cancel/delete. | PASS_SCOPED | Actual browser complete create→issue plus real runtime/Porta reject/resubmit/cancel/terminal refusals, with internal issuance wording. | [test_004803f588e1eb524a49](#test_004803f588e1eb524a49), [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_04d58ac83c173a6387af](#test_04d58ac83c173a6387af), [test_774ae7de798e5e2c67bb](#test_774ae7de798e5e2c67bb), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_93beeae51b7da70de4e1](#test_93beeae51b7da70de4e1), [test_ca755c19cb9ff8232be3](#test_ca755c19cb9ff8232be3), [test_cc83f18a6e6b41f8c245](#test_cc83f18a6e6b41f8c245) |
| **WP04.T05.CHK.18** — Executar sf_supplier_read, sf_contract_read pela UI/native/MCP com base e autoridade iguais produz o mesmo handler, resultado e versão; chamada direta sem concessão ou após revogação é recusada pelo destino. | BLOCKED_NATIVE | Same-result UI/native/MCP comparison belongs to the integration/native evidence excluded from this focused review; local supplier/contract ports are implemented and have scoped authorized/denied/stale evidence. A mesma autoridade/base por UI/native/MCP ainda exige execução nativa qualificada, não apenas exports e recibos UI. Limites: A mesma autoridade/base por UI/native/MCP ainda exige execução nativa qualificada, não apenas exports e recibos UI. | [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_8181d121b72f370d2603](#test_8181d121b72f370d2603), [test_8e45403eaff5c8b30a92](#test_8e45403eaff5c8b30a92) |
| **WP04.T05.DOD.01** — Suppliers e Settings conservam todas as operações e campos do inventário com feedback utilizável. | PASS_SCOPED | Root full-field sentinel roundtrip, recorded enum preservation, and actual rendered-row saves now cover the identified preservation gaps. PO metadata follows a request-bound omitted-metadata digest with original-index hint across repeated saves/removal/reorder; quote metadata follows unique IDs. Explicit payload edits win, new rows never inherit, ambiguous references are refused after CAS and role gates. Hosted execution remains required. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_08094ef71a3f06d0d266](#test_08094ef71a3f06d0d266), [test_16e6710da78f60574528](#test_16e6710da78f60574528), [test_2fa9e9772cbb800072e6](#test_2fa9e9772cbb800072e6), [test_4d1bf09c609d665f42d0](#test_4d1bf09c609d665f42d0), [test_6ec0aaad82d767ef6d90](#test_6ec0aaad82d767ef6d90), [test_7db1565aa04b1bd60e57](#test_7db1565aa04b1bd60e57), [test_7fb9bd61e2a0d844dcfe](#test_7fb9bd61e2a0d844dcfe), [test_8978c27ba56c5840645d](#test_8978c27ba56c5840645d), [test_a7f1ee5535ca0a5020ce](#test_a7f1ee5535ca0a5020ce), [test_d7a2e216fabd133388b6](#test_d7a2e216fabd133388b6), [test_e6041c1e1bc3abb0dfd6](#test_e6041c1e1bc3abb0dfd6), [test_eb9fea80269b71e960bd](#test_eb9fea80269b71e960bd) |
| **WP04.T05.DOD.02** — O pacote fecha o recibo de preservação dos fluxos e entrega as portas ao integrador com limitações explícitas. | PASS_SCOPED | Final preservation receipt and delivery to integrators are root-owned publication/integration evidence. This source review supplies the precise UI residuals and does not substitute a receipt. O fechamento depende da publicação do recibo final de preservação/handoff com consumidores, SHA, seleções, artefatos e limitações explícitos. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_45615d8a94a032b41bd8](#test_45615d8a94a032b41bd8), [test_4d1bf09c609d665f42d0](#test_4d1bf09c609d665f42d0) |
| **WP04.T05.DOD.18** — Descritores C16 de sf_supplier_read, sf_contract_read são implementados e consumidos por T06 com referências reais. | BLOCKED_NATIVE | C16 descriptors exist; actual T06 consumption with real references is integration evidence outside this UI review, not a reason to demand more UI role combinations. Descritores e exports reais existem; o consumo T06 por sessão/skill residente real ainda não foi observado. Limites: Descritores e exports reais existem; o consumo T06 por sessão/skill residente real ainda não foi observado. | [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_8181d121b72f370d2603](#test_8181d121b72f370d2603), [test_8e45403eaff5c8b30a92](#test_8e45403eaff5c8b30a92) |
| **WP04.T05.INV.01** — Alteração bancária e ativação seguem os papéis, cifragem, máscara e revalidação existentes; dados sensíveis não vazam para consumidores. | PASS_SCOPED | Existing actual buyer/supplier-admin role tests, encryption/audit tests, masked viewer browser and W6 authorized/nonprivileged bank CSV tests. | [test_0ee9c599f7b129d16b7b](#test_0ee9c599f7b129d16b7b), [test_16e6710da78f60574528](#test_16e6710da78f60574528), [test_6722bdf3f450851b51a3](#test_6722bdf3f450851b51a3), [test_7b757408fda588acb113](#test_7b757408fda588acb113), [test_7d32b8d1a40a03da1d9d](#test_7d32b8d1a40a03da1d9d), [test_8181d121b72f370d2603](#test_8181d121b72f370d2603), [test_d7a2e216fabd133388b6](#test_d7a2e216fabd133388b6), [test_edca1cde9e870eb8083f](#test_edca1cde9e870eb8083f) |
| **WP04.T05.INV.02** — Reset, exclusão e retomada não apagam histórico nem reutilizam identificadores PR/PO/SUP já emitidos. | PASS_SCOPED | See concrete gap findings; existing positive evidence remains valid within its scope. Root/finance W6 additions now supply expected scoped evidence for G2; hosted result is still required. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_4d1bf09c609d665f42d0](#test_4d1bf09c609d665f42d0), [test_636c917673d6d1ca810e](#test_636c917673d6d1ca810e), [test_69a5069acbfdcaa0bbf5](#test_69a5069acbfdcaa0bbf5), [test_774ae7de798e5e2c67bb](#test_774ae7de798e5e2c67bb), [test_8978c27ba56c5840645d](#test_8978c27ba56c5840645d), [test_b66e531a2da6e4681149](#test_b66e531a2da6e4681149) |
| **WP04.T05.INV.18** — Permissões, locks, cálculos e comandos finais continuam no domínio; o transporte não cria poder novo. | PASS_SCOPED | Scoped non-native assertion: real domain/HTTP authorization, current-authority/prepared-command and stale-source tests preserve destination authority. No native equivalence claim. | [test_41d25e7b44f10c3c469f](#test_41d25e7b44f10c3c469f), [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_7b757408fda588acb113](#test_7b757408fda588acb113), [test_8181d121b72f370d2603](#test_8181d121b72f370d2603), [test_8e45403eaff5c8b30a92](#test_8e45403eaff5c8b30a92) |
| **WP04.T05.QLT.01** — Pendências de fornecedor explicam a ação corretiva sem confundir preenchimento declarado com verificação externa. | PASS_SCOPED | W6 visible corrective checklist and human labels use the actual validator requirements; external sanctions validation remains explicitly unclaimed. | [test_16e6710da78f60574528](#test_16e6710da78f60574528), [test_a7f1ee5535ca0a5020ce](#test_a7f1ee5535ca0a5020ce), [test_d7a2e216fabd133388b6](#test_d7a2e216fabd133388b6) |
| **WP04.T05.QLT.02** — Operações raras e Settings ficam em acesso secundário claro, preservando descoberta por teclado e todos os controles. | PASS_SCOPED | See concrete gap findings; existing positive evidence remains valid within its scope. W6 now adds the specific expected evidence for G4; execution remains unobserved. | [test_3c85156c51e6e6c3d546](#test_3c85156c51e6e6c3d546), [test_6722bdf3f450851b51a3](#test_6722bdf3f450851b51a3), [test_7fb9bd61e2a0d844dcfe](#test_7fb9bd61e2a0d844dcfe), [test_8978c27ba56c5840645d](#test_8978c27ba56c5840645d) |
| **WP04.T05.QLT.18** — Schema fechado, ausência/falha explícitas e provenance permitem comparar UI/native/MCP. | PASS_SCOPED | Closed schemas, explicit absence and provenance exist in the shared contract/port code; their comparison across native/MCP is excluded integration evidence. Schemas fechados e os exports supplier/contract reais têm positivos, direto proibido, stale, ausência/indisponibilidade e provenance no dispatcher; isso satisfaz a estrutura comparável sem alegar execução native positiva. | [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_7e76f6971b061c219053](#test_7e76f6971b061c219053), [test_8181d121b72f370d2603](#test_8181d121b72f370d2603), [test_8e45403eaff5c8b30a92](#test_8e45403eaff5c8b30a92) |
| **WP04.T05.CMP.01** — Cobrir os quatro estados de fornecedor, dados comerciais/bancários/compliance, linked requests, auditoria, busca e exportação. | PASS_SCOPED | See concrete gap findings; existing positive evidence remains valid within its scope. W6 now adds the specific expected evidence for G3; execution remains unobserved. | [test_0ee9c599f7b129d16b7b](#test_0ee9c599f7b129d16b7b), [test_16e6710da78f60574528](#test_16e6710da78f60574528), [test_20278fe4ea416f17263f](#test_20278fe4ea416f17263f), [test_3c85156c51e6e6c3d546](#test_3c85156c51e6e6c3d546), [test_6722bdf3f450851b51a3](#test_6722bdf3f450851b51a3), [test_6ec0aaad82d767ef6d90](#test_6ec0aaad82d767ef6d90), [test_d7a2e216fabd133388b6](#test_d7a2e216fabd133388b6), [test_eb9fea80269b71e960bd](#test_eb9fea80269b71e960bd), [test_edca1cde9e870eb8083f](#test_edca1cde9e870eb8083f) |
| **WP04.T05.CMP.02** — Cobrir configurações/reset, todos os comandos originais e preservação de identificadores/campos após dados migrados representativos. | PASS_SCOPED | Root full-field sentinel roundtrip, recorded enum preservation, and actual rendered-row saves now cover the identified preservation gaps. PO metadata follows a request-bound omitted-metadata digest with original-index hint across repeated saves/removal/reorder; quote metadata follows unique IDs. Explicit payload edits win, new rows never inherit, ambiguous references are refused after CAS and role gates. Hosted execution remains required. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_04d58ac83c173a6387af](#test_04d58ac83c173a6387af), [test_08094ef71a3f06d0d266](#test_08094ef71a3f06d0d266), [test_2fa9e9772cbb800072e6](#test_2fa9e9772cbb800072e6), [test_4d1bf09c609d665f42d0](#test_4d1bf09c609d665f42d0), [test_636c917673d6d1ca810e](#test_636c917673d6d1ca810e), [test_6ec0aaad82d767ef6d90](#test_6ec0aaad82d767ef6d90), [test_8978c27ba56c5840645d](#test_8978c27ba56c5840645d), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_b66e531a2da6e4681149](#test_b66e531a2da6e4681149), [test_e51b65c2845be17a5dde](#test_e51b65c2845be17a5dde), [test_e6041c1e1bc3abb0dfd6](#test_e6041c1e1bc3abb0dfd6), [test_eb9fea80269b71e960bd](#test_eb9fea80269b71e960bd) |
| **WP04.T05.CMP.18** — Cobrir todos os exports desta task (2), caso autorizado, direto proibido, stale e indisponível. | PASS_SCOPED | See concrete gap findings; existing positive evidence remains valid within its scope. Root/finance W6 additions now supply expected scoped evidence for G5; hosted result is still required. | [test_454da23eb912b2f9ea5d](#test_454da23eb912b2f9ea5d), [test_7e76f6971b061c219053](#test_7e76f6971b061c219053), [test_8181d121b72f370d2603](#test_8181d121b72f370d2603), [test_8e45403eaff5c8b30a92](#test_8e45403eaff5c8b30a92) |
| **WP04.T05.SUC.01** — Buyer e supplier admin concluem cadastro, correção e revalidação sem consultar códigos internos nem expor informação bancária indevida. | PASS_SCOPED | Combine real buyer creation/correction and supplier-admin bank/activation tests, real browser revalidation and masked viewer. Does not require duplicating the whole journey for every role or inventing a human timing result. | [test_16e6710da78f60574528](#test_16e6710da78f60574528), [test_6722bdf3f450851b51a3](#test_6722bdf3f450851b51a3), [test_a7f1ee5535ca0a5020ce](#test_a7f1ee5535ca0a5020ce), [test_d7a2e216fabd133388b6](#test_d7a2e216fabd133388b6) |
| **WP04.T05.SUC.02** — O integrador consegue executar a jornada real completa com os exports entregues, sem solicitar um substituto de demonstração ou escrever dentro do domínio. | PASS_SCOPED | The real browser domain journey and real prepared HTTP/SQLite tests support the local implementation; integrator consumption of the delivered exports is root-owned integration evidence. As jornadas reais de browser, os exports supplier/contract com SQLite/autoridade/dispatcher e a composição HTTP fornecem o percurso entregue ao integrador; a qualificação depende dos resultados finais, sem criar um substituto do domínio. | [test_01f3ff6bfa2d6ee502ed](#test_01f3ff6bfa2d6ee502ed), [test_45615d8a94a032b41bd8](#test_45615d8a94a032b41bd8), [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_7e76f6971b061c219053](#test_7e76f6971b061c219053), [test_8ca865396280127bdba3](#test_8ca865396280127bdba3), [test_8e45403eaff5c8b30a92](#test_8e45403eaff5c8b30a92) |
| **WP04.T05.SUC.18** — O usuário recebe a mesma capacidade e resultado pelas superfícies sem divergência ou efeitos adicionais. | BLOCKED_NATIVE | Cross-surface identical capability/result/effects must use root integration/native evidence; the eight browser cases alone cannot establish it. Paridade de capacidade/resultado para o usuário entre UI/native/MCP ainda requer os recibos dessas execuções reais. Limites: Paridade de capacidade/resultado para o usuário entre UI/native/MCP ainda requer os recibos dessas execuções reais. | [test_75509fafd5ad53f7ab3b](#test_75509fafd5ad53f7ab3b), [test_8181d121b72f370d2603](#test_8181d121b72f370d2603), [test_8e45403eaff5c8b30a92](#test_8e45403eaff5c8b30a92) |

## Catálogo de testes

Os links de fonte apontam para o commit de produto executado. Os nomes são literais; cada entrada foi observada uma única vez no run correspondente. As fixtures sintéticas e testes de controller mantêm os limites descritos na matriz.

### test_004803f588e1eb524a49

**L-reject-pr rejects the first pending and leaves the others**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/porta/linha.test.ts) — `modules/sucafina/porta/linha.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.15 ms, retry 0. SHA-256 da fonte: `1765a7729694bea626130daba6fb51f231d2d31f45ed049e43b7317e3fd52147`.

### test_01f3ff6bfa2d6ee502ed

**complete procurement field roundtrip and frozen approvals survive settings edits**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts) — `modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 15.5 ms, retry 0. SHA-256 da fonte: `512e5b7a1e64e9e5f40cee473aa52d4c25c75593d71eb25510a504cbea7cd95b`.

### test_043da2a674198f70dde9

**equal complete proposals retain recorded order without adding a tie-break policy**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/finance-material.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/finance-material.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.12 ms, retry 0. SHA-256 da fonte: `e91f24a82e044f5674c566238dca0d383fa462656f2805708ba92f14e2086517`.

### test_04d58ac83c173a6387af

**dual-role request transitions retain porta authorization without permitting foreign PR edits**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts) — `modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 2.47 ms, retry 0. SHA-256 da fonte: `512e5b7a1e64e9e5f40cee473aa52d4c25c75593d71eb25510a504cbea7cd95b`.

### test_08094ef71a3f06d0d266

**recorded supplier enum values outside the current options remain selected through a real form save**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.89 ms, retry 0. SHA-256 da fonte: `2f8cbde0de833645964c943fd74796ac9e30472908de2861c62a3c8ab01ebf59`.

### test_0dbe4a7e68e8770c4320

**real register and purchase-order downloads preserve recorded business terms and omit restricted bank material**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 2.03 ms, retry 0. SHA-256 da fonte: `2f8cbde0de833645964c943fd74796ac9e30472908de2861c62a3c8ab01ebf59`.

### test_0ee9c599f7b129d16b7b

**the real supplier CSV keeps business fields and grants every bank field only to existing privileged roles**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 1.95 ms, retry 0. SHA-256 da fonte: `2f8cbde0de833645964c943fd74796ac9e30472908de2861c62a3c8ab01ebf59`.

### test_1087711dcc0d0a7c8f2c

**sourcing input is mounted in the workbench and refuses absent runtime or an unrelated origin and path**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-sourcing-analysis.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-sourcing-analysis.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 1.61 ms, retry 0. SHA-256 da fonte: `4d07767f4e5897ff2b307eb8c69568f521a1775c53fa756160e1d3c786564ca6`.

### test_11be8600feabcc3939a3

**saved order terms survive source suggestions and ambiguous supplier identity supplies no terms**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-guidance.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-guidance.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.2 ms, retry 0. SHA-256 da fonte: `ed7eaee8d3514f48088514a40cd5b71009e8ac5e1b7ba51a2d07e4c60cb1cb53`.

### test_147e9ad21fe37941a269

**sourcing entry renders only attached authorized request selectors with the verified resident manifest and supplied catalog**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-sourcing-analysis.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-sourcing-analysis.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 29.79 ms, retry 0. SHA-256 da fonte: `4d07767f4e5897ff2b307eb8c69568f521a1775c53fa756160e1d3c786564ca6`.

### test_159cd3e85ec06bf5fef7

**Procurement decision HTTP rejects injected commands, ungranted actors and cross-origin intent**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/host-integration.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/host-integration.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 452.14 ms, retry 0. SHA-256 da fonte: `88b08df63cb30a88541bab9f513ac49c8bd942b2a8c4e6493bf4e51da460a8c0`.

### test_16e6710da78f60574528

**an authorized bank change requires supplier revalidation and a real viewer cannot read or update bank details**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts) — `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534795463): PASS, 6693 ms, retry 0. SHA-256 da fonte: `6562cb86fc9ea7095fb812b8477363dd59adb9b71907e1096bd72722d3d7b9b5`.

### test_1b731c02abaff1e0f580

**approval queue retains missing steps and does not invent holder names or actions**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 1.27 ms, retry 0. SHA-256 da fonte: `413455d7fb121b76dd6321886dd8533665cc706815c00aa9b785575e1fef422d`.

### test_1d4c2f1fc88efc258e49

**two authenticated actors review an actual CAS conflict and submit only after an explicit version choice**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts) — `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534795463): PASS, 5938 ms, retry 0. SHA-256 da fonte: `6562cb86fc9ea7095fb812b8477363dd59adb9b71907e1096bd72722d3d7b9b5`.

### test_1e00a798062e209ab08f

**approval view separates unassigned holders and labels the pending decision**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.51 ms, retry 0. SHA-256 da fonte: `413455d7fb121b76dd6321886dd8533665cc706815c00aa9b785575e1fef422d`.

### test_1ebb93e9a6ec0380b2f2

**L-approve-po-ultimo approves and clears issuedAt**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/porta/linha.test.ts) — `modules/sucafina/porta/linha.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.11 ms, retry 0. SHA-256 da fonte: `1765a7729694bea626130daba6fb51f231d2d31f45ed049e43b7317e3fd52147`.

### test_20278fe4ea416f17263f

**requester supplier deeplink opens the real view target while bank values stay masked**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/parity-procurement.test.ts) — `modules/sucafina/Sucafinav1/test/parity-procurement.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.6 ms, retry 0. SHA-256 da fonte: `51ed56f58f3d9a9ed3ecf648c3e63fc09de5bb54ea0da0fbaed64b37c4bd4663`.

### test_26b0e9b5e316fe5462e4

**decision preparation is deterministic and does not change the request**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.21 ms, retry 0. SHA-256 da fonte: `2f27c9e96a9be9c4de059a3e5d46d8bda345ddfdd9be57a4ab4bce8b0b06cd68`.

### test_2b9422c6a67a4c2497e4

**an unavailable frozen quote rate does not use a later rate or the requisition estimate**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.12 ms, retry 0. SHA-256 da fonte: `413455d7fb121b76dd6321886dd8533665cc706815c00aa9b785575e1fef422d`.

### test_2cedc9096e6d2392995e

**register export removes bank material recursively including audit values**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.18 ms, retry 0. SHA-256 da fonte: `413455d7fb121b76dd6321886dd8533665cc706815c00aa9b785575e1fef422d`.

### test_2d86a5c91f2a22b4f0d5

**nonprivileged supplier view removes bank metadata and audit values**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.28 ms, retry 0. SHA-256 da fonte: `413455d7fb121b76dd6321886dd8533665cc706815c00aa9b785575e1fef422d`.

### test_2e1b0dae155bc2ed6a0e

**sourcing output verifier rejects non-ready envelopes and tampered replay material**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/finance-sourcing-integration.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/finance-sourcing-integration.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 279.36 ms, retry 0. SHA-256 da fonte: `796cdf369ba2278228567b86717f28e42a6614d7c1aa540a45d88e2b8e21d1c4`.

### test_2fa9e9772cbb800072e6

**rendered quotation saves retain omitted metadata by quote ID and never transfer removed metadata to a new quote**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-guidance.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-guidance.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 4.93 ms, retry 0. SHA-256 da fonte: `ed7eaee8d3514f48088514a40cd5b71009e8ac5e1b7ba51a2d07e4c60cb1cb53`.

### test_335a0ecbd0f6e78e1f92

**missing history and holder stay unavailable, and restricted fields are omitted**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.13 ms, retry 0. SHA-256 da fonte: `2f27c9e96a9be9c4de059a3e5d46d8bda345ddfdd9be57a4ab4bce8b0b06cd68`.

### test_37ca611787de8cd9f60e

**unrecognized imported status stays explicitly unavailable**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.06 ms, retry 0. SHA-256 da fonte: `2f27c9e96a9be9c4de059a3e5d46d8bda345ddfdd9be57a4ab4bce8b0b06cd68`.

### test_3c85156c51e6e6c3d546

**supplier query opens only its matching visible supplier detail**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/parity-procurement.test.ts) — `modules/sucafina/Sucafinav1/test/parity-procurement.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.55 ms, retry 0. SHA-256 da fonte: `51ed56f58f3d9a9ed3ecf648c3e63fc09de5bb54ea0da0fbaed64b37c4bd4663`.

### test_3d58223cc007ea33c1c5

**prepared Procurement mutation records a stale source conflict without changing the domain**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/prepared-production.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/prepared-production.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 43.34 ms, retry 0. SHA-256 da fonte: `cd0a93462d56613ad9e8cd90016d464cf94cc614a5a25c741698ce3be4f22bfc`.

### test_3dc7eb0ffcaa7ae2b2c9

**request detail shows the discrepancy without changing the quoted total**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 1.21 ms, retry 0. SHA-256 da fonte: `413455d7fb121b76dd6321886dd8533665cc706815c00aa9b785575e1fef422d`.

### test_3de28c6bcef4fcb14cdd

**real financial downloads preserve frozen submitted currency after base changes and retain explicit zero**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 1.59 ms, retry 0. SHA-256 da fonte: `2f8cbde0de833645964c943fd74796ac9e30472908de2861c62a3c8ab01ebf59`.

### test_41d25e7b44f10c3c469f

**request ownership, self-approval flag and independent record versions are enforced**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts) — `modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 1.33 ms, retry 0. SHA-256 da fonte: `512e5b7a1e64e9e5f40cee473aa52d4c25c75593d71eb25510a504cbea7cd95b`.

### test_454da23eb912b2f9ea5d

**capability refuses forged arguments and refuses an ungranted direct call**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/capabilities.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/capabilities.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.52 ms, retry 0. SHA-256 da fonte: `98a38ae84d453dfce90cabfe49aa8eac72ecc21f8cb4891a28466576d1db341e`.

### test_45615d8a94a032b41bd8

**prepared Procurement mutation uses current actor and SQLite revision, and retries by receipt**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/prepared-production.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/prepared-production.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 51.33 ms, retry 0. SHA-256 da fonte: `cd0a93462d56613ad9e8cd90016d464cf94cc614a5a25c741698ce3be4f22bfc`.

### test_45a88b09f681f263f4a4

**real host composes C06 confirmation, current evidence routing and the WP09 dossier**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/host-integration.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/host-integration.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 810.32 ms, retry 0. SHA-256 da fonte: `88b08df63cb30a88541bab9f513ac49c8bd942b2a8c4e6493bf4e51da460a8c0`.

### test_469e3e5df86b090c2144

**request comparison does not label an unspecified quote currency as base currency**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.88 ms, retry 0. SHA-256 da fonte: `413455d7fb121b76dd6321886dd8533665cc706815c00aa9b785575e1fef422d`.

### test_4794310ac9ebf90fb3e0

**a frozen PR retains its submitted currency after the current base changes**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/finance-material.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/finance-material.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.56 ms, retry 0. SHA-256 da fonte: `e91f24a82e044f5674c566238dca0d383fa462656f2805708ba92f14e2086517`.

### test_4a7570a102f62d022524

**queue projection uses the latest submission, never a later save**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.28 ms, retry 0. SHA-256 da fonte: `2f27c9e96a9be9c4de059a3e5d46d8bda345ddfdd9be57a4ab4bce8b0b06cd68`.

### test_4b4ffc93a4e81f446cdb

**aging for the next holder starts at the preceding approval, or remains unavailable without that event**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.18 ms, retry 0. SHA-256 da fonte: `2f27c9e96a9be9c4de059a3e5d46d8bda345ddfdd9be57a4ab4bce8b0b06cd68`.

### test_4c10b52c957255b3a1cc

**private original evidence is immutable and a replacement Request cannot revive historical facts or receipts**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/host-integration.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/host-integration.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 19386.32 ms, retry 0. SHA-256 da fonte: `88b08df63cb30a88541bab9f513ac49c8bd942b2a8c4e6493bf4e51da460a8c0`.

### test_4cd71886b4dddb4a9062

**C-not-approver the word approver does not authorize**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/porta/codigo.test.ts) — `modules/sucafina/porta/codigo.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.09 ms, retry 0. SHA-256 da fonte: `af0ebcdd0c2458f0e5df3a3a6809b3a0cbeed24b50ccfb63e9d49f370eebb81e`.

### test_4d1bf09c609d665f42d0

**settings reset restores the original complete defaults and preserves procurement records**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/parity-procurement.test.ts) — `modules/sucafina/Sucafinav1/test/parity-procurement.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 1.43 ms, retry 0. SHA-256 da fonte: `51ed56f58f3d9a9ed3ecf648c3e63fc09de5bb54ea0da0fbaed64b37c4bd4663`.

### test_5219e856659a559a2907

**real register bytes distinguish missing quotation values and currency from recorded zero and reject ambiguous selection**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.76 ms, retry 0. SHA-256 da fonte: `2f8cbde0de833645964c943fd74796ac9e30472908de2861c62a3c8ab01ebf59`.

### test_59cc3a3b8d5ff59db2c0

**render escapes persisted values and the PO document excludes banking**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts) — `modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 3.41 ms, retry 0. SHA-256 da fonte: `512e5b7a1e64e9e5f40cee473aa52d4c25c75593d71eb25510a504cbea7cd95b`.

### test_5cef8551fb09ae7191f1

**sourcing identifies the missing commercial control without blaming completed technical scores**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-guidance.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-guidance.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 2.21 ms, retry 0. SHA-256 da fonte: `ed7eaee8d3514f48088514a40cd5b71009e8ac5e1b7ba51a2d07e4c60cb1cb53`.

### test_5d3aa8e0deba9b4f7ef1

**default addresses and FX update date save, read, render and reset to empty defaults**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/parity-procurement.test.ts) — `modules/sucafina/Sucafinav1/test/parity-procurement.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.88 ms, retry 0. SHA-256 da fonte: `51ed56f58f3d9a9ed3ecf648c3e63fc09de5bb54ea0da0fbaed64b37c4bd4663`.

### test_5dd1a303f67143bd69ff

**adjacent error text is escaped and field ids remain separate across requests**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-guidance.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-guidance.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.16 ms, retry 0. SHA-256 da fonte: `ed7eaee8d3514f48088514a40cd5b71009e8ac5e1b7ba51a2d07e4c60cb1cb53`.

### test_612b88a3e9700edca00f

**real HTTP prepares, reviews and applies C12 with one durable effect and authorized historical evidence**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/host-integration.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/host-integration.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 20693.7 ms, retry 0. SHA-256 da fonte: `88b08df63cb30a88541bab9f513ac49c8bd942b2a8c4e6493bf4e51da460a8c0`.

### test_636c917673d6d1ca810e

**imported high-water marks and deleted requests do not reuse issued numbers**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts) — `modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.73 ms, retry 0. SHA-256 da fonte: `512e5b7a1e64e9e5f40cee473aa52d4c25c75593d71eb25510a504cbea7cd95b`.

### test_64e3912e8fb787acba9d

**C06 preserves zero versus absence and fingerprints compensating financial inputs**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/finance-material.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/finance-material.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.27 ms, retry 0. SHA-256 da fonte: `e91f24a82e044f5674c566238dca0d383fa462656f2805708ba92f14e2086517`.

### test_651e0ea6cd19c23b35e2

**request query opens its authorized target, includes closed rows and leaves other rows closed**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/parity-procurement.test.ts) — `modules/sucafina/Sucafinav1/test/parity-procurement.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 2.3 ms, retry 0. SHA-256 da fonte: `51ed56f58f3d9a9ed3ecf648c3e63fc09de5bb54ea0da0fbaed64b37c4bd4663`.

### test_665a15fd31367d3aafd9

**a stated total mismatch in one proposal suppresses the whole producer ranking**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/comparison-review.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/comparison-review.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 1.43 ms, retry 0. SHA-256 da fonte: `2b2cb2f603396d3decce12441638bac362b5bdd4fda72daa2925e5d9c25214d8`.

### test_667a0783877dc9fe39a9

**C-no-override stays no_override when the admin is also the creator and the flag is on**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/porta/codigo.test.ts) — `modules/sucafina/porta/codigo.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.11 ms, retry 0. SHA-256 da fonte: `af0ebcdd0c2458f0e5df3a3a6809b3a0cbeed24b50ccfb63e9d49f370eebb81e`.

### test_6722bdf3f450851b51a3

**supplier controls reflect existing buyer and supplier admin roles**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.85 ms, retry 0. SHA-256 da fonte: `413455d7fb121b76dd6321886dd8533665cc706815c00aa9b785575e1fef422d`.

### test_68f59d25655edb3be8b4

**L-approve-pr-ultimo opens sourcing and does not create a PO**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/porta/linha.test.ts) — `modules/sucafina/porta/linha.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.33 ms, retry 0. SHA-256 da fonte: `1765a7729694bea626130daba6fb51f231d2d31f45ed049e43b7317e3fd52147`.

### test_69a5069acbfdcaa0bbf5

**asset metadata survives business transitions and deletion returns the deleted record**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts) — `modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.59 ms, retry 0. SHA-256 da fonte: `512e5b7a1e64e9e5f40cee473aa52d4c25c75593d71eb25510a504cbea7cd95b`.

### test_69d6f081e0cdfc30a58a

**a durable application recovers after a lost commit response and cleared review cache**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/host-integration.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/host-integration.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 11118.52 ms, retry 0. SHA-256 da fonte: `88b08df63cb30a88541bab9f513ac49c8bd942b2a8c4e6493bf4e51da460a8c0`.

### test_6b573073b4ba82ac590b

**revoked sourcing authority cannot reuse a prepared input or a dispatched comparison**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/finance-sourcing-integration.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/finance-sourcing-integration.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 72.52 ms, retry 0. SHA-256 da fonte: `796cdf369ba2278228567b86717f28e42a6614d7c1aa540a45d88e2b8e21d1c4`.

### test_6b99f2ee2f1e8da8fb2f

**submitted PO uses its frozen exchange rate and approved and issued totals remain separate**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.3 ms, retry 0. SHA-256 da fonte: `413455d7fb121b76dd6321886dd8533665cc706815c00aa9b785575e1fef422d`.

### test_6ec0aaad82d767ef6d90

**real supplier lifecycle covers all four states, authorized search, linked requests and audit without granting buyer status powers**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 6.03 ms, retry 0. SHA-256 da fonte: `2f8cbde0de833645964c943fd74796ac9e30472908de2861c62a3c8ab01ebf59`.

### test_6edb3b8d0deca3633eab

**request search covers stored requester, buyer and holder identifiers and authorized directory names**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-queues.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-queues.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.94 ms, retry 0. SHA-256 da fonte: `e4ad0858da1afb423145326e3ec065b155096981ddc94339b966e53fe46c951d`.

### test_75509fafd5ad53f7ab3b

**authorized capability reads through an issued scoped source and consumes once**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/capabilities.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/capabilities.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 112.8 ms, retry 0. SHA-256 da fonte: `98a38ae84d453dfce90cabfe49aa8eac72ecc21f8cb4891a28466576d1db341e`.

### test_760e91b918f1f5be8465

**requisition rejection returns field errors from the actual validator**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.91 ms, retry 0. SHA-256 da fonte: `413455d7fb121b76dd6321886dd8533665cc706815c00aa9b785575e1fef422d`.

### test_774ae7de798e5e2c67bb

**L-cancel cancels and leaves every other field**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/porta/linha.test.ts) — `modules/sucafina/porta/linha.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.16 ms, retry 0. SHA-256 da fonte: `1765a7729694bea626130daba6fb51f231d2d31f45ed049e43b7317e3fd52147`.

### test_79177e5f3c3f904f61c5

**money never labels a missing order or ambiguous quotation as an approved amount**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-guidance.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-guidance.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.23 ms, retry 0. SHA-256 da fonte: `ed7eaee8d3514f48088514a40cd5b71009e8ac5e1b7ba51a2d07e4c60cb1cb53`.

### test_7b024e3f261bd49386aa

**approval stage is the current pending level and is scoped to its evidence**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.11 ms, retry 0. SHA-256 da fonte: `2f27c9e96a9be9c4de059a3e5d46d8bda345ddfdd9be57a4ab4bce8b0b06cd68`.

### test_7b757408fda588acb113

**missing and invalid encryption keys fail closed on bank writes without altering state**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts) — `modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 1.38 ms, retry 0. SHA-256 da fonte: `512e5b7a1e64e9e5f40cee473aa52d4c25c75593d71eb25510a504cbea7cd95b`.

### test_7ba9c198f81ec1bb4f57

**the prepared command retains its reviewed inputs when caller-owned outputs are mutated**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/finance-prepared-alias.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/finance-prepared-alias.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 45.91 ms, retry 0. SHA-256 da fonte: `02b0ca570ca7d2621c3b672f302544d8f0a11e7eab59065dd5763f790d6b847b`.

### test_7d32b8d1a40a03da1d9d

**nested supplier bank material is excluded recursively from audits and history**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts) — `modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.61 ms, retry 0. SHA-256 da fonte: `512e5b7a1e64e9e5f40cee473aa52d4c25c75593d71eb25510a504cbea7cd95b`.

### test_7dacfef73083a802eab4

**producer with absent weights or incomplete human assessments withholds ranking**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/comparison-review.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/comparison-review.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 1.07 ms, retry 0. SHA-256 da fonte: `2b2cb2f603396d3decce12441638bac362b5bdd4fda72daa2925e5d9c25214d8`.

### test_7db1565aa04b1bd60e57

**procurement required pages contain functional controls or nonempty read views**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts) — `modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 1.97 ms, retry 0. SHA-256 da fonte: `512e5b7a1e64e9e5f40cee473aa52d4c25c75593d71eb25510a504cbea7cd95b`.

### test_7e76f6971b061c219053

**supplier export requires a consumed UI grant and preserves current scoped source failures**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/capabilities.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/capabilities.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 29.39 ms, retry 0. SHA-256 da fonte: `98a38ae84d453dfce90cabfe49aa8eac72ecc21f8cb4891a28466576d1db341e`.

### test_7f36b3f5c2b6ce56a211

**authorized Requests and My approvals render the actual C02 queue across baseline states**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/queue-view.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/queue-view.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 343.91 ms, retry 0. SHA-256 da fonte: `d9984a1e2efb1c8f835e4d1d5135c79953eedf334c6b2afd106ceb6c7fb38f76`.

### test_7fb9bd61e2a0d844dcfe

**Settings exposes complete baseline policy controls and secondary reset without inventing defaults**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.49 ms, retry 0. SHA-256 da fonte: `2f8cbde0de833645964c943fd74796ac9e30472908de2861c62a3c8ab01ebf59`.

### test_8181d121b72f370d2603

**supplier projection returns authorized fields and refuses bank fields**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.52 ms, retry 0. SHA-256 da fonte: `2f27c9e96a9be9c4de059a3e5d46d8bda345ddfdd9be57a4ab4bce8b0b06cd68`.

### test_81b1cd16baa1d21f71a4

**approval queues sort only by proven entry, keep unavailable history and do not use a save timestamp**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-queues.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-queues.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.36 ms, retry 0. SHA-256 da fonte: `e4ad0858da1afb423145326e3ec065b155096981ddc94339b966e53fe46c951d`.

### test_868acd09c14bbc5badb7

**procurement direct write without canWrite fails atomically**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts) — `modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.48 ms, retry 0. SHA-256 da fonte: `512e5b7a1e64e9e5f40cee473aa52d4c25c75593d71eb25510a504cbea7cd95b`.

### test_86fdcce9cd94f8c153fa

**revocation during the domain read prevents returning the projection**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.52 ms, retry 0. SHA-256 da fonte: `2f27c9e96a9be9c4de059a3e5d46d8bda345ddfdd9be57a4ab4bce8b0b06cd68`.

### test_896c646fb46b2be532fe

**sourcing verifier checks current weights, manual requirements, evidence and offer eligibility**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/finance-sourcing-integration.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/finance-sourcing-integration.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 411.71 ms, retry 0. SHA-256 da fonte: `796cdf369ba2278228567b86717f28e42a6614d7c1aa540a45d88e2b8e21d1c4`.

### test_8978c27ba56c5840645d

**settings reject invalid currencies with visible feedback and reset restores defaults without changing a submitted request**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts) — `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534795463): PASS, 8865 ms, retry 0. SHA-256 da fonte: `6562cb86fc9ea7095fb812b8477363dd59adb9b71907e1096bd72722d3d7b9b5`.

### test_89cb3069fbd8c7923a51

**stock counts open stages only and retains a stage-specific drilldown**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.84 ms, retry 0. SHA-256 da fonte: `2f27c9e96a9be9c4de059a3e5d46d8bda345ddfdd9be57a4ab4bce8b0b06cd68`.

### test_8a9f00368b47495ca8e4

**rejected submissions preserve the submitted currency and never reinterpret a frozen rate**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/finance-material.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/finance-material.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.07 ms, retry 0. SHA-256 da fonte: `e91f24a82e044f5674c566238dca0d383fa462656f2805708ba92f14e2086517`.

### test_8b456816a9ed2059980a

**a real committed save cannot clear edits typed before its response arrives**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts) — `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534795463): PASS, 4513 ms, retry 0. SHA-256 da fonte: `6562cb86fc9ea7095fb812b8477363dd59adb9b71907e1096bd72722d3d7b9b5`.

### test_8ca865396280127bdba3

**a recurring request reaches an internally issued PO with source values and negotiated entries preserved**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts) — `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534795463): PASS, 24572 ms, retry 0. SHA-256 da fonte: `6562cb86fc9ea7095fb812b8477363dd59adb9b71907e1096bd72722d3d7b9b5`.

### test_8e45403eaff5c8b30a92

**contract capability reads only the issued Dashboard scope and rejects revocation and ABA**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/contracts.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/contracts.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 52.45 ms, retry 0. SHA-256 da fonte: `b789caa033731fb83393f84931a21b2e8cef95602d844b7cfcbda1af714e01cf`.

### test_8f9ff172ddc220521190

**C-self-approval empty holder, flag on, creator**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/porta/codigo.test.ts) — `modules/sucafina/porta/codigo.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.06 ms, retry 0. SHA-256 da fonte: `af0ebcdd0c2458f0e5df3a3a6809b3a0cbeed24b50ccfb63e9d49f370eebb81e`.

### test_93beeae51b7da70de4e1

**L-reject-po clears the rate**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/porta/linha.test.ts) — `modules/sucafina/porta/linha.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.1 ms, retry 0. SHA-256 da fonte: `1765a7729694bea626130daba6fb51f231d2d31f45ed049e43b7317e3fd52147`.

### test_9b1d7f1d61ff5bd1daa8

**case-bound sourcing input crosses the real business composition and HTTP authority boundary**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/finance-sourcing-integration.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/finance-sourcing-integration.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 2000.67 ms, retry 0. SHA-256 da fonte: `796cdf369ba2278228567b86717f28e42a6614d7c1aa540a45d88e2b8e21d1c4`.

### test_9b3b6f4a891e4868dfcf

**the A B C comparison shows score components and retains submitted FX in the real detail and queue**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts) — `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534795463): PASS, 10469 ms, retry 0. SHA-256 da fonte: `6562cb86fc9ea7095fb812b8477363dd59adb9b71907e1096bd72722d3d7b9b5`.

### test_9dc9af7d2d9c73917159

**requisition drafts and revisions expose their saved justification in the authorized projection**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.13 ms, retry 0. SHA-256 da fonte: `2f27c9e96a9be9c4de059a3e5d46d8bda345ddfdd9be57a4ab4bce8b0b06cd68`.

### test_a1da3836d0ed8cd76883

**L-approve-pr-resta keeps the status and approve on draft is not a transition**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/porta/linha.test.ts) — `modules/sucafina/porta/linha.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.28 ms, retry 0. SHA-256 da fonte: `1765a7729694bea626130daba6fb51f231d2d31f45ed049e43b7317e3fd52147`.

### test_a34108a4a245992082d7

**ambiguous selected quotes and an overflowing order remain unavailable**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/finance-material.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/finance-material.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.09 ms, retry 0. SHA-256 da fonte: `e91f24a82e044f5674c566238dca0d383fa462656f2805708ba92f14e2086517`.

### test_a38d4034ab1d0f718782

**the canonical three-offer fixture preserves scoring, eligibility and exact price premium**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/finance-material.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/finance-material.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.29 ms, retry 0. SHA-256 da fonte: `e91f24a82e044f5674c566238dca0d383fa462656f2805708ba92f14e2086517`.

### test_a66dd1a7afd35a7c619f

**recurring draft values survive collapsing and saving the nonrecurring section**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-guidance.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-guidance.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 2.17 ms, retry 0. SHA-256 da fonte: `ed7eaee8d3514f48088514a40cd5b71009e8ac5e1b7ba51a2d07e4c60cb1cb53`.

### test_a7f1ee5535ca0a5020ce

**supplier activation reports recorded prerequisites and duplicate tax IDs remain rejected**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 1.0 ms, retry 0. SHA-256 da fonte: `2f8cbde0de833645964c943fd74796ac9e30472908de2861c62a3c8ab01ebf59`.

### test_a896da26bab38d48f910

**producer with missing submitted FX suppresses every score and rank despite a current rate**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/comparison-review.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/comparison-review.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 1.49 ms, retry 0. SHA-256 da fonte: `2b2cb2f603396d3decce12441638bac362b5bdd4fda72daa2925e5d9c25214d8`.

### test_a9ee78304a4fa786cafc

**comparison displays the submitted rate even after the current rate changes**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.75 ms, retry 0. SHA-256 da fonte: `413455d7fb121b76dd6321886dd8533665cc706815c00aa9b785575e1fef422d`.

### test_b0b504bbf9f9dc258d25

**missing currency and incomplete purchase orders cannot inherit a base-currency estimate**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/finance-material.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/finance-material.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.16 ms, retry 0. SHA-256 da fonte: `e91f24a82e044f5674c566238dca0d383fa462656f2805708ba92f14e2086517`.

### test_b5a7210f089cbcf92847

**real PO and register bytes keep missing lines prices currency and frozen FX unavailable**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 2.04 ms, retry 0. SHA-256 da fonte: `2f8cbde0de833645964c943fd74796ac9e30472908de2861c62a3c8ab01ebf59`.

### test_b66e531a2da6e4681149

**supplier creation persists and deletion never reuses its SUP allocation**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts) — `modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 1.3 ms, retry 0. SHA-256 da fonte: `512e5b7a1e64e9e5f40cee473aa52d4c25c75593d71eb25510a504cbea7cd95b`.

### test_bac5fc66329bbd6d288e

**L-approve-po-resta stays pending**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/porta/linha.test.ts) — `modules/sucafina/porta/linha.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.14 ms, retry 0. SHA-256 da fonte: `1765a7729694bea626130daba6fb51f231d2d31f45ed049e43b7317e3fd52147`.

### test_bf481403d481f938378b

**durable queue selection, counts and drilldowns keep requester scope across unrelated changes**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/queue-lifecycle.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/queue-lifecycle.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 61.6 ms, retry 0. SHA-256 da fonte: `fed84abdd811f8d376fc8017b578d6ad13ee6f2bfb492e3f28b5e0e2e0b79af7`.

### test_c094b536461ad6b8b697

**keyboard submission uses current entries and focuses the real 422 field without clearing the draft**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts) — `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534795463): PASS, 2956 ms, retry 0. SHA-256 da fonte: `6562cb86fc9ea7095fb812b8477363dd59adb9b71907e1096bd72722d3d7b9b5`.

### test_c79004b8258e38abd7d9

**runtime and producer present the same submitted quote amount and FX source**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/comparison-review.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/comparison-review.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 1.4 ms, retry 0. SHA-256 da fonte: `2b2cb2f603396d3decce12441638bac362b5bdd4fda72daa2925e5d9c25214d8`.

### test_c86a66c74112c7dba39a

**new PO proposals use saved address defaults and retain existing nonblank PO addresses**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/parity-procurement.test.ts) — `modules/sucafina/Sucafinav1/test/parity-procurement.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 1.06 ms, retry 0. SHA-256 da fonte: `51ed56f58f3d9a9ed3ecf648c3e63fc09de5bb54ea0da0fbaed64b37c4bd4663`.

### test_ca755c19cb9ff8232be3

**L-reject-src clears the snapshot**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/porta/linha.test.ts) — `modules/sucafina/porta/linha.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.12 ms, retry 0. SHA-256 da fonte: `1765a7729694bea626130daba6fb51f231d2d31f45ed049e43b7317e3fd52147`.

### test_cc83f18a6e6b41f8c245

**a stale approval preserves the typed comment and refuses to revive an action after cancellation**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts) — `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534795463): PASS, 5483 ms, retry 0. SHA-256 da fonte: `6562cb86fc9ea7095fb812b8477363dd59adb9b71907e1096bd72722d3d7b9b5`.

### test_cd95359b933ff26f6988

**contract strategy changes preserve saved references and existing-contract submission uses the real validator**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-guidance.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-guidance.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 3.16 ms, retry 0. SHA-256 da fonte: `ed7eaee8d3514f48088514a40cd5b71009e8ac5e1b7ba51a2d07e4c60cb1cb53`.

### test_cfaebd2b0daf4d874a11

**C-reason-required**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/porta/codigo.test.ts) — `modules/sucafina/porta/codigo.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.07 ms, retry 0. SHA-256 da fonte: `af0ebcdd0c2458f0e5df3a3a6809b3a0cbeed24b50ccfb63e9d49f370eebb81e`.

### test_d75f0c6d9b77fc7d80e9

**request detail explains why a different holder cannot be overridden**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.78 ms, retry 0. SHA-256 da fonte: `413455d7fb121b76dd6321886dd8533665cc706815c00aa9b785575e1fef422d`.

### test_d7a2e216fabd133388b6

**bank change through the real domain clears validation and explains revalidation without leaking secrets**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 2.77 ms, retry 0. SHA-256 da fonte: `2f8cbde0de833645964c943fd74796ac9e30472908de2861c62a3c8ab01ebf59`.

### test_d9a58d1eea4de34dbdb9

**duplicate legal names warn on success while distinct tax IDs remain separate**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-supplier.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.36 ms, retry 0. SHA-256 da fonte: `2f8cbde0de833645964c943fd74796ac9e30472908de2861c62a3c8ab01ebf59`.

### test_da0cdc62b37d2701a8c1

**request query cannot reveal a record omitted by the authorization-filtered view**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/parity-procurement.test.ts) — `modules/sucafina/Sucafinav1/test/parity-procurement.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 1.47 ms, retry 0. SHA-256 da fonte: `51ed56f58f3d9a9ed3ecf648c3e63fc09de5bb54ea0da0fbaed64b37c4bd4663`.

### test_da1763a95c4ea64c5c13

**submitted sourcing without a snapshot does not display live FX as historical**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.74 ms, retry 0. SHA-256 da fonte: `413455d7fb121b76dd6321886dd8533665cc706815c00aa9b785575e1fef422d`.

### test_da582267b77c61f4c987

**sourcing comparison reads the authorized request and uses frozen FX**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 3.32 ms, retry 0. SHA-256 da fonte: `2f27c9e96a9be9c4de059a3e5d46d8bda345ddfdd9be57a4ab4bce8b0b06cd68`.

### test_dd8764a3fcf1fa32068a

**incomplete sourcing remains conditioned across the closed shared dispatcher and input verifier**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/finance-sourcing-integration.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/finance-sourcing-integration.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 394.64 ms, retry 0. SHA-256 da fonte: `796cdf369ba2278228567b86717f28e42a6614d7c1aa540a45d88e2b8e21d1c4`.

### test_ddb6a9c27c5eb32a1788

**L-approve-src-resta stays pending and approve on draft is not a transition**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/porta/linha.test.ts) — `modules/sucafina/porta/linha.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.14 ms, retry 0. SHA-256 da fonte: `1765a7729694bea626130daba6fb51f231d2d31f45ed049e43b7317e3fd52147`.

### test_de8fcd13641f882cba9b

**projection reports PO original amount and submitted FX without replacing the base value**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.2 ms, retry 0. SHA-256 da fonte: `2f27c9e96a9be9c4de059a3e5d46d8bda345ddfdd9be57a4ab4bce8b0b06cd68`.

### test_e51b65c2845be17a5dde

**actual browser-shaped nested arrays omit untouched repeat placeholders and preserve zero thresholds**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts) — `modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.75 ms, retry 0. SHA-256 da fonte: `512e5b7a1e64e9e5f40cee473aa52d4c25c75593d71eb25510a504cbea7cd95b`.

### test_e53c4313f3b741674de2

**order shows supplier terms as a suggestion without replacing recorded terms**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/money.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 1.0 ms, retry 0. SHA-256 da fonte: `413455d7fb121b76dd6321886dd8533665cc706815c00aa9b785575e1fef422d`.

### test_e603ec2e6d2f19ff3051

**sourcing comparison crosses the shared dispatcher with frozen money, criteria and a real UI receipt**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/finance-sourcing-integration.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/finance-sourcing-integration.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 69.38 ms, retry 0. SHA-256 da fonte: `796cdf369ba2278228567b86717f28e42a6614d7c1aa540a45d88e2b8e21d1c4`.

### test_e6041c1e1bc3abb0dfd6

**rendered order rows retain omitted metadata across consecutive saves, reorder, removal and a new row**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/ui-guidance.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/ui-guidance.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 5.37 ms, retry 0. SHA-256 da fonte: `ed7eaee8d3514f48088514a40cd5b71009e8ac5e1b7ba51a2d07e4c60cb1cb53`.

### test_e6bba87aaafbd0babca3

**aging uses the trusted observation time and leaves unproven ages unavailable**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/projection.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.23 ms, retry 0. SHA-256 da fonte: `2f27c9e96a9be9c4de059a3e5d46d8bda345ddfdd9be57a4ab4bce8b0b06cd68`.

### test_eb9fea80269b71e960bd

**ordinary nested form rows decode and numeric supplier references remain linked**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts) — `modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 1.66 ms, retry 0. SHA-256 da fonte: `512e5b7a1e64e9e5f40cee473aa52d4c25c75593d71eb25510a504cbea7cd95b`.

### test_edca1cde9e870eb8083f

**bank changes encrypt, reset active validation, audit only fields and protect actor views**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts) — `modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 1.85 ms, retry 0. SHA-256 da fonte: `512e5b7a1e64e9e5f40cee473aa52d4c25c75593d71eb25510a504cbea7cd95b`.

### test_f72276a4ca0247e5b52d

**request fields survive creation, save, submission and actual holder decisions**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts) — `modules/sucafina/Sucafinav1/test/procurement-runtime.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 3.54 ms, retry 0. SHA-256 da fonte: `512e5b7a1e64e9e5f40cee473aa52d4c25c75593d71eb25510a504cbea7cd95b`.

### test_fb74f987b2b32b4ccefa

**L-approve-src-ultimo clears issuedAt and does not create a PO**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/porta/linha.test.ts) — `modules/sucafina/porta/linha.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 0.27 ms, retry 0. SHA-256 da fonte: `1765a7729694bea626130daba6fb51f231d2d31f45ed049e43b7317e3fd52147`.

### test_fd97f7c525436361e6e6

**the page fence refuses material changes and revocation between C02 preparation and rendering**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/queue-view.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/queue-view.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 186.8 ms, retry 0. SHA-256 da fonte: `d9984a1e2efb1c8f835e4d1d5135c79953eedf334c6b2afd106ceb6c7fb38f76`.

### test_ff56fdea15b62cb8e720

**a real case edit between durable receipt and reconciliation preserves the conflict without reapplying**

[Fonte](https://github.com/gustavomhss/Orchestra-SF/blob/dae18b4f43f0daecf46264e876810025684a919d/modules/sucafina/Sucafinav1/test/product/wp04/host-integration.test.ts) — `modules/sucafina/Sucafinav1/test/product/wp04/host-integration.test.ts`. [Run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534137756): PASS, 7192.56 ms, retry 0. SHA-256 da fonte: `88b08df63cb30a88541bab9f513ac49c8bd942b2a8c4e6493bf4e51da460a8c0`.

