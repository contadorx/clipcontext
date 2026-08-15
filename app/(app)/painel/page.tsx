import { redirect } from "next/navigation";

/**
 * O Painel morreu, e isto é a lápide.
 *
 * Ele e o Início respondiam a mesma pergunta — "o que precisa de mim hoje" — de
 * dois jeitos, e não havia resposta para "isso eu vejo em qual das duas?". O
 * Início virou launchpad em três grupos e absorveu a parte de decisão; o
 * analítico virou tile de relatório.
 *
 * O redirecionamento fica porque `/painel` está em favorito de gente, em link
 * de e-mail e em tile antigo. Uma tela que some sem deixar caminho transforma
 * cada atalho salvo em erro 404.
 */
export default function PainelPage() {
  redirect("/inicio");
}
