import { modelById } from "./models.js";

export const FINISHES = {
  natural: { label: "Natural", color: "#e4bb67" },
  white: { label: "Branco", color: "#f4f3ef" },
  black: { label: "Preto", color: "#292929" },
};
export const finishKeys = (s) =>
  modelById(s.model).category === "print" ? ["black", "white"] : ["natural", "white"];
export const resolvedFinish = (s) =>
  finishKeys(s).includes(s.finish) ? s.finish : finishKeys(s)[0];
