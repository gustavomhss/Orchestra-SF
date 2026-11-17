# Briefing executivo — Orchestra Sucafina Edition

**Fonte:** plano da branch single-edition-plan, seções 0–6. **Retrato dos fatos:** 17/11/2026, base close-final-candidate@dd378ad2ac14; os estados de PRs descritos são os que o autor viu, **não uma verificação atual**.

## 1. Objetivo e limite

Para o dono, o líder e os executores: traduzir o plano em escolhas, ordem de trabalho e provas necessárias. Este texto **não** aprova merge, implantação, retirada de testes nem alteração do plano.

## 2. Diagnóstico em uma frase

A base ainda encaminhava usuários à “tela branca e verde” do console antigo, embora já tivesse o **shell nativo do Orchestra** com capítulos Sucafina, rotas próprias, serviços/projeções internos e identidade Sucafina proposta em #279; a edição correta é a **Orchestra Sucafina Edition**, **nunca um produto Sucafina separado** (o termo “EXTENSIONS” não é definido no plano).

## 3. O que estava feito ou em andamento

* **Base:** entrada local levava a /sucafina/dashboard; HTML antigo e experiência nativa coexistiam.
* **Já no código:** capítulos /orchestra/sf-* e navegação Orchestra; instalação final ainda não comprovada.
* **#320:** proposta de entrada em / e verificação da origem; sessão autorizada não comprovada.
* **#279:** identidade visual proposta e captura local bem-sucedida; sem aprovação da marca ou pacote final validado.
* **#262:** fábrica e extração passaram naquela revisão; a verificação geral falhou.
* **#305:** conferência do pacote prevista; aprovação final retida até acesso real e testes completos.
* **#306:** quatro arquivos registrados, mas origem e cadeia de cópias não certificadas.
* **#304/#307:** correções de testes em andamento; não equivalem a aprovação.
* **UAT:** roteiros nativos desenhados, **não executados**.

## 4. Decisões exclusivas do dono (seção 5)

1. **T2:** escolher migrar testes antigos para telas nativas ou retirar formalmente os substituídos; **o plano não prefere uma opção**, e recomendo migrar primeiro com equivalência provada para não esconder falhas.
2. **T3:** definir acesso, destino e tempo de retenção do console de homologação; **o plano não define política nem prazo**, e recomendo isolá-lo até prova de equivalência para não perder testes e recuperação.
3. **Marca:** aceitar ou rejeitar logo e derivados de #279 em todos os temas; recomendo decidir após ver a edição realmente instalada, pois a captura local não basta.
4. **Aceitação:** definir prioridades e exceções com Financeiro, Compras, Segurança, Qualidade e CIO; **o plano não escolhe exceções**, e recomendo manter bloqueios até aprovação expressa porque falta de prova não é aceite.
5. **Produção:** decidir acessos, janela, troca da VM e recuperação; recomendo negar o corte até validar autenticação e retorno seguro, pois a operação real não foi demonstrada.
6. **Demonstração:** escolher URL e perfil e esclarecer o suposto “302” da entrada corporativa; **isso não está claro no plano**, e recomendo registrar a resposta real porque o código local descrito usa 303.

## 5. Ordem dos PRs e do que dependem (seção 6)

* **Início:** conciliar #320 com **T8** (entrada e autorização); produzir **T2a** (mapa de testes), sem desligá-los.
* **Preparação:** **T3a** (homologação), **T5a** (provas visuais), **T6a** (linguagem dos documentos).
* **Depois da decisão T2:** **T2b** migra ou substitui testes; **T3b** restringe o HTML antigo apenas após entrada segura e equivalência.
* **Pacote:** reunir **#279, #262 e #305** em **T4a** (uma versão, pacote extraído); então **T5b** prova o uso autenticado e **T4b** busca validação final, também dependente de T2.
* **Fechamento:** **T6b** atualiza a aceitação; **T7** exige T4b, prova visual, documentação e autorização do dono; a custódia de **#306** segue como verificação própria.

Esta ordem é **proposta de integração, não autorização de merge**.

## 6. Riscos e lacunas reconhecidas

**Bloqueios:** T1 não fecha sem T8; T2 não muda verificações sem decisão; T3 não remove a tela antes de provar substituição; T4a exige #279 corrigido e acesso seguro; T4b exige testes e interface instalada; T7 exige autorização operacional.

**O que pode perder valor:** captura de #279 não prova o pacote #262; extração prevista em #305 não prova login; correções #304/#307 não validam automaticamente testes antigos, e uma nova versão exige novas provas.

**Não comprovado:** o inventário relata **17** referências antigas, mas suas partes somam **18**; seleção antiga de servidor é risco, não defeito confirmado; faltavam provas de SSO real, estado da VM, recuperação, custódia #306 e aceite final; prazo da homologação: **não claro no plano**.

## 7. Lista de execução — responsáveis sugeridos

_O plano não atribui pessoas a cada etapa; as funções abaixo são sugestões._

1. **Lead:** rever versões e provas e separar responsáveis por arquivo.
2. **GPT:** conciliar #320/T8 e comprovar entrada e autorização reais.
3. **GPT:** preparar T2a, T3a, T5a e T6a sem suprimir testes.
4. **Dono:** decidir T2, T3, marca e condições de aceitação.
5. **GPT:** executar T2b/T3b aprovados e consolidar #279/#262/#305 em T4a.
6. **Lead:** cobrar T5b, T4b, T6b e verificação independente de #306.
7. **Dono:** somente com provas, autorizar ou negar T7 e eventual corte de produção.
