// A number belongs to the quote ID. Retries must reuse the same reservation.
export async function assignEstimateNumber(quote, client) {
  if (!quote.numberPending) return quote.number;
  let number;
  if (client) {
    const result = await client.rpc("reserve_estimate_number", { p_id: quote.id });
    if (result.error || !/^PM-\d{8}-\d{6}$/.test(result.data || ""))
      throw Error("Não foi possível reservar o número sequencial. Execute estimate-numbering.sql no SQL Editor do Supabase e tente novamente.");
    number = result.data;
  } else {
    const reserve = () => {
      const key = "papeled-estimate-sequence-v1";
      const state = JSON.parse(localStorage.getItem(key) || '{"last":0,"ids":{}}');
      if (state.ids[quote.id]) return state.ids[quote.id];
      if (!Number.isInteger(state.last) || state.last < 0 || state.last >= 999999)
        throw Error("Limite da numeração local atingido ou contador inválido.");
      const date = new Date();
      const day = [date.getFullYear(), String(date.getMonth()+1).padStart(2,"0"), String(date.getDate()).padStart(2,"0")].join("");
      const value = `PM-${day}-${String(++state.last).padStart(6,"0")}`;
      state.ids[quote.id] = value;
      localStorage.setItem(key, JSON.stringify(state));
      return value;
    };
    number = globalThis.navigator?.locks
      ? await navigator.locks.request("papeled-estimate-number", reserve)
      : reserve();
  }
  quote.number = number;
  quote.numberPending = false;
  return number;
}
