/* O botão que apaga, com a gaveta de confirmação.
 *
 * Ele nasce FECHADO. Um botão de apagar sempre visível ao lado da lista é um
 * clique errado esperando acontecer, e este é o único botão do produto sem
 * desfazer. Abrir a gaveta é o primeiro gesto; digitar o próprio e-mail é o
 * segundo; e quem confere os dois é o BANCO, não esta tela.
 *
 * ---- POR QUE ISTO NÃO É UM COMPONENTE DE CLIENTE ----
 *
 * A primeira versão era: `'use client'`, um `useState` com o texto digitado, e
 * o botão `disabled` enquanto a confirmação estivesse vazia. Parecia uma
 * comodidade. Era uma TRAVA — e a régua mediu: sem hidratação, o botão nasce
 * `disabled` no HTML do servidor e nunca deixa de ser. Quem estivesse com o
 * JavaScript desligado, ou atrás de uma CSP que barra o script de arranque,
 * abriria a gaveta, digitaria o e-mail e clicaria num botão morto — sem
 * nenhuma mensagem dizendo por quê.
 *
 * Num botão de apagar isso é o pior desenho possível: a pessoa que veio exercer
 * o direito de apagar os próprios dados sai achando que exerceu.
 *
 * O que segura o campo vazio agora é o `required` do próprio navegador, que não
 * depende de script nenhum, e o banco, que compara a confirmação com o e-mail
 * da sessão e recusa. Duas travas, nenhuma delas em JavaScript.
 *
 * O `<details>` é a gaveta, e a classe é `apagarDados` e NÃO `sub`: `details.sub`
 * é a convenção da ferramenta, e o `_navegador.mjs` da régua abre todo
 * `details.sub` antes de a página carregar — a gaveta que precisa nascer
 * fechada nasceria aberta para quem a mede.
 */
import type { Lang, Textos } from '@/lib/conta/textos';

export default function Apagar({
  lang, t, acao,
}: {
  lang: Lang; t: Textos;
  acao: (form: FormData) => Promise<void>;
}) {
  return (
    <details className="apagarDados">
      <summary>{t.dadosBotao}</summary>
      <form action={acao} style={{ marginTop: 12 }}>
        <input type="hidden" name="lang" value={lang} />
        <p className="small" style={{ marginTop: 0 }}><b>{t.dadosAviso}</b></p>

        <label className="small" htmlFor="confirmacao">{t.dadosConfirmeLabel}</label>
        <input id="confirmacao" name="confirmacao" type="email" required
               autoComplete="off" spellCheck={false}
               style={{ minWidth: 260, display: 'block', marginBottom: 12 }} />

        <button type="submit" className="btn perigo">{t.dadosConfirmar}</button>
      </form>
    </details>
  );
}
