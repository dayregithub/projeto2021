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
- `npm run test:e2e`: 17 fluxos de navegador, incluindo exportação, importação, persistência, orçamento e celular. Usa Chromium instalado em `/usr/bin/chromium` quando disponível. Em outro ambiente, instale o navegador com `npx playwright install chromium`, ou informe `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
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
| Bandeja 3D              | Dimensões, parede e fundo                                                      | STL        |
| Organizador 3D          | Até 5 colunas × 5 linhas integradas                                            | STL        |

Todos exportam `.papeled.json` para reabrir o projeto. A importação aceita esse formato próprio; não reconstrói modelos a partir de SVG, DXF ou STL arbitrários.

“Meus projetos” e rascunhos usam `localStorage`. São específicos do navegador/dispositivo, sem sincronização. Uma cópia JSON serve como backup. O WhatsApp e o e-mail recebem um resumo editável; o visitante confirma o envio no aplicativo externo. Nenhuma mensagem é enviada automaticamente. A cor é apenas uma referência visual.

## Regras de fabricação

As medidas informadas são externas **do corpo**, em milímetros. Tampas e suportes podem aumentar as dimensões finais. As peças são calculadas considerando espessura, união, folga e tipo de tampa. A prévia das caixas usa os mesmos polígonos dos arquivos de corte, extrudados pela espessura. Todos os conjuntos de montagem a laser, incluindo gaveteiros, oferecem união reta, dedo e T. Os modelos para impressão 3D continuam em peça única.

- **União reta:** base inteira; frente/traseira repousam sobre ela; laterais ficam entre frente e traseira. Montagem por colagem.
- **União dedo:** contornos complementares na base e nas quinas verticais, sem sobreposição de material. O passo alvo pode ser alterado e é ajustado para um número ímpar de segmentos em cada borda. A cola continua recomendada depois do teste de ajuste.
- **União T:** abas de alinhamento, furos passantes de 3,2 mm e canais para porcas M3 (bolso de 5,8 × 2,4 mm). Os canais têm 14,4 mm a partir da borda. Parafusos e porcas são necessários nesta opção; a quantidade calculada aparece no resumo. Escolha o comprimento pelo caminho até a porca e pela espessura real. Nas quinas do corpo, as laterais ficam recuadas em `max(2 × espessura, 6,4 mm)` para haver material ao redor dos furos; as medidas úteis são recalculadas.
- **Uniões por conjunto:** tampa, divisórias, trilhos e gavetas herdam a união principal ou recebem uma escolha própria. O botão “Aplicar principal a todos” remove as exceções. A união do corpo inclui a base. Nas divisórias, os separadores transversais são segmentados por vão para encaixar nas longitudinais. Dentes opostos são alternados; abas T opostas compartilham metade da profundidade e usam parafusos deslocados, sem sobreposição. A grade antiga com rasgos de meia altura continua disponível como “Cruzada”.
- **Tampa removível:** união reta usa guia colada; dedo/T usam uma moldura de quatro peças sob a tampa, com encaixes na placa e entre as peças. As divisórias terminam abaixo da guia.
- **Tampa deslizante:** quatro trilhos formam canais com vão `espessura + 2 × folga`. A tampa entra pela frente rebaixada e tem puxador frontal unido conforme a configuração da tampa. Trilhos podem ser colados, encaixados ou fixados em T; a largura dos trilhos T aumenta para comportar os canais. As divisórias ficam abaixo deles.
- **Dobradiça com discos e eixos recortados:** duas orelhas fixas nas laterais, dois braços na tampa, dois discos circulares e dois eixos retangulares cortados na própria chapa. O eixo tem seção `espessura × max(espessura, diâmetro/2)` e comprimento `2 × espessura + folga`. Cada eixo atravessa o rasgo da lateral e o do disco; o braço gira ao redor do disco. Monte a tampa para manter o espaçamento antes de fixar os eixos. Cole somente os encaixes retangulares; não cole os braços aos discos. Não precisa comprar pinos ou parafusos para o pivô.
- **Dobradiça com haste na própria tampa:** tampa e haste transversal formam uma só peça. A haste tem seção quadrada igual à espessura; o alojamento circular deve comportar sua diagonal (`espessura × √2`) mais a folga. Monte a tampa entre as laterais antes de fechar o corpo. Não há discos ou eixos separados. Não há união entre placas na própria tampa porque ela é monolítica; a configuração de união continua valendo para o corpo. As folgas e os alívios na traseira deixam espaço para a articulação.
- **Eixo externo:** mecanismo anterior mantido como opção e em projetos antigos. Usa duas arruelas recortadas e requer dois pinos/parafusos com retenção. Este modo é identificado explicitamente no editor.
- **Gaveteiro:** estrutura, prateleiras, separadores e gavetas de cinco painéis usam os mesmos contornos no corte e na prévia. A união principal configura a estrutura; os controles de divisórias e gavetas configuram os respectivos conjuntos. Monte e esquadre a estrutura, depois as divisões e finalmente as gavetas. O controle de abertura é só de visualização.
- **Personalização da tampa:** coração, círculo, estrela e flor são recortes reais, com tamanho ajustável. O nome aceita até 30 caracteres, incluindo acentos, números, espaços, ponto, hífen, apóstrofo e `&`. A gravação usa letras maiúsculas em traço simples, geradas como vetores próprios, sem fontes externas. O tamanho se reduz automaticamente para caber na área segura. Ao personalizar, a prévia fecha a tampa para mostrar o desenho.
- **SVG/DXF:** escala real em mm, sem compensação de kerf. Contornos fechados de corte ficam em vermelho na camada `CUT`; os traços abertos da gravação ficam em azul na camada `ENGRAVE`. A numeração da lista não é gravada. A disposição é simples, sem otimização de chapa; a área é a soma dos retângulos envolventes, sem espaçamento/perdas. Configure corte e gravação separadamente na máquina e teste a espessura real antes de produzir. Não são trajetórias de usinagem CNC.
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
- `src/construction.js`: corpo, tampas, trilhos e pivôs.
- `src/joinery.js` e `src/assemblies.js`: encaixes por contato, divisórias e gaveteiros.
- `src/decoration.js`: recortes e fonte vetorial própria para gravação.
- `src/preview.js`: prévia vetorial com ordenação BSP para ocultação correta das faces.
- `main.js`: catálogo, edição, armazenamento, importação, exportação e contato.
- `index.html` e `style.css`: interface responsiva, sem dependência de fontes externas.

Contato: WhatsApp +55 61 99243-0051 e papeledmaker@gmail.com.

## Compatibilidade de projetos

Projetos JSON e projetos locais anteriores continuam aceitos. Arquivos sem os campos novos recebem valores compatíveis: dobradiças antigas preservam o eixo externo e grades antigas preservam os rasgos cruzados. O editor permite mudar para os mecanismos novos. O antigo modelo `bin` (Caixa de acesso fácil) não aparece mais no catálogo; projetos já existentes desse tipo são abertos como Caixa aberta, preservando as medidas. Não há reconstrução de parâmetros a partir de SVG/DXF arbitrários.

## Catálogo por uso

São 20 opções: os nove modelos-base e onze configurações de produto. Porta-chás, porta-joias, estojo para lápis, caixa para cartas, organizador de componentes, porta-lápis de bancada, mini gaveteiro, bandeja para miniaturas e duas caixas compactas usam famílias de construção já validadas, com combinações próprias de medidas, divisões e tampas. Não são dez mecanismos novos. A identidade do produto permanece no JSON, nos projetos salvos e no orçamento; os controles e arquivos de fabricação respeitam sua família.

O catálogo combina busca, processo de fabricação e filtro de uso (casa, escritório, oficina, presentes, jogos/miniaturas). As medidas iniciais aparecem nos cartões e podem ser editadas. Miniaturas são imagens SVG geradas uma vez por modelo e carregadas sob demanda.

Os SVGs enviados como referência não são executados ou importados como parâmetros. Os dois modelos compactos usam as medidas declaradas nos nomes dos arquivos: 106 × 150 × 50 mm e 125 × 100 × 40 mm, chapa de 3 mm. Os contornos são regenerados pelo Papeled Maker, sem promessa de reprodução exata do desenho original. O terceiro arquivo foi identificado como uma exportação anterior da própria Papeled Maker.

A caixa com coração e haste integral acrescenta um produto inspirado no quarto SVG enviado. Os anexos foram inspecionados como geometria, sem executar conteúdo: o primeiro usa discos com rasgos retangulares e eixos também recortados; o quarto usa uma haste ligada à tampa, alojada nas laterais, e recorte de coração. Esses princípios foram reconstruídos de forma paramétrica; não se promete uma cópia exata dos contornos originais. As verificações por software incluem conectividade de painéis, amostragem de colisões, alinhamento dos pivôs e separação entre recortes e gravação. Ainda não houve fabricação física.
