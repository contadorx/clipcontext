/* Seus dados — o que o servidor guarda desta pessoa, e o botão que apaga.
 *
 * Esta tela existe por causa da DEC-3, decidida no caminho A: o servidor guarda
 * o que a feature precisa, e a conta mostra o quê. A promessa da DEC-1 ("nada do
 * seu conteúdo sai sem um gesto seu", com a matriz de exceções nomeada) só é
 * defensável se houver um lugar onde a matriz é a VERDADE MEDIDA, e não uma
 * lista escrita à mão numa página de marketing. Este lugar é este.
 *
 * DUAS COLUNAS, e as duas são obrigatórias. Uma tela que só lista o que apaga é
 * a mesma promessa de antes com mais palavras; uma que só lista o que fica é uma
 * confissão. O que torna a página honesta é ela dizer as duas coisas na mesma
 * altura, com o motivo do que fica escrito ao lado do que fica.
 *
 * SEM `exige`. Quem está no plano gratuito também entra aqui — é justamente
 * quem mais precisa da resposta antes de decidir se assina.
 */
import { notFound, redirect } from 'next/navigation';
import { ehLang, textos, preencher, CAMINHO } from '@/lib/conta/textos';
import { rpc } from '@/lib/supabase/servico';
import { Envolver, Porta, carregar } from '../carga';
import { apagarMeusDados } from '../../dados-acoes';
import Apagar from './Apagar';

export const dynamic = 'force-dynamic';

type Dados = {
  erro?: string;
  email: string;
  prazos: { conta_dias: number; lista_meses: number; evento_meses: number };
  apagavel: { roteiros: number; casos: number; anexos: number; modelos: number; chamados: number };
  fica: { faturas: number; emissoes: number };
  total_apagavel: number;
};

export default async function Pagina(
  { params, searchParams }: PageProps<'/conta/[lang]/dados'>,
) {
  const { lang } = await params;
  if (!ehLang(lang)) notFound();
  const t = textos(lang);
  const q = await searchParams;
  const par = (n: string) => (typeof q?.[n] === 'string' ? (q[n] as string) : null);

  const carga = await carregar();
  if (carga.estado === 'semChave' || carga.estado === 'erro') redirect(CAMINHO[lang]);

  if (carga.estado !== 'ok') {
    return (
      <Envolver lang={lang} t={t} slug="dados" carga={carga}>
        <h1 className="soLeitor">{t.navDados}</h1>
        <Porta lang={lang} t={t} motivo="fora" titulo={t.navDados} texto={t.dadosLead} />
      </Envolver>
    );
  }

  /* Se o banco não responder, a tela não inventa zeros: zeros aqui seriam a
     mentira mais cara da página — "não guardamos nada seu" dito por um erro
     de rede. */
  let d: Dados | null = null;
  try { d = await rpc<Dados>('walkstamp_meus_dados', { p_email: carga.email }); }
  catch { d = null; }

  const feito = par('feito') === '1';
  const erro = par('erro');

  return (
    <Envolver lang={lang} t={t} slug="dados" carga={carga}>
      <h1 className="soLeitor">{t.navDados}</h1>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>{t.dadosTitulo}</h2>
        <p className="lead" style={{ marginTop: 0 }}>{t.dadosLead}</p>

        {feito && <p className="ok" role="status">{t.dadosFeito}</p>}
        {erro === 'naoBate' && <p className="erro" role="alert">{t.dadosNaoBate}</p>}
        {erro === 'falhou' && <p className="erro" role="alert">{t.dadosErro}</p>}

        {!d || d.erro ? <p className="erro" role="alert">{t.dadosErro}</p> : (
          <>
            <h3>{t.dadosApagavel}</h3>
            <table className="dados">
              <tbody>
                <tr><td>{t.dadosRoteiros}</td><td className="n">{d.apagavel.roteiros}</td></tr>
                <tr><td>{t.dadosCasos}</td><td className="n">{d.apagavel.casos}</td></tr>
                <tr><td>{t.dadosAnexos}</td><td className="n">{d.apagavel.anexos}</td></tr>
                <tr><td>{t.dadosModelos}</td><td className="n">{d.apagavel.modelos}</td></tr>
                <tr><td>{t.dadosChamados}</td><td className="n">{d.apagavel.chamados}</td></tr>
              </tbody>
            </table>

            <h3>{t.dadosFica}</h3>
            <table className="dados">
              <tbody>
                <tr><td>{t.dadosFaturas}<br /><span className="small muted">{t.dadosFaturaPor}</span></td>
                    <td className="n">{d.fica.faturas}</td></tr>
                <tr><td>{t.dadosEmissoes}<br /><span className="small muted">{t.dadosEmissaoPor}</span></td>
                    <td className="n">{d.fica.emissoes}</td></tr>
              </tbody>
            </table>
            <p className="small muted">{t.dadosContaPor}</p>

            <h3>{t.dadosPrazos}</h3>
            {/* Os prazos vêm do BANCO, da mesma função que o expurgo lê. Escritos
                aqui, seriam a terceira cópia dos mesmos três números — e a que
                ninguém confere é a que vira mentira. */}
            <ul className="small">
              <li>{preencher(t.dadosPrazoConta, { 0: d.prazos.conta_dias })}</li>
              <li>{preencher(t.dadosPrazoEvento, { 0: d.prazos.evento_meses })}</li>
            </ul>

            {d.total_apagavel === 0
              ? <p className="small muted">{t.dadosNadaPara}</p>
              : <Apagar lang={lang} t={t} acao={apagarMeusDados} />}
          </>
        )}
      </div>
    </Envolver>
  );
}
