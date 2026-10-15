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
- `npm run test:e2e`: 15 fluxos de navegador, incluindo exportação, importação, persistência, orçamento e celular. Usa Chromium instalado em `/usr/bin/chromium` quando disponível. Em outro ambiente, instale o navegador com `npx playwright install chromium`, ou informe `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
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

As medidas informadas são externas **do corpo**, em milímetros. Tampas e suportes podem aumentar as dimensões finais. As peças são calculadas considerando espessura, união, folga e tipo de tampa. A prévia das caixas usa os mesmos polígonos dos arquivos de corte, extrudados pela espessura. Gaveteiros e modelos para impressão 3D mantêm sua própria construção; as novas uniões/tampas são opções dos modelos de caixa a laser.

- **União reta:** base inteira; frente/traseira repousam sobre ela; laterais ficam entre frente e traseira. Montagem por colagem.
- **União dedo:** contornos complementares na base e nas quinas verticais, sem sobreposição de material. O passo alvo pode ser alterado e é ajustado para um número ímpar de segmentos em cada borda. A cola continua recomendada depois do teste de ajuste.
- **União T:** abas de alinhamento, furos passantes de 3,2 mm e canais T para porcas M3 (bolso de 5,8 × 2,4 mm). Precisa de **4 parafusos e 4 porcas M3**, não incluídos nos contornos. Os canais têm 14,4 mm a partir da lateral; selecione comprimento que alcance a porca sem ultrapassar o canal, considerando a espessura da frente. A base e as divisórias usam cola. As laterais ficam recuadas em `max(2 × espessura, 6,4 mm)` para haver material ao redor dos parafusos; o interior útil e as divisórias são recalculados.
- **Grade:** divisórias cruzadas com ranhuras de meia altura e largura igual à espessura. Longitudinais recebem ranhuras a partir do topo; transversais a partir da base.
- **Assimétrica:** divisória longitudinal inteira e separadores curtos apenas no vão direito; fixação por colagem.
- **Tampa removível:** placa externa com guia colada sob ela; folga por lado define o encaixe. Divisórias terminam abaixo da guia.
- **Tampa deslizante:** quatro tiras coladas nas laterais internas formam canais com vão `espessura + 2 × folga`. A tampa entra pela frente rebaixada; as divisórias ficam abaixo do trilho inferior, sem colisão. A prévia permite abrir e fechar.
- **Dobradiça integrada:** orelhas circulares fazem parte do contorno das laterais do corpo. A tampa tem painel, aba frontal e dois braços laterais com furos coaxiais. São exportadas duas arruelas recortadas; a montagem precisa de **dois pinos/parafusos de eixo com retenção**, do diâmetro escolhido. O furo usa diâmetro do pivô mais a folga (diametral). Comprimento útil mínimo através de corpo, braço, folga e arruela: `3 × espessura + folga`, além da fixação escolhida. O pivô não é uma dobradiça metálica comprada, mas ainda necessita de eixo. Não cole as peças móveis. A abertura vai de 0 a 110° e é preservada no projeto. A altura da aba pode ser ajustada.
- **Gaveteiro:** base, topo, fundo traseiro, laterais, prateleiras e separadores verticais por nível. Gavetas independentes de cinco painéis, com furo frontal de pega. Primeiro monte e esquadre a estrutura; fixe prateleiras e separadores; depois monte as gavetas e verifique o deslizamento. O controle de abertura é só de visualização.
- **SVG/DXF:** escala real em mm, sem compensação de kerf. SVG inclui somente contornos de corte em vermelho, sem textos de gravação; DXF usa polilinhas fechadas na camada `CUT`. Contornos curvos são aproximados por 64 segmentos antes da exportação. Furos e rasgos internos são contornos separados. A numeração exibida no editor corresponde à ordem da lista, mas não é gravada. A disposição é simples, sem otimização de chapa; área informada é a soma dos retângulos envolventes, sem espaçamento/perdas. Configure a máquina e teste o material antes de produzir. Não são arquivos de usinagem CNC com trajetórias de ferramenta.
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

- `src/models.js`: catálogo, famílias de construção, filtros por uso e configurações iniciais.
- `src/geometry.js`: validação, dimensões, divisórias, SVG/DXF e malha STL.
- `src/construction.js`: polígonos de união reta/dedo/T, tampas, trilhos e pivôs, e posicionamento das peças.
- `src/preview.js`: prévia vetorial com ordenação BSP para ocultação correta das faces.
- `main.js`: catálogo, edição, armazenamento, importação, exportação e contato.
- `index.html` e `style.css`: interface responsiva, sem dependência de fontes externas.

Contato: WhatsApp +55 61 99243-0051 e papeledmaker@gmail.com.

## Compatibilidade de projetos

Projetos JSON e projetos locais anteriores continuam aceitos: recebem união reta e os parâmetros novos padrão. O antigo modelo `bin` (Caixa de acesso fácil) não aparece mais no catálogo; projetos já existentes desse tipo são abertos como Caixa aberta, preservando as medidas. Não há reconstrução de parâmetros a partir de SVG/DXF arbitrários.

## Catálogo por uso

São 19 opções: os nove modelos-base e dez configurações de produto. Porta-chás, porta-joias, estojo para lápis, caixa para cartas, organizador de componentes, porta-lápis de bancada, mini gaveteiro, bandeja para miniaturas e duas caixas compactas usam famílias de construção já validadas, com combinações próprias de medidas, divisões e tampas. Não são dez mecanismos novos. A identidade do produto permanece no JSON, nos projetos salvos e no orçamento; os controles e arquivos de fabricação respeitam sua família.

O catálogo combina busca, processo de fabricação e filtro de uso (casa, escritório, oficina, presentes, jogos/miniaturas). As medidas iniciais aparecem nos cartões e podem ser editadas. Miniaturas são imagens SVG geradas uma vez por modelo e carregadas sob demanda.

Os SVGs enviados como referência não são executados ou importados como parâmetros. Os dois modelos compactos usam as medidas declaradas nos nomes dos arquivos: 106 × 150 × 50 mm e 125 × 100 × 40 mm, chapa de 3 mm. Os contornos são regenerados pelo Papeled Maker, sem promessa de reprodução exata do desenho original. O terceiro arquivo foi identificado como uma exportação anterior da própria Papeled Maker.
