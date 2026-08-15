// Helpers de exibição. As empresas agora vêm do Supabase (não há mais mock).

export const periodoMock = "mai/2026 – jul/2026";

// Mantido como reexport: vários painéis importam `brl` daqui desde antes de
// existir lib/formato. Duas definições da mesma função é como elas divergem.
export { brl } from "./formato";
