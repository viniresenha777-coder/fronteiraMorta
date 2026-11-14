# Fronteira Morta — instruções para o Claude

Jogo de sobrevivência zumbi com câmera aérea inclinada (~55°). Converse com o dono do projeto em
português do Brasil, de forma simples (ele não é programador).

## Estrutura
- `web/` — versão principal, em JavaScript puro (canvas + WebGL). Roda no navegador.
  Servir com `cd web && python -m http.server 8000`.
- `windows/` — launcher Go + WebView2 que embute `web/` num .exe. `windows/build.sh` gera o exe.
  O GitHub Actions (`.github/workflows/windows-exe.yml`) gera o .exe e atualiza o release
  "Versão mais recente" a cada push na `main` que mexa em `web/` ou `windows/`.
- `unity/` — versão Unity 6 (URP, 3D), em construção. Só scripts em `unity/Assets/FronteiraMorta`
  (o jogo se monta sozinho no Play, sem cena nem prefab). Personagem e zumbis usam as spritesheets
  da versão web como "cartões" virados para a câmera (`SpriteActor.cs`, `PoseData.cs`).
- `tools/` — geradores Python das spritesheets (`gerar_personagem_camera.py`, `gerar_variantes.py`).

## Unity no computador do dono
- O projeto Unity dele foi criado pelo Hub com o modelo **Universal 3D**; a pasta
  `Assets/FronteiraMorta` dele é uma cópia de `unity/Assets/FronteiraMorta` deste repositório.
  Ao mudar o código aqui, copie de novo para o projeto dele (ou peça o caminho do projeto).
- Para checar se compila sem abrir o editor (Windows; ajuste a versão instalada):
  `"C:\Program Files\Unity\Hub\Editor\<versão>\Editor\Unity.exe" -batchmode -quit -projectPath "<pasta do projeto>" -logFile -`
  Erros de C# aparecem como `error CS....` no log.
- Rosa no jogo = shader errado; preto = luz/pós-processamento; olhe o Console.

## Regras
- Teste antes de dizer que funciona. Mudanças na versão web: testar no navegador.
- Commits em português, explicando o que mudou e por quê.
