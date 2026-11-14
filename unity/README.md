# Fronteira Morta · Unity 6 (3D)

Versão 3D do jogo, em construção. Esta primeira fase é uma **fatia jogável**:

- Uma área da cidade gerada por código (2 × 2 quadras, mesmo traçado da versão web): ruas,
  calçadas de cerâmica azul, casas com telhado de telha laranja, prédios comerciais com 2 a 4
  andares e janelas (algumas acesas), postes com luz à noite, carros e árvores.
- Jogador 3D feito de peças, com caminhada animada, lanterna de peito, energia para correr,
  arma na mão conforme o tipo (pistola, armas longas, pesada, corpo a corpo, punhos).
- Mira pelo mouse, tiro saindo do cano (com rastro e clarão), recarga, golpes corpo a corpo.
- Zumbis 3D (errante, corredor, contaminado, brutamontes) que andam, perseguem, desviam de
  obstáculos, ouvem os tiros, atacam e caem ao morrer.
- Câmera aérea inclinada (~55°, rotação fixa) seguindo o jogador, neblina azulada,
  ciclo de dia e noite (1 dia = 8 minutos).
- Vasculhar segurando E (lixeiras, caixotes, caçambas, carros, baús), com barra de progresso.
- HUD: vida, energia, armas, munição, log amarelo embaixo à esquerda, hora.

O jogo se monta sozinho ao apertar **Play**: não precisa montar cena nem prefab.

## Como abrir

1. Instale o **Unity Hub** e o **Unity 6** (6000.0 LTS ou mais novo).
2. No Hub: **New project → Universal 3D** (URP). Dê o nome `FronteiraMorta3D` e crie.
3. Feche o Unity. Copie a pasta `unity/Assets/FronteiraMorta` deste repositório para dentro da
   pasta `Assets` do projeto criado.
4. Abra o projeto de novo no Hub, abra a cena `Assets/Scenes/SampleScene` e aperte **Play**.

O modelo Universal 3D do Unity 6 já vem com o **Input System** ligado. Se o Unity reclamar de
`UnityEngine.InputSystem`, instale pelo **Window → Package Manager → Input System** e aceite
reiniciar o editor.

## Controles

| Tecla | Ação |
|---|---|
| WASD / setas | andar |
| Shift | correr |
| Mouse | mirar · clique atira/golpeia |
| 1 2 3 / roda | trocar arma |
| R | recarregar |
| E (segurar) | vasculhar |
| H | kit médico |
| L | liga/desliga a lanterna |
| Esc | pausa |
| Enter | recomeçar depois de morrer |

## Organização do código (`Assets/FronteiraMorta/Scripts`)

| Arquivo | O que faz |
|---|---|
| `GameManager.cs` | Monta tudo no Play; dia e noite, neblina, nascimento de zumbis, saque com E, morte |
| `CityBuilder.cs` | Gera a área da cidade em 3D |
| `PlayerController.cs` | Movimento, mira, tiro, corpo a corpo, recarga, energia, lanterna |
| `ZombieAI.cs` | Tipos de zumbi, perseguição, desvio, ataque, dano e morte |
| `HumanoidRig.cs` | Corpo articulado (sobrevivente e zumbis) com caminhada e poses de braço |
| `Weapons.cs` | Dados das armas e modelo 3D de cada tipo |
| `CameraRig.cs` | Câmera inclinada seguindo o jogador |
| `Lootable.cs` | Lugares que dá para vasculhar e o que eles dão |
| `Hud.cs` | Interface na tela |
| `Fx.cs` | Rastro de bala, clarão e sangue |
| `Mat.cs` | Materiais e texturas feitas por código (URP ou Built-in) |

## Próximas fases

Portar da versão web: mochila e inventário, base (Refúgio) com loja, banco, oficina e Ferro
Velho, prédios com interior e andares, hospital/prisão/bunker, várias áreas e mapa da cidade,
missões, profissões, infecção, comida, implantes, chefes, economia, salvamento e trocar os
bonecos de peças por modelos animados (por exemplo, Mixamo ou Asset Store).
