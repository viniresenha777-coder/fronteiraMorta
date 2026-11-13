# Fronteira Morta

Jogo de sobrevivência zumbi visto de cima, feito em JavaScript puro (canvas + WebGL), sem bibliotecas.
Explore uma cidade dividida em áreas por cor de perigo, vasculhe prédios de vários andares, junte armas,
implantes e suprimentos, cumpra missões e sobreviva às hordas.

## Como jogar

**Windows (.exe):** baixe o `FronteiraMorta.exe` na aba *Releases* e abra. O jogo abre numa janela
própria, sem navegador. Precisa do Microsoft Edge WebView2 Runtime (já vem no Windows 10/11 atualizados).
O save fica em `%LOCALAPPDATA%\FronteiraMorta\save.json`.

**Navegador:** sirva a pasta `web/` com qualquer servidor estático e abra o `index.html`:

```bash
cd web && python3 -m http.server 8000
```

## Controles

| Tecla | Ação |
|---|---|
| WASD / Shift | andar / correr |
| Mouse | mirar e atacar |
| 1 2 3 / roda | trocar arma |
| R | recarregar |
| E (segurar) | vasculhar · E entra e usa |
| B | mochila |
| F G H I | comer, beber, kit médico, antibiótico |
| C | atributos e personagem |
| M | mapa do setor (dá para andar com ele aberto) |
| N | mapa da cidade |
| O | objetivos |
| Esc | pausa, missões, salvar e sair |
| Tab | HUD compacto |

## Salvamento

Checkpoint automático por cima do save anterior a cada troca de área e a cada 1 minuto (avisa nas
mensagens do canto da tela), além de "Salvar progresso" e "Salvar e sair" na pausa.
Ao morrer, a partida em andamento é apagada; banco, baú, nível, implantes instalados, nome e
profissão continuam.

## Estrutura

```
web/        o jogo (index.html, css, js, img)
  js/
    config.js      regiões, prédios, móveis, tabelas de saque
    world.js       geração das áreas, pontos especiais (hospital, prisão, bunker)
    interact.js    vasculhar, andares, escadas, interiores
    survival.js    infecção, comida, munição na mochila, profissões, coletes, resgate
    economy.js     economia por região e nome do jogador
    junk.js        Ferro Velho (vender e desmontar)
    checkpoint.js  salvamento (arquivo no .exe, armazenamento local no navegador)
    render*.js     desenho do mundo, HUD e tela da base
windows/    executável para Windows (Go + WebView2), com o jogo embutido
```

## Gerar o .exe

Precisa de Go 1.22+. Em Linux, macOS ou Windows (com Git Bash):

```bash
./windows/build.sh
```

O resultado sai em `windows/FronteiraMorta.exe`. O ícone e os dados de versão já estão em
`windows/rsrc_windows_amd64.syso`; para refazer depois de trocar o `winres/icon.png`:

```bash
cd windows && go run github.com/tc-hib/go-winres@latest make --arch amd64
```

## Créditos

Armas extras do pacote "2D Guns" de Kay Lousberg (OpenGameArt.org, CC0).
