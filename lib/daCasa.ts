/* "ESTE PEDIDO VEIO DA NOSSA PÁGINA?" — num lugar só.
 *
 * O `Origin` é posto pelo NAVEGADOR e não pelo JavaScript da página, então ele
 * serve para isto: impedir que qualquer página na internet use as nossas portas
 * de dentro do navegador de alguém. Ele NÃO é segurança contra um script fora
 * do navegador, que manda o cabeçalho que quiser — contra esse valem os
 * limitadores e os segredos.
 *
 * `*.vercel.app` era curinga de UM PROVEDOR INTEIRO, e não do nosso projeto:
 * qualquer pessoa cria um projeto na Vercel de graça e passava na conferência.
 * O curinga existia por um motivo real (a prévia), e o que ele queria dizer é
 * "a prévia DESTE deployment" — que é o que a `VERCEL_URL` diz. Quem precisar
 * de um host a mais o declara em `PREVIA_HOSTS`, explícito e revisável.
 *
 * SAIU DO `app/api/convite/route.ts` em 29/08, quando a segunda rota precisou
 * da mesma conferência. Duas cópias desta função são duas listas de hosts, e a
 * segunda é a que esquece de ser corrigida.
 */
import marca from '@/src/marca.json';

const PREVIA = new Set(
  [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL,
   process.env.VERCEL_PROJECT_PRODUCTION_URL,
   ...(process.env.PREVIA_HOSTS || '').split(',')]
    .map((h) => (h || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
    .filter(Boolean),
);

export function daCasa(req: Request): boolean {
  const origem = req.headers.get('origin') || '';
  if (!origem) return false;
  try {
    const meu = new URL(marca.site).host;
    const dele = new URL(origem).host;
    return dele === meu || dele === `www.${meu}` || PREVIA.has(dele);
  } catch { return false; }
}
