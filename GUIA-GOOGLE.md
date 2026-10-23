# Como colocar o Bot de Ofertas no Google Cloud (grátis)

O passo a passo leva uns 15 minutos. Você não precisa de chave nem de PowerShell: tudo é feito pelo navegador.

## 1. Criar a conta

1. Acesse https://console.cloud.google.com e entre com a sua conta Google.
2. Aceite os termos e ative o **teste gratuito**. O Google pede um cartão só para verificação.
3. Os US$ 300 de crédito do teste não importam aqui. A máquina que vamos usar faz parte do plano **"Always Free"**, que continua grátis depois do teste.

## 2. Criar a máquina

1. Abra https://console.cloud.google.com/compute/instancesAdd. Se pedir, clique em **Ativar** a API do Compute Engine e espere 1 ou 2 minutos.
2. Preencha:
   - **Nome:** `bot-ofertas`
   - **Região:** `us-central1 (Iowa)`. Tem que ser uma região dos EUA: us-central1, us-east1 ou us-west1. Em outras regiões, a máquina é cobrada.
   - **Tipo de máquina:** série **E2** › **e2-micro**
   - **Disco de inicialização:** clique em *Alterar* e escolha **Ubuntu 22.04 LTS** (x86/64), tipo **Disco permanente padrão**, com **30 GB**.
   - **Firewall:** marque **Permitir tráfego HTTP**.
3. Clique em **Criar** e espere o ícone verde aparecer.
4. Anote o **IP externo** que aparece na lista.

## 3. Liberar a porta do painel

1. Abra https://console.cloud.google.com/networking/firewalls/add
   - Se esse link não abrir, vá em **Rede VPC › Firewall › Criar regra de firewall**.
2. Preencha:
   - **Nome:** `painel-bot`
   - **Destinos:** *Todas as instâncias na rede*
   - **Intervalos IPv4 de origem:** `0.0.0.0/0`
   - **Protocolos e portas:** marque **TCP** e digite `3000`
3. Clique em **Criar**.

## 4. Instalar

1. Na lista de máquinas, clique no botão **SSH** ao lado de `bot-ofertas`. Um terminal abre numa janela do navegador. Autorize, se ele pedir.
2. Cole este comando e aperte Enter:

```
curl -fsSL https://raw.githubusercontent.com/felippejandrade/bot-ofertas/main/install.sh | bash
```

3. No final, o instalador pede uma senha para o painel e mostra o endereço, algo como `http://SEU_IP:3000`.

## 5. Configurar pelo painel

1. Abra o endereço no navegador e entre com a senha.
2. **WhatsApp:** leia o QR Code com o celular (WhatsApp › Aparelhos conectados › Conectar aparelho). O ideal é usar um número secundário.
3. **Grupos:** marque até 2 grupos de origem e escolha o seu grupo de destino.
4. **Links de afiliado:** confira o `matt_word` e o `matt_tool`.
5. **Testar conversão:** cole uma oferta de um dos grupos e veja como ela ficaria.
6. Marque **Bot ligado** e clique em **Salvar**.

## Para não ter surpresa na fatura

- Crie um alerta de orçamento em https://console.cloud.google.com/billing/budgets com valor de **R$ 5**. Você recebe um e-mail se aparecer qualquer cobrança.
- O plano grátis inclui **1 GB de tráfego de saída por mês**. Ofertas com foto gastam um pouco desse limite. Se passar, o custo é de centavos por GB, e o alerta de orçamento avisa.
- Crie só uma máquina. O grátis vale para uma e2-micro por conta.

## Dia a dia

- **Atualizar o bot:** botão **SSH** › `bash ~/bot-ofertas/install.sh`
- **Ver o que está acontecendo:** `sudo journalctl -u bot-ofertas -f`
- **Reiniciar:** `sudo systemctl restart bot-ofertas`
