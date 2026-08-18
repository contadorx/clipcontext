/* As faturas — uma rota do painel.
 *
 * Ela era a quinta seção de uma página de sete. Quem entra para ver uma
 * fatura entra SÓ para isso, e passava por cima do plano, da chave de licença e
 * do atalho do roteiro para chegar nela.
 */
import { notFound, redirect } from 'next/navigation';
import { ehLang, textos, CAMINHO } from '@/lib/conta/textos';
import { Envolver, carregar } from '../carga';
import { Faturas } from '../secoes';

export const dynamic = 'force-dynamic';

export default async function Pagina({ params }: PageProps<'/conta/[lang]/faturas'>) {
  const { lang } = await params;
  if (!ehLang(lang)) notFound();
  const t = textos(lang);
  const carga = await carregar();
  /* Sem sessão, sem chave ou com o banco mudo, quem sabe explicar é a raiz do
     painel — e ela já explica. Mandar para lá é melhor do que repetir aqui as
     três telas de recusa em cada rota. */
  if (carga.estado !== 'ok') redirect(CAMINHO[lang]);

  return (
    <Envolver lang={lang} t={t} slug="faturas" carga={carga}>
      {/* O título visível é o do próprio bloco, logo abaixo — repetir "Faturas"
          duas vezes seguidas em tamanhos diferentes é ruído. Mas a página
          precisa de um `h1`: sem ele, quem navega por cabeçalhos com leitor de
          tela cai num documento que começa no meio. */}
      <h1 className="soLeitor">{t.navFaturas}</h1>
      <Faturas conta={carga.conta} lang={lang} t={t} />
    </Envolver>
  );
}
