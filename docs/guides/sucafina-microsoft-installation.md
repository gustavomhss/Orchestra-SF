# Instalação do SF com login Microsoft

Use uma instalação explícita com perfil privado proprietário. A factory recebe a origem do listener, e o perfil Microsoft fixa a origem de ingresso e a origem pública HTTPS. O proxy TLS preserva o Host de ingresso configurado. O listener do Orchestra admite o perfil Microsoft apenas em loopback e ignora os cabeçalhos de encaminhamento.

```sh
orchestra serve --hostname 127.0.0.1 --port 4096 \
  --installation /caminho/absoluto/da/factory \
  --public-origin https://sf.exemplo.com
```

Aponte `SUCAFINA_MICROSOFT_CONFIG` para o perfil proprietário da instalação. A instalação exige diretório, chaves, segredo do cliente e variáveis XDG privados, além de um workspace separado da configuração. O perfil vincula o banco corporativo ao tenant e ao cliente Entra. O acesso às telas existentes do SF é resolvido com grupos Microsoft e o mapa de papéis persistido.

A projeção nativa de Meu trabalho e a conexão Claw entram após a integração da autoridade de produto que aplica `sf_work_list`.
