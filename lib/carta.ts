/* O MOLDE DAS CARTAS — um só, porque já eram três.
 *
 * O produto manda três e-mails: o convite para conhecer a ferramenta
 * (`app/api/convite`), o aviso de chamado respondido (`lib/conta/aviso-chamado`)
 * e o convite de assento (`lib/conta/convite-assento`). Cada um tinha — ou ia
 * ganhar — o seu próprio HTML.
 *
 * Isso é a mesma "listas paralelas" de sempre, com um agravante: em e-mail o
 * defeito é invisível de dentro. Ninguém abre as três cartas no Outlook para
 * comparar; a que ficou sem `role="presentation"` ou sem a cor de fundo só
 * aparece errada na caixa de quem recebe, e essa pessoa não reclama — ela só
 * não clica.
 *
 * Tabela e estilo em linha, e não folha de estilo: cliente de e-mail não lê
 * `<style>`, não lê flex, e o Outlook não lê metade do resto. A marca vai em
 * TEXTO — metade dos clientes bloqueia imagem por padrão, e uma marca que não
 * carrega é pior do que marca nenhuma.
 */

export const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export type Carta = {
  /** A saudação, já com o nome dentro quando há um. */
  ola: string;
  /** Um ou mais parágrafos. Cada item vira um `<p>`. */
  corpo: string[];
  botao: string;
  url: string;
  /** O rodapé em linhas: por que a pessoa recebeu, e o que não vai acontecer. */
  rodape: string[];
};

/** Monta o HTML da carta. O texto puro é responsabilidade de quem chama: ele
 *  não sai daqui derivado do HTML porque uma versão texto gerada por remoção de
 *  tag é a que ninguém revisa e a que fica ruim. */
export function moldeDeCarta(c: Carta): string {
  const paragrafos = c.corpo
    .map((p) => `<p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#5C6473">${esc(p)}</p>`)
    .join('\n        ');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background:#f5f6f9;margin:0;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="max-width:480px;background:#ffffff;border:1px solid #e6e8ee;border-radius:14px">
      <tr><td style="padding:30px 32px 26px">
        <p style="margin:0 0 24px;font-size:23px;font-weight:700;letter-spacing:-.015em;color:#1f2430">
          Walk<span style="color:#3A3F9E">stamp</span></p>
        <p style="margin:0 0 12px;font-size:18px;font-weight:650;color:#1f2430">${esc(c.ola)}</p>
        ${paragrafos}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px">
          <tr><td align="center" bgcolor="#3A3F9E" style="border-radius:9px">
            <a href="${esc(c.url)}" style="display:inline-block;padding:13px 26px;font-size:15.5px;
              font-weight:650;color:#ffffff;text-decoration:none;border-radius:9px">${esc(c.botao)}</a>
          </td></tr>
        </table>
        <p style="margin:0;font-size:13px;line-height:1.55;color:#8A93A3;
          border-top:1px solid #eceef4;padding-top:18px">${c.rodape.map(esc).join('<br>')}</p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}
