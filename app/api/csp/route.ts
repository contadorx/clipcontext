/* ONDE OS AVISOS DA CSP CHEGAM.
 *
 * A política está em `Report-Only` desde 24/08 — e até 02/09 **sem endereço de
 * relatório**. O navegador conferia, montava o aviso e jogava fora, porque não
 * havia para quem mandar. Uma semana que devia ter virado dados virou trabalho
 * de CPU na máquina dos outros, e a segunda metade da DEC-12 (travar) continuava
 * dependendo de dados que ninguém estava guardando.
 *
 * ---- ESTA ROTA É ABERTA POR NATUREZA, E ISSO MANDA NO DESENHO ----
 *
 * Quem escreve aqui é o navegador de qualquer pessoa, sem sessão e sem que a
 * nossa página tenha pedido — o aviso nasce do próprio navegador quando algo é
 * barrado. Então NÃO dá para exigir origem como o convite e o chamado exigem:
 * o `Origin` de um relatório é a página que violou, e barrá-lo seria recusar
 * justamente os avisos que interessam.
 *
 * O que sobra são as travas que não dependem de saber quem é:
 *
 *   1. CORPO PEQUENO. Um relatório legítimo tem alguns kilobytes. O que passar
 *      de 16 KB é recusado sem ser lido.
 *   2. SÓ OS CAMPOS CONHECIDOS, truncados. Nada do corpo vira linha inteira;
 *      o banco corta de novo, porque quem chama não é de confiança.
 *   3. AGREGADO, e não uma linha por aviso. A chave é (diretiva, barrado,
 *      origem) e o que cresce é um contador — mil avisos iguais são uma linha
 *      com `vezes = 1000`. Sem isso, um site que embutisse o nosso numa moldura
 *      encheria a tabela em minutos.
 *   4. LIMITE POR QUEM MANDA, com o mesmo hash com sal do chamado.
 *
 * E ela responde 204 SEMPRE que o corpo é aceitável, inclusive quando o limite
 * corta. Um navegador não lê o nosso código de status para decidir nada, e um
 * 429 aqui só encheria o console de quem visita — o silêncio é a resposta certa
 * para quem não está pedindo nada.
 */
import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { rpc, temChaveDeServico } from '@/lib/supabase/servico';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TETO_CORPO = 16 * 1024;
const SAL = process.env.CHAMADO_SAL || process.env.CONVITE_SAL || randomBytes(24).toString('hex');
const disfarcar = (v: string) => createHash('sha256').update(`${SAL}:${v}`).digest('hex');

const vazio = () => new NextResponse(null, { status: 204 });

/* Os dois formatos que os navegadores mandam, e eles não são iguais:
   `application/csp-report` embrulha em `csp-report` com chaves separadas por
   hífen; o `application/reports+json` manda um ARRAY de `{type, body}` com
   chaves em camelCase. Aceitar só um é perder metade dos navegadores. */
type Aviso = { diretiva: string; barrado: string; origem: string; amostra: string };

function extrair(corpo: unknown): Aviso[] {
  const avisos: Aviso[] = [];
  const um = (r: Record<string, unknown>) => {
    const s = (v: unknown) => String(v ?? '');
    const diretiva = s(r['effective-directive'] || r.effectiveDirective ||
                       r['violated-directive'] || r.violatedDirective);
    const barrado = s(r['blocked-uri'] || r.blockedURL || r.blockedURI);
    if (!diretiva || !barrado) return;
    avisos.push({
      diretiva: diretiva.slice(0, 60),
      barrado: barrado.slice(0, 400),
      origem: s(r['source-file'] || r.sourceFile || r['document-uri'] || r.documentURL).slice(0, 400),
      amostra: s(r['script-sample'] || r.sample).slice(0, 200),
    });
  };
  if (Array.isArray(corpo)) {
    for (const item of corpo.slice(0, 20)) {
      const i = item as Record<string, unknown>;
      if (i && i.type === 'csp-violation' && i.body) um(i.body as Record<string, unknown>);
    }
  } else if (corpo && typeof corpo === 'object') {
    const c = corpo as Record<string, unknown>;
    if (c['csp-report']) um(c['csp-report'] as Record<string, unknown>);
    else um(c);
  }
  return avisos;
}

export async function POST(req: Request) {
  /* Sem chave de serviço não há onde guardar — e um 204 aqui é honesto: não há
     nada que o navegador possa fazer com um erro nosso. */
  if (!temChaveDeServico) return vazio();

  const bruto = await req.text().catch(() => '');
  if (!bruto || bruto.length > TETO_CORPO) return vazio();

  let corpo: unknown;
  try { corpo = JSON.parse(bruto); } catch { return vazio(); }

  const avisos = extrair(corpo);
  if (!avisos.length) return vazio();

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'sem-ip';
  try {
    if ((await rpc<boolean>('walkstamp_chamado_pode', { p_ator: 'csp:' + disfarcar(ip) })) !== true) {
      return vazio();
    }
    /* Um relatório traz um aviso; o formato novo pode trazer alguns. O teto de
       cinco por pedido impede que um corpo de 16 KB vire duzentas gravações. */
    for (const a of avisos.slice(0, 5)) {
      await rpc('walkstamp_csp_registrar', {
        p_diretiva: a.diretiva, p_barrado: a.barrado,
        p_origem: a.origem, p_amostra: a.amostra,
      });
    }
  } catch { /* o aviso é diagnóstico: perder um não vale um erro para quem visita */ }
  return vazio();
}
