# Papeled Maker — espaço maker online

Aplicação estática em português para criar caixas e organizadores paramétricos. Não precisa de banco de dados, cadastro ou chaves de API. Os arquivos enviados como referência serviram como inspiração de catálogo; os cálculos e o editor foram implementados neste projeto.

## Executar

Node.js 20.19+ ou 22.12+.

```sh
cd /workspace/projeto2021
npm ci --cache /tmp/papeled-npm-cache
npm run dev
```

- `npm test`: testes de geometria, dimensões, ranhuras, folgas, disposição dos painéis e integridade dos sólidos STL.
- `npm run test:e2e`: oito fluxos de navegador, incluindo exportação, importação, persistência, orçamento e celular. Usa Chromium instalado em `/usr/bin/chromium` quando disponível. Em outro ambiente, instale o navegador com `npx playwright install chromium`, ou informe `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
- `npm run build`: gera `dist/`, com caminhos relativos para hospedagem em subpastas.
- `npm run build:pages`: compila e atualiza a pasta gerada `docs/`. Não edite `docs/` manualmente.

## Modelos e capacidades

| Modelo                  | Personalização                                                                 | Exportação |
| ----------------------- | ------------------------------------------------------------------------------ | ---------- |
| Caixa aberta            | Dimensões e espessura; pode adicionar divisórias                               | SVG / DXF  |
| Divisórias em grade     | Até 5 colunas × 5 linhas                                                       | SVG / DXF  |
| Divisórias assimétricas | Um vão grande à esquerda, 1 a 5 vãos à direita, proporção de largura ajustável | SVG / DXF  |
| Caixa com tampa         | Tampa removível com guia e folga por lado                                      | SVG / DXF  |
| Gaveteiro modular       | Até 5 colunas × 5 linhas; folga por lado; abertura na prévia                   | SVG / DXF  |
| Caixa de acesso fácil   | Frente rebaixada                                                               | SVG / DXF  |
| Bandeja 3D              | Dimensões, parede e fundo                                                      | STL        |
| Organizador 3D          | Até 5 colunas × 5 linhas integradas                                            | STL        |

Todos exportam `.papeled.json` para reabrir o projeto. A importação aceita esse formato próprio; não reconstrói modelos a partir de SVG, DXF ou STL arbitrários.

“Meus projetos” e rascunhos usam `localStorage`. São específicos do navegador/dispositivo, sem sincronização. Uma cópia JSON serve como backup. O WhatsApp e o e-mail recebem um resumo editável; o visitante confirma o envio no aplicativo externo. Nenhuma mensagem é enviada automaticamente. A cor é apenas uma referência visual.

## Regras de fabricação

As medidas informadas são externas, em milímetros. Todas as dimensões das peças são calculadas descontando a espessura real da chapa.

- **Caixas a laser:** junções retas para colagem. A base tem largura × profundidade externas. Frente/traseira repousam sobre a base; laterais ficam entre frente e traseira. Não há encaixes dentados.
- **Grade:** divisórias cruzadas com ranhuras de meia altura e largura igual à espessura. Longitudinais recebem ranhuras a partir do topo; transversais a partir da base.
- **Assimétrica:** divisória longitudinal inteira e separadores curtos apenas no vão direito; fixação por colagem.
- **Tampa:** tampa externa com uma placa-guia colada sob ela. Folga por lado define o encaixe dessa guia.
- **Gaveteiro:** base, topo, fundo traseiro, laterais, prateleiras e separadores verticais por nível. Gavetas independentes de cinco painéis, com furo frontal de pega. Primeiro monte e esquadre a estrutura; fixe prateleiras e separadores; depois monte as gavetas e verifique o deslizamento. O controle de abertura é só de visualização.
- **SVG/DXF:** escala real em mm, sem compensação de kerf. SVG inclui somente contornos de corte em vermelho, sem textos de gravação; DXF usa a camada `CUT`. A numeração exibida no editor corresponde à ordem da lista, mas não é gravada. A disposição é simples, sem otimização de chapa; área informada é a soma dos retângulos envolventes, sem espaçamento/perdas. Configure a máquina e teste o material antes de produzir. Não são arquivos de usinagem CNC com trajetórias de ferramenta.
- **STL:** sólido fechado único, com paredes/divisórias/fundo integrados, em mm por convenção. O gerador extrai a fronteira de uma grade retangular, sem sólidos sobrepostos. Testes verificam arestas com duas faces, orientação e volume esperado. Tempo de impressão, suportes e quantidade de material devem ser calculados no fatiador. Não há exportação de G-code.

Os arquivos foram validados por software; cortes e impressões físicas ainda precisam ser testados com o equipamento e material do estúdio.

## Publicação

O GitHub Pages deve usar a branch `main`, pasta `/docs`, em **Settings → Pages → Deploy from a branch**. Depois de alterar o código:

```sh
npm test
npm run test:e2e
npm run build:pages
```

Versione os fontes e a pasta gerada `docs/`. A publicação depende do Pages estar habilitado e do processamento do GitHub. `dist/` não é versionado.

## Organização

- `src/geometry.js`: validação, painéis, dimensões, SVG/DXF e malha STL.
- `src/preview.js`: prévia vetorial com ordenação BSP para ocultação correta das faces.
- `main.js`: catálogo, edição, armazenamento, importação, exportação e contato.
- `index.html` e `style.css`: interface responsiva, sem dependência de fontes externas.

Contato: WhatsApp +55 61 99243-0051 e papeledmaker@gmail.com.
