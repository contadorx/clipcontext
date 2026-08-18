/* O time — uma rota do painel.
 *
 * Assentos, modelos e emissões. Era a última seção da página mais longa do
 * produto, e por isso quem administra um domínio não descobria que podia
 * bloquear um acesso — a função existia e ficava atrás de tudo.
 */
import { notFound, redirect } from 'next/navigation';
import { ehLang, textos, CAMINHO } from '@/lib/conta/textos';
import { Envolver, carregar } from '../carga';
import { Time } from '../secoes';

export const dynamic = 'force-dynamic';

export default async function Pagina({ params }: PageProps<'/conta/[lang]/time'>) {
  const { lang } = await params;
  if (!ehLang(lang)) notFound();
  const t = textos(lang);
  const carga = await carregar();
  /* Sem sessão, sem chave ou com o banco mudo, quem sabe explicar é a raiz do
     painel — e ela já explica. Mandar para lá é melhor do que repetir aqui as
     três telas de recusa em cada rota. */
  if (carga.estado !== 'ok') redirect(CAMINHO[lang]);
  /* Sem time, esta rota não existe: o menu nem a mostra, e quem chegar pelo
     endereço direto vai para o início em vez de ver uma tela vazia. */
  if (!carga.tem.time || !carga.conta.time) redirect(CAMINHO[lang]);

  return (
    <Envolver lang={lang} t={t} slug="time" carga={carga}>
      {/* O título visível é o do próprio bloco, logo abaixo — repetir "Faturas"
          duas vezes seguidas em tamanhos diferentes é ruído. Mas a página
          precisa de um `h1`: sem ele, quem navega por cabeçalhos com leitor de
          tela cai num documento que começa no meio. */}
      <h1 className="soLeitor">{t.navTime}</h1>
      <Time conta={carga.conta} lang={lang} t={t} />
    </Envolver>
  );
}
