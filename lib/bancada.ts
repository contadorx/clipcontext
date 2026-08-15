/**
 * Quem pode ver as bancadas.
 *
 * Em desenvolvimento, sempre. Em produção, só quando `NEXT_PUBLIC_BANCADA=1`
 * estiver ligada no ambiente — e a ideia é ligar para testar e **desligar
 * depois**.
 *
 * Por que uma variável e não uma sessão: as bancadas montam as telas com massa
 * inventada, sem tocar no banco e sem empresa nenhuma. Exigir login as tornaria
 * inúteis justamente no caso em que servem — abrir a tela sem depender de dado
 * real. O que elas expõem é o desenho do app, não o dado de ninguém.
 *
 * A variável precisa do prefixo `NEXT_PUBLIC_` porque as bancadas são
 * componentes de cliente: sem o prefixo, o valor não chega ao navegador e a
 * guarda barraria tudo.
 *
 * Lembrete honesto: ligada, a rota fica acessível a quem souber o endereço —
 * o `middleware` libera `/estilo` sem sessão de propósito. É aceitável para uma
 * janela de teste; não é para deixar ligada.
 */
export function bancadaLiberada(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_BANCADA === "1";
}
