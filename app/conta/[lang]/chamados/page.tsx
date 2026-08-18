/* Os chamados — uma rota do painel.
 *
 * Abrir um chamado é o que se faz quando algo deu errado — e era a sexta
 * seção da página. Alguém com um problema não rola sete blocos para achar onde
 * contar o problema: manda um e-mail e a gente perde o registro.
 */
import { notFound, redirect } from 'next/navigation';
import { ehLang, textos, CAMINHO } from '@/lib/conta/textos';
import { Envolver, carregar } from '../carga';
import { Chamados } from '../secoes';

export const dynamic = 'force-dynamic';

export default async function Pagina({ params }: PageProps<'/conta/[lang]/chamados'>) {
  const { lang } = await params;
  if (!ehLang(lang)) notFound();
  const t = textos(lang);
  const carga = await carregar();
  /* Sem sessão, sem chave ou com o banco mudo, quem sabe explicar é a raiz do
     painel — e ela já explica. Mandar para lá é melhor do que repetir aqui as
     três telas de recusa em cada rota. */
  if (carga.estado !== 'ok') redirect(CAMINHO[lang]);

  return (
    <Envolver lang={lang} t={t} slug="chamados" carga={carga}>
      {/* O título visível é o do próprio bloco, logo abaixo — repetir "Faturas"
          duas vezes seguidas em tamanhos diferentes é ruído. Mas a página
          precisa de um `h1`: sem ele, quem navega por cabeçalhos com leitor de
          tela cai num documento que começa no meio. */}
      <h1 className="soLeitor">{t.navChamados}</h1>
      <Chamados conta={carga.conta} lang={lang} t={t} />
    </Envolver>
  );
}
