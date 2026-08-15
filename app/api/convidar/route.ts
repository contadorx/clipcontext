import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enviarEmail, layoutEmail } from "@/lib/brevo";

/**
 * Papéis que esta rota aceita convidar.
 *
 * A rota passava `papel` direto para o RPC, sem lista e sem olhar quem estava
 * chamando. A tela oferece três opções, mas quem montasse a requisição à mão
 * mandava qualquer string — inclusive `owner`. "A tela esconde o botão e a rota
 * aceita a chamada" não é permissão, é decoração.
 *
 * `owner` fica de fora de propósito: dono é quem criou o escritório, não se
 * convida outro por e-mail.
 */
const PAPEIS_CONVIDAVEIS = new Set(["admin", "analista", "contabilidade"]);
/** Quem pode convidar. Analista e contabilidade não montam equipe. */
const PODE_CONVIDAR = new Set(["owner", "admin"]);

export async function POST(req: Request) {
  try {
    const { email, papel, empresas } = await req.json();
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
    }
    const papelPedido = typeof papel === "string" && papel ? papel : "analista";
    if (!PAPEIS_CONVIDAVEIS.has(papelPedido)) {
      return NextResponse.json({ error: "Papel inválido para convite." }, { status: 400 });
    }

    const supabase = createClient();
    /*
      Quem chama também é conferido. Sem `auth.getUser()` esta rota nem sabia se
      havia alguém logado — as outras rotas de portal já conferiam, esta não.
    */
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    /*
      Sem `maybeSingle()`: quem é membro de mais de um escritório tem mais de uma
      linha, e `maybeSingle()` transformaria isso em erro — barrando um dono
      legítimo. O que interessa é se ELE é dono ou administrador em algum lugar,
      e qual escritório é esse, porque as empresas do convite precisam ser de lá.
    */
    const membro = await supabase.from("membros").select("papel, escritorio_id").eq("user_id", user.id);
    if (membro.error) return NextResponse.json({ error: membro.error.message }, { status: 400 });
    const linhas = (membro.data ?? []) as { papel: string; escritorio_id: string }[];
    const gestoras = linhas.filter((l) => PODE_CONVIDAR.has(l.papel));
    if (gestoras.length === 0) {
      return NextResponse.json({ error: "Só o dono ou um administrador pode convidar." }, { status: 403 });
    }
    /*
      Quem gere mais de um escritório não pode ter um escolhido no sorteio.

      Pegar a primeira linha que voltasse do banco escolhia um escritório
      arbitrário — e a tela de colaboradores lista as empresas dos dois juntas,
      então o convite dava 403 dizendo "não são deste escritório" sem dizer qual
      escritório valia. Entre owner e admin, owner ganha; o resto é decidido
      pelas empresas escolhidas, que sabem a que escritório pertencem.
    */
    const gestora = gestoras.find((l) => l.papel === "owner") ?? gestoras[0];

    /*
      As empresas do convite também vêm do navegador.

      A rodada validou o papel e passou `empresas` cru para o mesmo RPC — a
      mesma assimetria de antes, só que uma casa adiante: um administrador do
      escritório A podia montar a requisição à mão com ids de empresas do
      escritório B e liberar a carteira de outro cliente para um analista dele.
    */
    const pedidas = Array.isArray(empresas) ? empresas.filter((e): e is string => typeof e === "string") : [];
    let empresasOk: string[] = [];
    if (pedidas.length > 0) {
      // qualquer escritório que ESTA pessoa gere serve; o que não pode é empresa
      // de fora de todos eles
      const conf = await supabase
        .from("empresas")
        .select("id, escritorio_id")
        .in("escritorio_id", gestoras.map((g) => g.escritorio_id))
        .in("id", pedidas);
      if (conf.error) return NextResponse.json({ error: conf.error.message }, { status: 400 });
      const achadas = (conf.data ?? []) as { id: string; escritorio_id: string }[];
      empresasOk = achadas.map((e) => e.id);
      if (empresasOk.length !== pedidas.length) {
        return NextResponse.json(
          { error: "Uma ou mais empresas escolhidas não são de um escritório que você administra." },
          { status: 403 },
        );
      }
      const escritorios = new Set(achadas.map((e) => e.escritorio_id));
      if (escritorios.size > 1) {
        return NextResponse.json(
          { error: "As empresas escolhidas são de escritórios diferentes. Faça um convite por escritório." },
          { status: 400 },
        );
      }
    }

    const { data: token, error } = await supabase.rpc("criar_convite", {
      p_papel: papelPedido,
      p_empresas: papelPedido === "analista" || papelPedido === "contabilidade" ? empresasOk : [],
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const origin = new URL(req.url).origin;
    const link = `${origin}/convite/${token}`;

    const papelTxt =
      papelPedido === "admin"
        ? "administrador (acesso total)"
        : papelPedido === "contabilidade"
          ? "contabilidade (só configuração e exportação contábil das empresas liberadas)"
          : "analista (acesso às empresas liberadas)";
    const html = layoutEmail({
      titulo: "Você foi convidado para uma equipe",
      corpoHtml: `Você recebeu um convite para acessar o <b>FinanceiroX</b> como <b>${papelTxt}</b>.<br><br>
        Clique no botão abaixo para criar sua conta (ou entrar) e aceitar o convite.`,
      botao: { texto: "Aceitar convite", url: link },
    });

    await enviarEmail({ para: email, assunto: "Convite — FinanceiroX", html });

    return NextResponse.json({ ok: true, link });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao enviar o convite.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
