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
- `npm run test:e2e`: 32 fluxos de navegador, incluindo exportação, importação, persistência, orçamento e celular. Usa Chromium instalado em `/usr/bin/chromium` quando disponível. Em outro ambiente, instale o navegador com `npx playwright install chromium`, ou informe `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
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

“Meus projetos” e rascunhos usam `localStorage`. São específicos do navegador/dispositivo, sem sincronização. Uma cópia JSON serve como backup. O botão de orçamento prepara e baixa um ZIP completo, além do resumo editável. O visitante confirma o envio no aplicativo externo. Nenhuma mensagem é enviada automaticamente. A cor é apenas uma referência visual.

## Regras de fabricação

As medidas informadas são externas **do corpo**, em milímetros. Tampas e suportes podem aumentar as dimensões finais. As peças são calculadas considerando espessura, união, folga e tipo de tampa. A prévia das caixas usa os mesmos polígonos dos arquivos de corte, extrudados pela espessura. Todos os conjuntos de montagem a laser, incluindo gaveteiros, oferecem união reta, dedo e T. O corpo dos modelos 3D continua em peça única; tampas e pinos imprimíveis são peças separadas.

- **União reta:** base inteira; frente/traseira repousam sobre ela; laterais ficam entre frente e traseira. Montagem por colagem.
- **União dedo:** contornos complementares na base e nas quinas verticais, sem sobreposição de material. O passo alvo pode ser alterado e é ajustado para um número ímpar de segmentos em cada borda. A cola continua recomendada depois do teste de ajuste.
- **União T:** abas de alinhamento, furos passantes de 3,2 mm e canais para porcas M3 (bolso de 5,8 × 2,4 mm). Os canais têm 14,4 mm a partir da borda. Parafusos e porcas são necessários nesta opção; a quantidade calculada aparece no resumo. Escolha o comprimento pelo caminho até a porca e pela espessura real. Nas quinas do corpo, as laterais ficam recuadas em `max(2 × espessura, 6,4 mm)` para haver material ao redor dos furos; as medidas úteis são recalculadas.
- **Uniões por conjunto:** tampa, divisórias, trilhos e gavetas herdam a união principal ou recebem uma escolha própria. O botão “Aplicar principal a todos” remove as exceções. A união do corpo inclui a base. Nas divisórias, os separadores transversais são segmentados por vão para encaixar nas longitudinais. Dentes opostos são alternados; abas T opostas compartilham metade da profundidade e usam parafusos deslocados, sem sobreposição. A grade antiga com rasgos de meia altura continua disponível como “Cruzada”.
- **Tampa removível:** união reta usa guia colada; dedo/T usam uma moldura de quatro peças sob a tampa, com encaixes na placa e entre as peças. As divisórias terminam abaixo da guia.
- **Tampa deslizante:** quatro trilhos formam canais com vão `espessura + 2 × folga`. A tampa entra pela frente rebaixada e tem puxador frontal unido conforme a configuração da tampa. Trilhos podem ser colados, encaixados ou fixados em T; a largura dos trilhos T aumenta para comportar os canais. As divisórias ficam abaixo deles.
- **Dobradiça com discos e eixos recortados:** duas orelhas fixas nas laterais, dois braços na tampa, dois discos circulares e dois eixos retangulares cortados na própria chapa. O eixo tem seção `espessura × max(espessura, diâmetro/2)` e comprimento `2 × espessura + folga`. Cada eixo atravessa o rasgo da lateral e o do disco; o braço gira ao redor do disco. Monte a tampa para manter o espaçamento antes de fixar os eixos. Cole somente os encaixes retangulares; não cole os braços aos discos. Não precisa comprar pinos ou parafusos para o pivô.
- **Dobradiça com haste na própria tampa:** tampa e haste transversal formam uma só peça. O painel é contínuo até a haste, sem janela entre os braços. A haste tem seção quadrada igual à espessura; o alojamento circular deve comportar sua diagonal (`espessura × √2`) mais a folga. Monte a tampa entre as laterais antes de fechar o corpo. Não há discos ou eixos separados. Não há união entre placas na própria tampa porque ela é monolítica; a configuração de união continua valendo para o corpo. As folgas e os alívios na traseira deixam espaço para a articulação.
- **Eixo externo:** mecanismo anterior mantido como opção e em projetos antigos. Usa duas arruelas recortadas e requer dois pinos/parafusos com retenção. Este modo é identificado explicitamente no editor.
- **Gaveteiro:** estrutura, prateleiras, separadores e gavetas de cinco painéis usam os mesmos contornos no corte e na prévia. A união principal configura a estrutura; os controles de divisórias e gavetas configuram os respectivos conjuntos. Monte e esquadre a estrutura, depois as divisões e finalmente as gavetas. O controle de abertura é só de visualização.
- **Personalização da tampa:** coração, círculo, estrela e flor são recortes reais, com tamanho ajustável. O nome aceita até 30 caracteres, incluindo acentos, números, espaços, ponto, hífen, apóstrofo e `&`. A gravação usa letras maiúsculas em traço simples, geradas como vetores próprios, sem fontes externas. O tamanho se reduz automaticamente para caber na área segura. Ao personalizar, a prévia fecha a tampa para mostrar o desenho.
- **SVG/DXF:** escala real em mm, sem compensação de kerf. Contornos fechados de corte ficam em vermelho na camada `CUT`; os traços abertos da gravação ficam em azul na camada `ENGRAVE`. A numeração da lista não é gravada. A disposição é simples, sem otimização de chapa; a área é a soma dos retângulos envolventes, sem espaçamento/perdas. Configure corte e gravação separadamente na máquina e teste a espessura real antes de produzir. Não são trajetórias de usinagem CNC.
- **STL:** corpo fechado em peça única, com paredes/divisórias/fundo integrados, em mm por convenção; tampas e pinos, quando escolhidos, são sólidos separados. A versão básica preserva a grade retangular anterior; arredondamentos e tampas usam o gerador de sólidos descrito abaixo. Testes verificam fechamento das malhas, orientação e encaixe. Tempo de impressão, suportes e quantidade de material devem ser calculados no fatiador. Não há exportação de G-code.

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

O catálogo mostra cinco grupos: caixas e organizadores a laser, gaveteiros a laser, caixas e organizadores 3D, porta-escovas e letreiros 3D. Os 20 modelos anteriores permanecem como variações iniciais, selecionadas dentro do editor. Porta-chás, porta-joias, estojo para lápis, caixa para cartas, organizador de componentes, porta-lápis de bancada, mini gaveteiro, bandeja para miniaturas e duas caixas compactas usam famílias de construção já validadas, com combinações próprias de medidas, divisões e tampas. Não são dez mecanismos novos. A identidade do produto permanece no JSON, nos projetos salvos e no orçamento; os controles e arquivos de fabricação respeitam sua família.

O catálogo combina busca, processo de fabricação e filtro de uso (casa, escritório, oficina, presentes, jogos/miniaturas). As medidas iniciais aparecem nos cartões e podem ser editadas. Miniaturas são imagens SVG geradas uma vez por modelo e carregadas sob demanda.

Os SVGs enviados como referência não são executados ou importados como parâmetros. Os dois modelos compactos usam as medidas declaradas nos nomes dos arquivos: 106 × 150 × 50 mm e 125 × 100 × 40 mm, chapa de 3 mm. Os contornos são regenerados pelo Papeled Maker, sem promessa de reprodução exata do desenho original. O terceiro arquivo foi identificado como uma exportação anterior da própria Papeled Maker.

A caixa com coração e haste integral acrescenta um produto inspirado no quarto SVG enviado. Os anexos foram inspecionados como geometria, sem executar conteúdo: o primeiro usa discos com rasgos retangulares e eixos também recortados; o quarto usa uma haste ligada à tampa, alojada nas laterais, e recorte de coração. Esses princípios foram reconstruídos de forma paramétrica; não se promete uma cópia exata dos contornos originais. As verificações por software incluem conectividade de painéis, amostragem de colisões, alinhamento dos pivôs e separação entre recortes e gravação. Ainda não houve fabricação física.

## Tampas e cantos para impressão 3D

Todos os modelos 3D oferecem raio de canto (zero mantém cantos retos) e quatro estados: sem tampa, guia de encaixe interno, tampa externa com saia que cobre a caixa e tampa com dobradiça e pino imprimível. A folga é aplicada por lado nas tampas e diametralmente no alojamento do pino. A guia interna rebaixa as divisórias para deixar espaço livre. As dobradiças são unidas ao corpo e à tampa; o pino é outra peça a imprimir e montar. Confira orientação, suportes, retenção do pino e tolerâncias no material real.

O gerador usa Manifold em WebAssembly, com o arquivo WASM incluído no build e servido pelo próprio site. As malhas com cantos arredondados, guias e dobradiças são usadas tanto no STL quanto na prévia. A geometria básica sem tampa e sem arredondamento preserva o gerador anterior. Os testes verificam malhas fechadas, orientação das faces, conectividade e ausência de interseção entre corpo e tampa fechada. Não houve fabricação física.

## Pacote do orçamento e PDF

O botão “Pedir orçamento” gera um ZIP com SVG, DXF, PDF, STL, JSON editável, instruções e resumo inicial do pedido. O ZIP também pode ser baixado em “Exportar”. Para impressão 3D com tampa, o pacote acrescenta arquivos STL individuais de corpo, tampa e pino, quando presente. O STL principal distribui as peças lado a lado, em Z=0.

- Laser: SVG/DXF são arquivos de corte; PDF usa uma peça por página em escala 1:1, com corte vermelho e gravação azul. Imprima em tamanho real, sem ajustar à página. O STL é uma referência da montagem fechada, com placas separadas; não é um sólido único para impressão.
- Impressão 3D: STL contém as peças imprimíveis. SVG/DXF são vistas superior e frontal de referência dimensional, na camada `REFERENCE`, identificadas como inadequadas para corte a laser; o PDF é uma ficha com medidas e ilustração. As medidas declaradas referem-se ao corpo; tampas e suportes podem aumentar o conjunto.

O link `wa.me` e o `mailto:` não aceitam anexos. O site não afirma que o arquivo foi enviado: baixa o ZIP e instrui o visitante a anexá-lo à conversa. Quando `navigator.canShare({files})` é compatível, um botão compartilha o ZIP como arquivo junto do texto editado; o usuário escolhe o aplicativo e o contato. Sem essa API, o download permanece disponível. Nenhum arquivo é enviado a um servidor de terceiros para gerar o pacote.

Novos módulos: `src/print3d.js` (sólidos e malhas 3D) e `src/package.js` (PDF, referências, STL de montagem e ZIP). O build usa JavaScript moderno com inicialização assíncrona do WASM; o pacote de exportação é carregado sob demanda.

## Catálogo consolidado e visualização

A avaliação agrupou itens pela construção, reunindo caixas abertas, tampas e organizadores a laser em um cartão (15 variações); gaveteiros de oficina e mesa em outro (2 variações); bandejas e organizadores 3D em um terceiro (3 variações). Os tamanhos compactos e os usos específicos são pontos de partida, não cartões repetidos. A troca em “Variação inicial” aplica as medidas e opções desse ponto de partida; os demais controles continuam ajustáveis. Busca e filtros examinam as variações e abrem uma configuração correspondente. IDs e parâmetros de projetos antigos permanecem compatíveis.

A montagem 3D e a vista de peças 2D têm zoom independente entre 50% e 400%. Use os botões +/−, a roda do mouse, a pinça com dois dedos ou as teclas +/− com a prévia em foco. Clique na porcentagem, ou pressione 0/Home, para ajustar novamente à tela. Arraste para mover peças em 2D; em 3D, arraste para girar e use Shift + arrastar para mover. Restaurar a câmera também restaura o zoom da vista atual. A câmera é temporária e não altera dimensões, projetos exportados ou arquivos de fabricação.

`src/viewport.js` concentra a câmera, zoom e gestos, sem recalcular as peças. Os testes de navegador incluem limites do zoom, roda do mouse, teclado, movimentação 2D e pinça no celular.

## Tamanho do puxador das gavetas

Nos dois pontos de partida de gaveteiro, “Largura do recorte do puxador” ajusta o recorte semicircular de todas as frentes. A largura é informada em mm e a profundidade corresponde à metade dela. O limite acompanha a largura e a altura útil da frente para preservar material e encaixes. A escolha atualiza montagem, peças 2D, SVG/DXF/PDF/STL, ZIP e resumo de orçamento. É preservada no JSON e nos projetos salvos. Projetos anteriores recebem o valor nominal de 18 mm, limitado pelas dimensões da frente, reproduzindo o tamanho anterior.

## Novos produtos: porta-escovas e letreiros 3D

O catálogo agora tem cinco grupos e 22 pontos de partida: os três grupos anteriores mais Porta-escovas 3D e Letreiros 3D. Os projetos antigos continuam usando os mesmos IDs.

O porta-escovas tem formato redondo ou quadrado, largura/lado e altura ajustáveis. Largura e profundidade acompanham uma à outra para preservar o formato. A tampa externa é opcional; ela pode ser fechada (zero aberturas) ou ter de uma a seis aberturas para escovas. O diâmetro real das aberturas respeita o material disponível e é mostrado no editor. Corpo e tampa são sólidos separados, com a folga aplicada ao encaixe. O corpo redondo usa 96 segmentos no perímetro. Não houve impressão física do produto; teste o encaixe e o material.

Os letreiros aceitam até 36 caracteres, com acentos portugueses, números e pontuação simples. Fontes: Roboto, Lato, Montserrat e Oswald (comuns); Merriweather, Playfair Display e Lora (formais); Pacifico, Dancing Script e Caveat (manuscritas). O tamanho máximo das letras se ajusta à área informada, preservando a proporção; o editor mostra as dimensões resultantes. Com base, o relevo se une à placa numa peça. Sem base, letras, pontos e acentos podem ser peças independentes. A altura total controla a extrusão em Z; com base, sua espessura é descontada do relevo. Confira detalhes finos e orientação no fatiador.

As dez fontes são arquivos locais, com contornos reais: a malha STL usa os mesmos desenhos da prévia. `npm run build:fonts` regenera `src/font-data.json` a partir dos arquivos WOFF dos pacotes Fontsource. Esses pacotes e OpenType.js são dependências de desenvolvimento, usadas na geração; não há consulta a serviços de fontes no navegador. Licenças dos desenhos tipográficos estão em `public/font-licenses/` e acompanham a publicação. A malha usa uma simplificação com tolerância de 0,0001 mm antes da conversão para STL, evitando faces degeneradas na tampa circular.

STL, projeto JSON, PDF, SVG/DXF de referência e ZIP de orçamento incluem as personalizações. SVG/DXF continuam sendo referências dimensionais para esses produtos de impressão 3D, não arquivos para corte a laser.

## Produção de arquivos externos

A página inicial oferece “Enviar meu arquivo” para visitantes que já têm uma criação própria. O formulário aceita um ou mais arquivos, mostra nome e tamanho, permite remover arquivos e acrescentar nome do projeto e detalhes de quantidade/material. Não importa esses arquivos como parâmetros do configurador nem executa seus conteúdos. Os arquivos permanecem em memória apenas enquanto a janela está aberta; ao fechá-la, a seleção é descartada.

Quando o navegador oferece compartilhamento de arquivos, o botão de anexo entrega os arquivos originais e a mensagem à aplicação escolhida pelo visitante. O usuário escolhe WhatsApp ou e-mail, confere o contato e confirma o envio. A conclusão da API representa a entrega ao aplicativo, não confirmação de recebimento pelo estúdio. Cancelar mantém a seleção disponível para tentar novamente.

Os links fixos de WhatsApp e e-mail levam o resumo para +55 61 99243-0051 ou papeledmaker@gmail.com; o visitante deve anexar os arquivos no aplicativo. Os links não fingem incluir anexos. Não há upload para servidor, armazenamento externo ou envio automático. `src/external-files.js` controla esse fluxo, separado da abertura de projetos `.papeled.json` e do orçamento dos produtos paramétricos.


## Cobertura, textura e drenagem; letreiros em pé

O porta-escovas pode receber uma cobertura alta removível, com altura livre de 20 a 250 mm acima da borda. É independente da tampa perfurada: funciona com e sem ela. Uma borda interna limita o encaixe; a folga por lado respeita o controle do editor. O ZIP inclui STL individual da cobertura, além da montagem distribuída para impressão. O controle de abertura levanta a cobertura na prévia.

Texturas externas: canelada vertical, anéis horizontais e pontilhada, além da superfície lisa. São relevos reais unidos ao corpo no STL; a faixa superior permanece lisa para o encaixe. Podem acrescentar até 1,2 mm por lado ao tamanho nominal do corpo. A drenagem opcional faz cinco furos, com diâmetro desejado de 2 a 8 mm (limitado pelo espaço interno), e quatro pés de 2 mm. O fundo sobe 2 mm para preservar a altura externa; a altura útil interna diminui na mesma medida. Projetos antigos sem essa opção continuam com fundo fechado.

O letreiro pode ficar deitado ou em pé sobre a base. Em pé, o campo de altura do corpo passa a definir a espessura das letras; a altura máxima das letras continua em seu controle próprio, e a altura montada aparece no resumo. A base é obrigatória nesse modo. Pequenas ligações sustentam acentos e detalhes, e apoios conectam as letras à base. A opção “Grudadinhas” acrescenta ligações reais de 1,2 mm entre todos os componentes do texto, inclusive espaços e acentos, em ambos os modos. O espaçamento varia de −40% a +40%; ao ativar a união começa em −10%. As ligações podem atravessar espaços e alterar o desenho da fonte; a prévia mostra o resultado. Geometria validada por software; teste a resistência de traços finos e os encaixes na impressão real.


## Identidade e envio com anexos

A identidade usa marrom e branco e a logo original em `public/papeled-logo.png`, exibida em moldura circular sem redesenhar o miolo. “Espaço maker online” aparece na marca e na apresentação. Textos, campos e rótulos têm contraste mais escuro; no celular, descrições e campos usam 16 px.

Para criações externas, o compartilhamento nativo entrega os arquivos originais ou um ZIP quando o navegador só aceita esse formato. O ZIP é preparado antes do clique para preservar a ativação necessária à API de compartilhamento. Há também download de ZIP e de e-mail MIME `.eml` com os anexos binários incorporados. O `.eml` precisa de aplicativo de e-mail compatível; não envia automaticamente nem integra diretamente com Gmail Web. Links `wa.me` e `mailto` continuam limitados a texto, identificados dentro da alternativa de envio manual. Nesse caminho, o visitante deve anexar o ZIP no aplicativo. Nenhum arquivo é enviado a um servidor do site.

## Painel do estúdio e integração de dados

Abra `admin.html` no mesmo endereço do site. O build agora tem duas entradas Vite: o configurador e o painel. O rodapé oferece “Painel do estúdio”.

Sem configuração, o painel oferece uma **prévia local explícita**, sem senha: produtos, pedidos e eventos ficam no `localStorage` deste navegador, não são dados de outros visitantes. A prévia começa vazia, sem números fictícios. Para experimentar, clique em “Experimentar prévia local”, crie/publice um produto, abra o site no mesmo navegador, autorize estatísticas e envie uma solicitação. “Sair” desativa a prévia; os dados locais permanecem neste navegador. A conexão real, quando configurada, prevalece sobre a prévia.

Com Supabase conectado, o painel exige e-mail/senha e permissão em `admin_users`. Produtos publicados são públicos; rascunhos, estatísticas e solicitações são protegidos por RLS. Somente administradores alteram produtos e a situação de pedidos. Anônimos não têm acesso direto de escrita a tabelas; duas funções com campos e tamanhos limitados recebem estatísticas e solicitações. Não são coletados nomes, contatos, URLs de origem nem IPs nas linhas de estatísticas. Contatos são coletados somente no formulário explícito de orçamento, com autorização, e ficam privados.

Funcionalidades desta entrega:

- Indicadores de acessos, modelos abertos, downloads iniciados e solicitações em 7/30/90 dias; gráfico diário, ranking por produto/modelo e formato e CSV diário. O agregado roda no banco, sem a limitação de 1.000 linhas do retorno padrão REST. Eventos em UTC; pedidos exibem horário do navegador.
- Cadastrar, editar, publicar, ocultar e excluir produtos do painel. São variações dos modelos existentes: dimensões, descrição, foto por URL HTTPS e importação opcional do projeto `.papeled.json` para preservar encaixes, tampas, fontes e texturas. O catálogo original permanece disponível. Novos mecanismos exigem desenvolvimento.
- Formulário de solicitação dentro de “Pedir orçamento”. Contato, mensagem e projeto ficam no painel; estados: novo, em atendimento, orçamento enviado e concluído. Abrir WhatsApp ou baixar ZIP não registra um pedido. A lista mostra os 250 mais recentes. Quando a opção de guardar cópia estiver habilitada, o arquivo exato do download é enviado ao arquivo privado do estúdio; o visitante pode desmarcar essa opção.
- Compartilhamento externo continua funcionando; seus downloads ZIP/EML também entram nas estatísticas quando autorizados. Downloads contam acionamentos, não conclusão física, nem compartilhamentos nativos sem download. Acessos não são pessoas únicas. A escolha de estatísticas pode ser revista no rodapé; DNT é respeitado. Nenhum dado anterior à ativação é recuperado. Endpoints públicos de métricas não são auditoria antifraude; antes de campanhas com tráfego elevado, configure monitoramento, limites e proteção contra abuso no projeto.
- Assistente de IA com função Supabase protegida por administrador: somente sugestões revisáveis, sem publicação automática nem alteração de arquivos. Na prévia fica claramente indisponível.

### Ativação do Supabase

O guia para o proprietário está em `public/admin-setup.html` (publicado como `admin-setup.html`).

1. Crie o projeto Supabase e execute **uma vez**, no SQL Editor de um projeto novo, as migrações `supabase/migrations/001_platform.sql` e `002_download_archive.sql`, nessa ordem. `public/admin-schema.sql` reúne as duas para instalação nova. Se a primeira já foi instalada, execute somente a segunda.
2. Crie o usuário em Authentication → Users e desative cadastros públicos. No SQL Editor, autorize seu ID: `insert into public.admin_users(id) values ('UUID-DO-USUARIO');`. Nenhum e-mail recebe privilégio automaticamente.
3. Preencha `public/platform-config.json` com a URL HTTPS do projeto e a chave **pública anon/publishable**. Nunca coloque `service_role`, chave `secret`, senha de usuário ou de banco nesse arquivo. Ele é público por definição. O cliente rejeita chaves secret e JWTs com papel diferente de anon.
4. Execute `npm run build:pages` e publique `docs/` em GitHub Pages. Entre em `admin.html`. Faça uma verificação entre dois navegadores: produto publicado deve aparecer no site, pedido deve aparecer somente no painel autenticado, métricas autorizadas devem ser agregadas. A validação em Supabase real depende da conta/projeto do proprietário; não foi executada sem esse projeto.
5. Opcionalmente publique a função com Supabase CLI: `supabase functions deploy maker-assistant --project-ref SEU-PROJETO`. Cadastre `OPENAI_API_KEY` apenas nos Secrets do Supabase. O modelo padrão da função é `gpt-4.1-mini`; uso da API é cobrado pela OpenAI. Não desative autenticação da função. O código verifica o usuário e `require_admin` antes de chamar a API. Nenhuma chave de IA vai para o frontend. A chamada real de IA não foi executada nesta entrega sem credenciais.

`npm test` inclui geometria e testes SQL em PostgreSQL embarcado (PGlite), com uma simulação mínima de `auth.uid()` e papéis Supabase para verificar políticas reais de RLS e permissões; não substitui o teste no Supabase configurado. `npm run test:e2e` inclui os fluxos locais ponta a ponta do painel. O assistente remoto é fornecido como integração opcional; o build de frontend não valida o runtime Deno da função.


## Cópias dos arquivos baixados

A aba **Arquivos baixados** guarda o mesmo binário acionado pelo visitante (não uma regeneração do projeto): SVG, DXF, STL, PDF, JSON, ZIP e EML. A cópia do ZIP de orçamento e os ZIP/EML de criações externas usam o mesmo arquivo que o navegador recebeu. Cada fluxo informa que a cópia inclui o conteúdo completo e permite desmarcar o envio. Sem conexão nem prévia local, essa opção fica oculta; downloads continuam funcionando normalmente.

Na prévia local os blobs ficam no IndexedDB, separados das estatísticas. No Supabase são guardados no bucket **privado** `maker-downloads`; os metadados ficam em `download_files`, com RLS exclusiva de administrador. A reserva gera caminho UUID, permite somente uma inserção num caminho recém-reservado por até 10 minutos e só confirma o registro depois que o tamanho do objeto armazenado corresponde ao declarado. Anônimos não listam, não leem e não apagam objetos ou metadados. Um SHA-256 calculado sobre o arquivo original é verificado ao recuperar a cópia pelo painel; diferenças impedem o download da cópia. O navegador pode cancelar o download local, portanto a existência da cópia comprova geração/armazenamento, não o salvamento físico no aparelho.

Há limite de 25 MB por arquivo e, para chamadas sem permissão administrativa, 20 reservas por minuto e 100 por dia no projeto inteiro, protegidas por lock transacional. Falhas ou limites não interrompem o download do visitante; a interface informa que a cópia não foi guardada. Dimensione armazenamento e cotas antes de ampliar os limites. O painel mostra as 250 cópias confirmadas mais recentes e permite baixá-las e excluí-las. As cópias não expiram automaticamente; o administrador controla a exclusão. Reservas pendentes e objetos sem confirmação exigem manutenção no Supabase se houver falhas de envio. Arquivos baixados antes da ativação não podem ser recuperados a partir das estatísticas.

Os testes SQL usam tabelas mínimas de Storage em PostgreSQL embarcado para exercer as políticas de acesso; a validação com Storage real depende da conta do proprietário. Os testes de navegador comparam os bytes originais e recuperados para SVG e ZIP, verificam a opção de não enviar e a exclusão da cópia.
