# Como colocar o Bot de Ofertas na Oracle Cloud (grátis)

O passo a passo leva uns 20 minutos. Você só faz isso uma vez.

## 1. Criar a conta

1. Acesse https://signup.cloud.oracle.com e crie a conta "Free Tier".
2. Em **Home Region**, escolha **Brazil East (Sao Paulo)**. Essa escolha não pode ser trocada depois.
3. A Oracle pede um cartão só para verificação. A conta fica no plano gratuito e não há cobrança enquanto você usar só recursos "Always Free".
4. A ativação pode levar alguns minutos. Espere chegar o e-mail de confirmação.

## 2. Criar a máquina

1. No painel, abra **Menu ☰ › Compute › Instances › Create instance**.
2. **Name:** `bot-ofertas`.
3. **Image:** clique em *Change image* e escolha **Canonical Ubuntu 22.04** (ou 24.04).
4. **Shape:** clique em *Change shape* e escolha **Ampere › VM.Standard.A1.Flex**, com 1 OCPU e 6 GB de memória. Aparece o selo "Always Free-eligible".
   - Se der erro "Out of capacity", tente de novo mais tarde ou escolha **AMD › VM.Standard.E2.1.Micro**, que também é grátis e dá conta do bot.
5. **Add SSH keys:** deixe em *Generate a key pair for me* e clique em **Save private key**. Guarde esse arquivo (`.key`), porque é a chave de acesso à máquina.
6. Clique em **Create** e espere o status ficar verde (**Running**).
7. Na página da instância, copie o **Public IP address**.

## 3. Liberar a porta do painel

1. Na página da instância, clique no link da **Virtual cloud network** e depois em **Security Lists › Default Security List**.
2. Clique em **Add Ingress Rules** e preencha:
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: `TCP`
   - Destination Port Range: `3000`
3. Salve.

## 4. Entrar na máquina e instalar

**No Windows**, abra o **PowerShell** na pasta onde salvou a chave e rode o comando abaixo (troque o nome do arquivo e o IP):

```
ssh -i .\ssh-key-2026-10-22.key ubuntu@SEU_IP
```

**No Mac**, abra o **Terminal** e rode:

```
chmod 600 ~/Downloads/ssh-key-*.key
ssh -i ~/Downloads/ssh-key-2026-10-22.key ubuntu@SEU_IP
```

Na primeira vez, ele pergunta se você confia na máquina. Digite `yes`.

Já dentro da máquina, cole este comando:

```
curl -fsSL https://raw.githubusercontent.com/felippejandrade/bot-ofertas/main/install.sh | bash
```

No final da instalação, ele pede uma senha para o painel e mostra o endereço, algo como `http://SEU_IP:3000`.

## 5. Configurar pelo painel

1. Abra o endereço no navegador e entre com a senha.
2. **WhatsApp:** leia o QR Code com o celular (WhatsApp › Aparelhos conectados › Conectar aparelho). O ideal é usar um número secundário.
3. **Grupos:** marque até 2 grupos de origem e escolha o seu grupo de destino.
4. **Links de afiliado:** confira o `matt_word` e o `matt_tool`.
5. **Testar conversão:** cole uma oferta de um dos grupos e veja como ela ficaria.
6. Marque **Bot ligado** e clique em **Salvar**.

## Dia a dia

- **Atualizar o bot:** entre na máquina (passo 4) e rode `bash ~/bot-ofertas/install.sh`.
- **Ver o que está acontecendo:** `sudo journalctl -u bot-ofertas -f`
- **Reiniciar:** `sudo systemctl restart bot-ofertas`

## Cuidados

- **Risco de banimento:** o WhatsApp não aprova bots não oficiais. Use um número secundário e mantenha um intervalo de 30 segundos ou mais entre envios.
- **Máquina parada:** a Oracle pode desligar máquinas gratuitas que ficam quase sem uso por 7 dias. Se acontecer, basta ligar de novo em *Instances › Start*. Para evitar de vez, dá para converter a conta para "Pay As You Go" e continuar usando só os recursos gratuitos, sem pagar nada.
