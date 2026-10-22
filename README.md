# Bot de Ofertas

Painel web que conecta no WhatsApp, lê até 2 grupos de ofertas, troca os links do Mercado Livre (e opcionalmente da Amazon) pelos seus links de afiliado e reenvia a oferta para o seu grupo.

## Como funciona

1. Chega uma mensagem num grupo de origem.
2. O bot abre cada link: segue encurtadores (meli.la, amzn.to, bit.ly) até a página do produto. Se cair na vitrine "social" de outro afiliado, ele procura o produto dentro da página.
3. Ele monta o link limpo do produto com os seus parâmetros (`matt_word` e `matt_tool` no Mercado Livre, `tag` na Amazon).
4. A mensagem vai para o seu grupo com o mesmo texto e a mesma imagem, respeitando um intervalo entre os envios e sem repetir o mesmo produto.

Se algum link de marketplace da mensagem não puder ser convertido, a mensagem não é enviada. Assim nenhuma oferta sai com a comissão de outra pessoa. Tudo fica registrado no histórico do painel.

## Rodar no computador

Precisa do Node.js 20 ou mais novo.

```
npm install
PAINEL_SENHA=suasenha npm start
```

Depois é só abrir http://localhost:3000.

## Rodar na nuvem

Veja o [GUIA-ORACLE.md](GUIA-ORACLE.md).

## Estrutura

- `src/server.js`: painel e API
- `src/whatsapp.js`: conexão (Baileys), leitura dos grupos e fila de envio
- `src/links.js`: identificação e conversão dos links
- `src/store.js`: configurações e histórico em `data/`
- `public/index.html`: interface do painel
- `install.sh`: instalação e atualização em servidor Ubuntu
