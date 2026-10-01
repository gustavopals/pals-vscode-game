# Lords of the Guild

Um feudo medieval que você governa nas pausas do café, dentro do VS Code. Você chega a Pedra Alta com cinco aldeões e um baú de moedas, põe gente na Fazenda, ergue as primeiras obras e sai. O mundo continua andando com o editor fechado: quando você volta, um relatório conta o que aconteceu.

Não é um jogo sobre programação. O VS Code é só a interface: uma árvore lateral, um painel, uma linha na barra de status e comandos na paleta. Sessões de 2 a 10 minutos.

## Como começar

1. Clique no ícone da torre na Activity Bar e em **Jogar agora**.
2. Diga como devemos chamar quem governa e o nome do feudo.
3. Pronto. Sem e-mail, sem senha, sem formulário.

A conta nasce nesse clique e o progresso fica no servidor. Para continuar em outra máquina, use **Lords: Vincular conta ao GitHub** (login nativo do VS Code) ou **Lords: Gerar Código do Reino** e, na outra máquina, **Entrar com GitHub** ou **Entrar com Código do Reino**.

## O que dá para fazer nesta versão (0.1)

- Alocar aldeões na Fazenda, na Serraria, na Pedreira e na Mina de Ouro.
- Melhorar o Salão do Senhor, os edifícios produtivos e as Habitações; planejar e cancelar obras.
- Recrutar aldeões, cumprir os primeiros objetivos e ler a Crônica do feudo.
- Jogar só pelo teclado: toda ação tem um comando `Lords: …` na paleta.

Estações com efeito, cartas do Conselho, heróis, exército e o Cerco do Inverno chegam nas próximas versões.

## Comandos

`Lords: Abrir painel` · `Lords: Alocar trabalhadores…` · `Lords: Construir ou melhorar…` · `Lords: Cancelar a obra em andamento` · `Lords: Planejar ou desplanejar uma obra…` · `Lords: Recrutar aldeões…` · `Lords: Renomear o feudo…` · `Lords: Nova partida…` · `Lords: Exportar Crônica (Markdown)` · `Lords: Atualizar agora` · `Lords: Modo discreto` · `Lords: Silenciar notificações por 2 horas` · `Lords: Vincular conta ao GitHub` · `Lords: Gerar Código do Reino` · `Lords: Entrar com GitHub` · `Lords: Entrar com Código do Reino` · `Lords: Sair desta máquina` · `Lords: Excluir conta…` · `Lords: Privacidade` · `Lords: Sobre`

## Configurações

| Configuração | Padrão | O que faz |
|---|---|---|
| `lords.serverUrl` | `http://localhost:3000` | Endereço do servidor do jogo. O padrão é um servidor local de desenvolvimento; passará a ser a instância hospedada quando ela existir. Só vale nas configurações do usuário: um repositório aberto não consegue apontar a extensão para outro servidor. |
| `lords.notifications` | `essential` | `silent` (nada), `essential` (só o que pede atenção, como a fome) ou `all` (inclui obras, aldeões e objetivos). No máximo 3 por hora. |
| `lords.discreetMode` | `false` | A barra de status mostra só um contador e nenhuma notificação aparece. |
| `lords.vigilHour` | `20` | Hora da Vigília, no seu horário local. |

Para usar outro servidor, mude `lords.serverUrl` nas configurações. Cada servidor tem a sua conta: trocar o endereço não mistura sessões.

## Sem conexão

Se o servidor não responde, o painel mostra o último estado conhecido, em modo leitura, e a barra de status diz "Sem ligação com o reino". Nenhuma ordem é enviada nem guardada em fila. A extensão tenta de novo sozinha e volta ao normal quando a ligação volta.

## Privacidade

O servidor guarda da conta: o nome de exibição que você escolheu, o identificador numérico do GitHub (só se você vincular), o rótulo desta máquina, as datas de acesso e os hashes das credenciais. O progresso do feudo, as ordens dadas e os recibos dessas ordens ficam vinculados à conta. O token do GitHub é usado uma vez para confirmar quem você é e não é guardado. Nesta máquina, as credenciais ficam apenas no armazenamento seguro do VS Code (SecretStorage), e o último estado do feudo fica em cache para o modo sem conexão.

**Excluir conta** bloqueia a conta na hora: ela deixa de entrar por qualquer credencial, e a extensão apaga as credenciais e o cache locais. Os dados são removidos do servidor depois de sete dias. Cópias de segurança do servidor podem conter os dados por até 14 dias depois de geradas. Uma conta excluída não pode ser recuperada.

Não há telemetria de terceiros.
