export const MODELS = [
  {
    id: "open",
    name: "Caixa aberta",
    tag: "ESSENCIAL",
    category: "laser",
    description: "Uma base versátil para guardar, presentear e criar.",
    w: 200,
    d: 150,
    h: 80,
    cols: 1,
    rows: 1,
  },
  {
    id: "grid",
    name: "Divisórias em grade",
    tag: "ORGANIZAÇÃO",
    category: "laser",
    description: "Cada peça no seu lugar. Defina linhas e colunas.",
    w: 240,
    d: 180,
    h: 65,
    cols: 3,
    rows: 2,
  },
  {
    id: "custom",
    name: "Divisórias assimétricas",
    tag: "DO SEU JEITO",
    category: "laser",
    description: "Um espaço maior e outros menores, na proporção certa.",
    w: 260,
    d: 180,
    h: 70,
    cols: 2,
    rows: 2,
  },
  {
    id: "lid",
    name: "Caixa com tampa",
    tag: "PROTEÇÃO",
    category: "laser",
    description: "Tampa removível com guia interna para manter tudo protegido.",
    w: 200,
    d: 160,
    h: 90,
    cols: 1,
    rows: 1,
  },
  {
    id: "drawers",
    name: "Gaveteiro modular",
    tag: "OFICINA",
    category: "laser",
    description: "Gavetas independentes para ferramentas e pequenas peças.",
    w: 280,
    d: 200,
    h: 240,
    cols: 2,
    rows: 3,
  },
  {
    id: "sliding",
    name: "Caixa com tampa deslizante",
    tag: "DESLIZE E ORGANIZE",
    category: "laser",
    description: "Tampa que corre em trilhos, sem precisar retirar.",
    w: 220,
    d: 180,
    h: 85,
    cols: 1,
    rows: 1,
  },
  {
    id: "hinged",
    name: "Caixa com dobradiça integrada",
    tag: "ABRE NOVAS IDEIAS",
    category: "laser",
    description: "Articulação recortada nas peças, com eixo ajustável.",
    w: 200,
    d: 160,
    h: 80,
    cols: 1,
    rows: 1,
  },
  {
    id: "print",
    name: "Bandeja 3D",
    tag: "IMPRESSÃO 3D",
    category: "print",
    description: "Uma peça só, com paredes e fundo ajustáveis.",
    w: 140,
    d: 100,
    h: 35,
    cols: 1,
    rows: 1,
  },
  {
    id: "printgrid",
    name: "Organizador 3D",
    tag: "IMPRESSÃO 3D",
    category: "print",
    description: "Compartimentos integrados, prontos para levar ao fatiador.",
    w: 160,
    d: 120,
    h: 35,
    cols: 3,
    rows: 2,
  },
];
MODELS.push(
  {
    id: "tea",
    family: "grid",
    name: "Porta-chás articulado",
    tag: "PAUSA PARA UM CHÁ",
    category: "laser",
    usage: "home",
    description: "Seis espaços para sachês e uma tampa que acompanha o ritual.",
    w: 240,
    d: 180,
    h: 70,
    cols: 3,
    rows: 2,
    preset: { lidType: "hinged", joint: "finger" },
  },
  {
    id: "jewelry",
    family: "custom",
    name: "Porta-joias assimétrico",
    tag: "GUARDE O QUE IMPORTA",
    category: "laser",
    usage: "gifts",
    description: "Um vão maior e três menores para separar acessórios.",
    w: 240,
    d: 180,
    h: 65,
    cols: 2,
    rows: 3,
    preset: {
      lidType: "hinged",
      joint: "finger",
      ratio: 65,
      finish: "natural",
    },
  },
  {
    id: "pencilcase",
    family: "open",
    name: "Estojo para lápis",
    tag: "CRIATIVIDADE À MÃO",
    category: "laser",
    usage: "desk",
    description: "Formato alongado com tampa deslizante para seus materiais.",
    w: 220,
    d: 80,
    h: 40,
    cols: 1,
    rows: 1,
    preset: { lidType: "sliding", joint: "finger" },
  },
  {
    id: "cards",
    family: "open",
    name: "Caixa para cartas",
    tag: "JOGUE NOVAS IDEIAS",
    category: "laser",
    usage: "hobby",
    description:
      "Proteja suas cartas com tampa removível e medidas ajustáveis.",
    w: 100,
    d: 150,
    h: 90,
    cols: 1,
    rows: 1,
    preset: { lidType: "removable", joint: "finger" },
  },
  {
    id: "hardware",
    family: "grid",
    name: "Organizador de componentes",
    tag: "OFICINA EM ORDEM",
    category: "laser",
    usage: "workshop",
    description: "Doze nichos e tampa deslizante para pequenas peças.",
    w: 280,
    d: 200,
    h: 60,
    cols: 4,
    rows: 3,
    preset: { lidType: "sliding", joint: "finger" },
  },
  {
    id: "pencilholder",
    family: "grid",
    name: "Porta-lápis de bancada",
    tag: "UM LUGAR PARA CRIAR",
    category: "laser",
    usage: "desk",
    description: "Quatro compartimentos altos para lápis, pincéis e canetas.",
    w: 120,
    d: 120,
    h: 105,
    cols: 2,
    rows: 2,
    preset: { joint: "finger" },
  },
  {
    id: "deskdrawers",
    family: "drawers",
    name: "Mini gaveteiro de mesa",
    tag: "PEQUENOS TESOUROS",
    category: "laser",
    usage: "desk",
    description: "Três gavetas em uma torre compacta para sua mesa.",
    w: 180,
    d: 180,
    h: 230,
    cols: 1,
    rows: 3,
  },
  {
    id: "painttray",
    family: "printgrid",
    name: "Bandeja para miniaturas",
    tag: "IMPRESSÃO 3D",
    category: "print",
    usage: "hobby",
    description: "Oito nichos baixos para organizar peças e acessórios.",
    w: 180,
    d: 120,
    h: 28,
    cols: 4,
    rows: 2,
    preset: { finish: "black" },
  },
  {
    id: "compacthinge",
    family: "open",
    name: "Caixa articulada compacta",
    tag: "FORMATO COMPACTO",
    category: "laser",
    usage: "gifts",
    description: "Corpo de 106 × 150 × 50 mm, com pivôs e tampa articulada.",
    w: 106,
    d: 150,
    h: 50,
    cols: 1,
    rows: 1,
    preset: { lidType: "hinged", joint: "finger" },
  },
  {
    id: "referencehinge",
    family: "open",
    name: "Caixa articulada do SVG",
    tag: "REFERÊNCIA ENVIADA",
    category: "laser",
    usage: "gifts",
    description:
      "Moldura com braços externos alinhados, aba traseira curta e pivôs recortados. Altura total inclui a tampa.",
    w: 106,
    d: 150,
    h: 50,
    cols: 1,
    rows: 1,
    preset: {
      lidType: "hinged",
      hingeType: "reference",
      joint: "finger",
      lidHeight: 9,
      pivotDiameter: 10,
      clearance: 0.2,
    },
  },
  {
    id: "compactslider",
    family: "open",
    name: "Caixa deslizante compacta",
    tag: "FORMATO COMPACTO",
    category: "laser",
    usage: "gifts",
    description: "Corpo de 125 × 100 × 40 mm para guardar pequenas criações.",
    w: 125,
    d: 100,
    h: 40,
    cols: 1,
    rows: 1,
    preset: { lidType: "sliding", joint: "finger" },
  },
  {
    id: "heartbox",
    family: "open",
    name: "Caixa com coração e haste integral",
    tag: "PERSONALIZE PARA PRESENTEAR",
    category: "laser",
    usage: "gifts",
    description:
      "Tampa com coração, nome gravado e pivô recortado na própria borda.",
    w: 84,
    d: 84,
    h: 50,
    cols: 1,
    rows: 1,
    preset: {
      lidType: "hinged",
      hingeType: "tabbed",
      pivotDiameter: 5,
      joint: "finger",
      lidCutout: "heart",
    },
  },
);
MODELS.push(
  {
    id: "toothbrush",
    family: "toothbrush",
    name: "Porta-escovas de dentes",
    tag: "BANHEIRO ORGANIZADO",
    category: "print",
    usage: "home",
    description:
      "Porta-escovas simples, redondo ou quadrado, com tampa opcional.",
    w: 75,
    d: 75,
    h: 105,
    cols: 1,
    rows: 1,
  },
  {
    id: "lettering",
    family: "lettering",
    name: "Letreiro 3D personalizado",
    tag: "SEU NOME EM 3D",
    category: "print",
    usage: "gifts",
    description: "Nomes e frases com dez fontes comuns, formais e manuscritas.",
    w: 200,
    d: 60,
    h: 8,
    cols: 1,
    rows: 1,
    preset: { finish: "black" },
  },
);
MODELS.push(
  {
    id: "picturepuzzle",
    family: "education",
    toyKind: "picture",
    name: "Quebra-cabeça de figuras",
    tag: "APRENDER BRINCANDO",
    category: "laser",
    usage: "education",
    description:
      "Peixe, tartaruga ou borboleta gravados em peças retas. Ajuste de 4 a 16 peças, base e folga.",
    w: 240,
    d: 180,
    h: 6,
    cols: 1,
    rows: 1,
  },
  {
    id: "shapepuzzle",
    family: "education",
    toyKind: "shapes",
    name: "Encaixe de formas geométricas",
    tag: "FORMAS E DESCOBERTAS",
    category: "laser",
    usage: "education",
    description:
      "De três a seis formas removíveis, com base de apoio, moldura e folga ajustável.",
    w: 300,
    d: 220,
    h: 6,
    cols: 1,
    rows: 1,
  },
  {
    id: "tangram",
    family: "education",
    toyKind: "tangram",
    name: "Tangram com base",
    tag: "SETE PEÇAS, MUITAS IDEIAS",
    category: "laser",
    usage: "education",
    description:
      "Tangram clássico de sete peças, com moldura e guia gravado opcional para montar e criar figuras.",
    w: 220,
    d: 220,
    h: 6,
    cols: 1,
    rows: 1,
  },
);
const baseUsages = {
  open: "home",
  grid: "workshop",
  custom: "home",
  lid: "gifts",
  drawers: "workshop",
  sliding: "home",
  hinged: "gifts",
  print: "desk",
  printgrid: "workshop",
};
MODELS.forEach((m) => {
  m.family ??= m.id;
  m.usage ??= baseUsages[m.id];
});
export const USAGES = {
  education: "Brinquedos pedagógicos",
  home: "Casa e organização",
  desk: "Mesa e escritório",
  workshop: "Oficina maker",
  gifts: "Presentes e acessórios",
  hobby: "Jogos e miniaturas",
};
export const familyFor = (s) =>
  modelById(typeof s === "string" ? s : s.model)?.family;
export const modelById = (id) => MODELS.find((m) => m.id === id);
export function defaults(id = "grid") {
  const m = modelById(id);
  return {
    version: 1,
    toyTheme: "turtle",
    toyCols: 3,
    toyRows: 2,
    toyShapeCount: 4,
    toyGap: 0.3,
    toyLift: 0,
    toyGuide: true,
    model: id,
    name: m.name,
    width: m.w,
    depth: m.d,
    height: m.h,
    thickness: m.category === "print" ? 2 : 3,
    cols: m.cols,
    rows: m.rows,
    ratio: 60,
    clearance: 0.6,
    slotWidth: null,
    finish: m.category === "print" ? "black" : "natural",
    joint: m.family === "hinged" ? "finger" : "straight",
    fingerSize: 9,
    drawerGripWidth: 18,
    lidType:
      { lid: "removable", sliding: "sliding", hinged: "hinged" }[m.family] ||
      "none",
    lidHeight: 9,
    pivotDiameter: 10,
    cornerRadius: 0,
    printLid: "none",
    printOpening: 70,
    brushShape: "round",
    brushCover: false,
    brushCoverHeight: 100,
    brushTexture: "none",
    brushDrain: true,
    brushDrainDiameter: 3,
    brushHoles: 4,
    brushHoleDiameter: 14,
    signText: "Papeled Maker",
    signFont: "roboto",
    signTextHeight: 32,
    signBase: true,
    signOrientation: "flat",
    signJoin: false,
    signSpacing: 0,
    hingeType: "laser",
    lidCutout: "none",
    decorationSize: 50,
    engraveName: "",
    engraveSize: 8,
    lidJoint: "inherit",
    dividerJoint: "inherit",
    railJoint: "inherit",
    drawerJoint: "inherit",
    lidOpening: m.family === "hinged" ? 100 : 55,
    ...m.preset,
    ...(m.preset?.lidType === "hinged" ? { lidOpening: 100 } : {}),
  };
}

// Cards represent distinct construction choices; the original IDs remain
// available as editable starting variations and for saved-project compatibility.
export const CATALOG_GROUPS = [
  {
    id: "laser-boxes",
    name: "Caixas e organizadores a laser",
    category: "laser",
    defaultModel: "open",
    tag: "TAMPAS E DIVISÓRIAS",
    description:
      "Uma caixa, muitas possibilidades: aberta, com divisórias ou com três tipos de tampa.",
  },
  {
    id: "laser-drawers",
    name: "Gaveteiros a laser",
    category: "laser",
    defaultModel: "drawers",
    tag: "GAVETAS MODULARES",
    description:
      "Da torre de mesa ao gaveteiro de oficina. Ajuste níveis, colunas e encaixes.",
  },
  {
    id: "laser-education",
    name: "Brinquedos pedagógicos a laser",
    category: "laser",
    defaultModel: "picturepuzzle",
    tag: "FIGURAS, FORMAS E TANGRAM",
    description:
      "Três modelos para explorar: quebra-cabeça de animais, encaixe de formas e tangram. Personalize medidas, peças e gravação.",
  },
  {
    id: "printed-boxes",
    name: "Caixas e organizadores 3D",
    category: "print",
    defaultModel: "printgrid",
    tag: "CANTOS E TAMPAS 3D",
    description:
      "Corpo em peça única, com cantos ajustáveis, divisórias e tampas opcionais.",
  },
  {
    id: "toothbrushes",
    name: "Porta-escovas 3D",
    category: "print",
    defaultModel: "toothbrush",
    tag: "REDONDO OU QUADRADO",
    description:
      "Formato, medidas e tampa ajustáveis para organizar suas escovas.",
  },
  {
    id: "lettering",
    name: "Letreiros 3D",
    category: "print",
    defaultModel: "lettering",
    tag: "10 FONTES PARA CRIAR",
    description:
      "Personalize nomes e frases. Escolha fontes comuns, formais ou manuscritas.",
  },
];
export const catalogGroupFor = (id) => {
  const m = modelById(typeof id === "string" ? id : id.model);
  return !m
    ? undefined
    : CATALOG_GROUPS.find(
        (g) =>
          g.id ===
          (m.family === "education"
            ? "laser-education"
            : m.family === "toothbrush"
              ? "toothbrushes"
              : m.family === "lettering"
                ? "lettering"
                : m.category === "print"
                  ? "printed-boxes"
                  : m.family === "drawers"
                    ? "laser-drawers"
                    : "laser-boxes"),
      );
};
export const variationsFor = (group) =>
  MODELS.filter(
    (m) =>
      catalogGroupFor(m.id)?.id ===
      (typeof group === "string" ? group : group.id),
  );
export function findCatalogGroups({
  term = "",
  category = "all",
  usage = "all",
} = {}) {
  const normalize = (s) =>
    s
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const query = normalize(term.trim());
  return CATALOG_GROUPS.map((group) => {
    const matches = variationsFor(group).filter(
      (m) =>
        (category === "all" || m.category === category) &&
        (usage === "all" || m.usage === usage) &&
        normalize(
          `${m.name} ${m.description} ${USAGES[m.usage]} ${group.name}`,
        ).includes(query),
    );
    return { ...group, matches };
  }).filter((g) => g.matches.length);
}
