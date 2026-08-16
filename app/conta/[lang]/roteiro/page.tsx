/* A tela de controle do roteiro de casos.
 *
 * Ela é separada da ferramenta de propósito. A ferramenta é de quem EXECUTA:
 * grava, revisa, baixa. O roteiro é de quem ORGANIZA — e as duas coisas quase
 * nunca acontecem na mesma hora, muitas vezes nem na mesma pessoa. Enfiar a
 * fila dentro do `/app` obrigava quem só ia gravar um vídeo a passar por um
 * bloco que não é dele.
 *
 * O que liga as duas é um LINK: a tela entrega um endereço com o caso já
 * dentro. Quem executa clica, grava, baixa — e volta com um clique que marca o
 * caso como feito. A ferramenta não precisou saber o que é um roteiro.
 *
 * O que esta tela guarda, e o que ela deliberadamente não guarda:
 *
 *   guarda      o caso, o título, o sistema, o chamado, o responsável,
 *               a data, o nome do arquivo e a impressão digital dele
 *   não guarda  o vídeo, os quadros, a transcrição, o documento
 */
import { notFound } from 'next/navigation';
import { emailDaSessao } from '@/lib/supabase/servidor';
import { type Conta, contaDe, temChaveDeServico } from '@/lib/supabase/servico';
import { type Lang, type Textos, CAMINHO, ehLang, preencher, textos } from '@/lib/conta/textos';
import { type Caso, type Resumo, type Roteiro, CAMINHO_ROTEIRO, linkDoCaso, meusRoteiros, verRoteiro } from '@/lib/conta/roteiro';
import { apagarRoteiro, atribuirCaso, marcarFeito } from '../../roteiro-acoes';
import Importar from './Importar';
import Copiar from './Copiar';

export const dynamic = 'force-dynamic';

const LOCALE: Record<Lang, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
const quando = (lang: Lang, iso: string | null) =>
  iso ? new Intl.DateTimeFormat(LOCALE[lang], { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : '—';

export default async function Pagina({ params, searchParams }: PageProps<'/conta/[lang]/roteiro'>) {
  const { lang } = await params;
  if (!ehLang(lang)) notFound();
  const t = textos(lang);
  const q = await searchParams;
  const um = (n: string) => (typeof q[n] === 'string' ? (q[n] as string) : null);
  const email = await emailDaSessao();

  return (
    <section style={{ paddingTop: 40 }}>
      <div className="wrap" style={{ maxWidth: 900 }}>
        <p className="small"><a href={CAMINHO[lang]}>← {t.titulo}</a></p>
        <h1>{t.rotTitulo}</h1>
        {um('erro') && <p className="aviso err">{um('erro')}</p>}
        {um('feito') && <p className="aviso ok">{um('feito')}</p>}
        {!email
          ? <NaoEntrou lang={lang} t={t} />
          : !temChaveDeServico
            ? <p className="aviso err">{t.erroSemChave} <code>SUPABASE_SERVICE_ROLE_KEY</code></p>
            : <Tela email={email} lang={lang} t={t}
                    id={Number(um('id')) || null}
                    marcar={Number(um('marcar')) || null}
                    arq={um('arq')} imp={um('imp')} />}
      </div>
    </section>
  );
}

const NaoEntrou = ({ lang, t }: { lang: Lang; t: Textos }) => (
  <>
    <p className="lead">{t.rotEntreLead}</p>
    <p><a className="btn" href={CAMINHO[lang]}>{t.entrarBotao}</a></p>
  </>
);

/* ------------------------------------------------------------------- tela */

async function Tela(
  { email, lang, t, id, marcar, arq, imp }:
  { email: string; lang: Lang; t: Textos; id: number | null; marcar: number | null; arq: string | null; imp: string | null },
) {
  let conta: Conta;
  try {
    conta = await contaDe(email);
  } catch (e) {
    return (
      <>
        <p className="aviso err">{t.erroLeitura}</p>
        <p className="small muted">{String(e).slice(0, 200)}</p>
      </>
    );
  }

  /* A trava do plano é uma PORTA, não um muro: a tela existe, diz o que o
     recurso faz e onde ele mora. Tela em branco com um cadeado é
     indistinguível de defeito. */
  if (!conta.plano || conta.motivo === 'suspensa') {
    return (
      <>
        <p className="lead">{t.rotVendaLead}</p>
        <ul>
          {[t.rotVenda1, t.rotVenda2, t.rotVenda3].map((l) => <li key={l}>{l}</li>)}
        </ul>
        <p><a className="btn" href={lang === 'pt' ? '/precos' : `/${lang}/${lang === 'en' ? 'pricing' : 'precios'}`}>
          {t.rotVerPlanos}
        </a></p>
      </>
    );
  }

  const ehAdmin = conta.papel === 'admin' && Boolean(conta.time);
  const pessoas = (conta.time?.pessoas || []).filter((p) => p.ativo).map((p) => p.email);

  let lista: Resumo[] = [];
  try {
    lista = (await meusRoteiros(email)).roteiros || [];
  } catch { /* a lista vazia já diz o suficiente; o erro real aparece ao salvar */ }

  const escolhido = id ?? lista[0]?.id ?? null;
  let atual: Roteiro | null = null;
  if (escolhido) {
    try {
      const r = await verRoteiro(email, escolhido);
      if (!r?.erro) atual = r;
    } catch { /* idem */ }
  }

  return (
    <>
      {/* A volta da ferramenta: o caso foi executado, o documento baixou, e o
          link de retorno trouxe o nome do arquivo e a impressão das telas.
          Marcar é um POST, e não o próprio link — endereço que muda dado é
          endereço que o histórico do navegador reexecuta sozinho. */}
      {marcar && <Voltando lang={lang} t={t} casoId={marcar} arq={arq} imp={imp} />}

      <Listas lista={lista} escolhido={escolhido} lang={lang} t={t} />
      {atual && <Detalhe r={atual} email={email} lang={lang} t={t} ehAdmin={ehAdmin} pessoas={pessoas} />}
      <Importar lang={lang} t={t} podeTime={ehAdmin} />
      <p className="small muted">{t.rotPrivacidade}</p>
    </>
  );
}

function Voltando(
  { lang, t, casoId, arq, imp }:
  { lang: Lang; t: Textos; casoId: number; arq: string | null; imp: string | null },
) {
  return (
    <div className="card" style={{ marginBottom: 24, borderColor: 'var(--brand, #3b5bdb)' }}>
      <h2 style={{ marginTop: 0 }}>{t.rotVoltandoTitulo}</h2>
      <p className="small muted" style={{ marginTop: 0 }}>
        {arq ? preencher(t.rotVoltandoArq, { arquivo: arq }) : t.rotVoltandoSemArq}
        {imp ? ` · ${t.rotImpressao} ${imp}` : ''}
      </p>
      <form action={marcarFeito} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="caso_id" value={casoId} />
        <input type="hidden" name="arquivo" value={arq || ''} />
        <input type="hidden" name="impressao" value={imp || ''} />
        <input name="observacao" placeholder={t.rotObservacaoPlaceholder}
               aria-label={t.rotObservacao} style={{ minWidth: 240 }} />
        <button className="btn" type="submit">{t.rotMarcarBotao}</button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------ personal vs time */

function Listas({ lista, escolhido, lang, t }: { lista: Resumo[]; escolhido: number | null; lang: Lang; t: Textos }) {
  /* Os dois grupos são separados na tela porque são duas coisas diferentes, e
     misturá-las é o que fazia ninguém saber quem enxerga o quê: um roteiro
     "só meu" não aparece para o time, e um "do time" aparece para todo mundo
     que tem assento. Ver os dois numa lista só é ver a mesma linha significar
     duas coisas. */
  const meus = lista.filter((r) => r.escopo === 'personal');
  const time = lista.filter((r) => r.escopo === 'time');
  if (!lista.length) {
    return <p className="lead" style={{ marginBottom: 24 }}>{t.rotVazio}</p>;
  }
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <Grupo tit={t.rotGrupoMeus} sub={t.rotGrupoMeusSub} itens={meus} escolhido={escolhido} lang={lang} t={t} />
      <Grupo tit={t.rotGrupoTime} sub={t.rotGrupoTimeSub} itens={time} escolhido={escolhido} lang={lang} t={t} />
    </div>
  );
}

function Grupo(
  { tit, sub, itens, escolhido, lang, t }:
  { tit: string; sub: string; itens: Resumo[]; escolhido: number | null; lang: Lang; t: Textos },
) {
  if (!itens.length) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ margin: '0 0 2px', fontSize: 19 }}>{tit}</h2>
      <p className="small muted" style={{ margin: '0 0 8px' }}>{sub}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {itens.map((r) => (
          <li key={r.id} style={{
            padding: '7px 10px', borderRadius: 8,
            background: r.id === escolhido ? 'var(--panel, #f4f4f8)' : undefined,
            display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline',
          }}>
            <a href={`${CAMINHO_ROTEIRO[lang]}?id=${r.id}`}><b>{r.nome}</b></a>
            <span className="small muted">
              {preencher(t.rotContagem, { feitos: r.feitos, total: r.total })}
              {r.escopo === 'time' && r.meus > 0 ? ` · ${preencher(t.rotSeus, { quantos: r.meus })}` : ''}
              {!r.meu ? ` · ${preencher(t.rotDe, { dono: r.dono })}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------------- detalhe */

function Detalhe(
  { r, email, lang, t, ehAdmin, pessoas }:
  { r: Roteiro; email: string; lang: Lang; t: Textos; ehAdmin: boolean; pessoas: string[] },
) {
  const feitos = r.casos.filter((c) => c.feito_em).length;
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{r.nome}</h2>
        <span className="small muted">
          {r.escopo === 'time' ? t.rotEscopoTime : t.rotEscopoPersonal}
          {' · '}{preencher(t.rotContagem, { feitos, total: r.casos.length })}
        </span>
      </div>

      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        {/* As larguras são declaradas. Sem elas o navegador dá à coluna do caso a
            sobra do que os botões não usaram, e "Emitir a segunda via da fatura"
            — que é o texto que a pessoa lê para saber o que fazer — quebra em
            três linhas ao lado de espaço vazio. */}
        <table className="legal" style={{ tableLayout: 'fixed', minWidth: 720 }}>
          <colgroup>
            <col style={{ width: r.escopo === 'time' ? '32%' : '46%' }} />
            {r.escopo === 'time' && <col style={{ width: '22%' }} />}
            <col style={{ width: r.escopo === 'time' ? '22%' : '30%' }} />
            <col style={{ width: '24%' }} />
          </colgroup>
          <thead><tr>
            <th>{t.rotCampoCaso}</th>
            {r.escopo === 'time' && <th>{t.rotCampoResponsavel}</th>}
            <th>{t.rotColSit}</th>
            <th style={{ textAlign: 'right' }}>{t.rotAcoes}</th>
          </tr></thead>
          <tbody>
            {r.casos.map((c) => (
              <Linha key={c.id} c={c} r={r} email={email} lang={lang} t={t}
                     ehAdmin={ehAdmin} pessoas={pessoas} />
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
        <a className="btn ghost" href={`/conta/planilha?id=${r.id}&lang=${lang}`}>{t.rotBaixarPlanilha}</a>
        {/* Apagar é do dono, e o botão só existe para ele: oferecer e recusar
            depois é ensinar que os botões daqui mentem. */}
        {r.meu && (
          <form action={apagarRoteiro}>
            <input type="hidden" name="lang" value={lang} />
            <input type="hidden" name="id" value={r.id} />
            <button className="btn ghost" type="submit">{t.rotApagarBotao}</button>
          </form>
        )}
      </div>
    </div>
  );
}

/* Uma linha do roteiro.
 *
 * A tabela é `table-layout: fixed`, e isso muda a regra de quem não cabe: em
 * vez de empurrar a coluna, o que sobra VAZA por cima da vizinha. Foi assim que
 * o botão "Atribuir" apareceu escrito em cima da data de execução do caso ao
 * lado. Por isso tudo aqui dentro quebra linha em vez de esticar. */
function Linha(
  { c, r, email, lang, t, ehAdmin, pessoas }:
  { c: Caso; r: Roteiro; email: string; lang: Lang; t: Textos; ehAdmin: boolean; pessoas: string[] },
) {
  const meu = (c.responsavel || '').toLowerCase() === email;
  return (
    <tr style={meu && r.escopo === 'time' ? { background: 'var(--panel, #f4f4f8)' } : undefined}>
      <td>
        <b>{c.caso}</b>
        {c.titulo && <div className="small muted">{c.titulo}</div>}
        {(c.sistema || c.chamado) && (
          <div className="small muted">{[c.sistema, c.chamado].filter(Boolean).join(' · ')}</div>
        )}
      </td>

      {r.escopo === 'time' && (
        <td>
          {ehAdmin ? (
            <form action={atribuirCaso}
                  style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="hidden" name="lang" value={lang} />
              <input type="hidden" name="caso_id" value={c.id} />
              <select name="para" defaultValue={c.responsavel || ''}
                      style={{ padding: '3px 6px', fontSize: 12.5, width: '100%', minWidth: 0 }}>
                <option value="">{t.rotSemResponsavel}</option>
                {pessoas.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <button className="btn ghost" type="submit" style={{ padding: '3px 9px', fontSize: 12.5 }}>
                {t.rotAtribuirBotao}
              </button>
            </form>
          ) : (
            <span className="small">{c.responsavel || <span className="muted">{t.rotSemResponsavel}</span>}</span>
          )}
        </td>
      )}

      <td>
        {c.feito_em ? (
          <span style={{ color: 'var(--ok, #1f9d55)' }}>
            <span style={{ whiteSpace: 'nowrap' }}>✓ {quando(lang, c.feito_em)}</span>
            {c.feito_por && c.feito_por.toLowerCase() !== email && <div className="small muted">{c.feito_por}</div>}
            {c.arquivo && <div className="small muted" style={{ wordBreak: 'break-all' }}>{c.arquivo}</div>}
            {c.impressao && <div className="small muted" style={{ wordBreak: 'break-all' }}>{t.rotImpressao} {c.impressao}</div>}
          </span>
        ) : <span className="muted">—</span>}
      </td>

      <td style={{ textAlign: 'right' }}>
        <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!c.feito_em && (
            <Copiar href={linkDoCaso(c, lang)} abrir={t.rotAbrirCaso}
                    copiar={t.rotCopiar} copiado={t.rotCopiado} />
          )}
          <form action={marcarFeito}>
            <input type="hidden" name="lang" value={lang} />
            <input type="hidden" name="caso_id" value={c.id} />
            <input type="hidden" name="desfazer" value={c.feito_em ? '1' : '0'} />
            <button className="btn ghost" type="submit" style={{ padding: '3px 9px', fontSize: 12.5 }}>
              {c.feito_em ? t.rotDesfazerBotao : t.rotFeitoBotao}
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}
