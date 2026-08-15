import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import AppShell from "@/components/app-shell";
import Topbar from "@/components/topbar";
import ImpersonationBanner from "@/components/admin/impersonation-banner";
import SuporteChat from "@/components/suporte/suporte-chat";
import FeedbackTab from "@/components/feedback/feedback-tab";
import ToastProvider from "@/components/ui/toast";
import CommandPalette from "@/components/ui/command-palette";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaContext } from "@/lib/empresa";
import { getPeriodo } from "@/lib/periodo";

/**
 * As únicas rotas do perfil Contabilidade.
 *
 * Mesma lista que `components/app-shell.tsx` usa no navegador. Duplicada de
 * propósito e não importada de lá: `app-shell` é `"use client"`, e a decisão
 * que vale é a do servidor — se as duas divergirem um dia, quem manda é esta.
 */
const ROTAS_CONTABIL = [
  "/configuracoes/contabil",
  "/configuracoes/exportar-contabil",
  "/configuracoes/modelos-plano-contas",
  "/ajuda",
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const caminho = headers().get("x-fs-path") ?? "";
  const dentroDe = (base: string) => caminho === base || caminho.startsWith(base + "/");

  const { empresas, atual } = await getEmpresaContext();
  /*
    Sem empresa ativa quase nada funciona — mas a tela onde se REATIVA uma
    empresa arquivada é `/carteira/gerenciar`, e o redirect mandava ela para o
    onboarding também. O diálogo de arquivar promete "o sistema volta para a
    tela de configuração inicial até você reativar esta"; a rota tornava essa
    promessa impossível: arquivar a última empresa trancava a conta, e o
    onboarding só sabe criar escritório do zero.

    A carteira é a exceção, e é a única que precisa ser.
  */
  if (!atual && !dentroDe("/carteira")) redirect("/onboarding");

  /*
    O erro desta leitura também não pode liberar.

    Sem `esc`, a consulta de `membros` abaixo nem acontece, `leituraFalhou` fica
    falso e a pessoa cai em "membro sem telas bloqueadas" — ou seja, tudo
    liberado. O buraco estava uma consulta acima do que a correção anterior
    fechou.
  */
  const escRes = await supabase.from("escritorios").select("id, nome, logo_url").limit(1).maybeSingle();
  if (escRes.error) console.error("layout: escritório não pôde ser lido", escRes.error.message);
  const esc = escRes.data;

  const periodo = getPeriodo();
  const colapsado = cookies().get("fx_sidebar")?.value === "col";
  const impNome = cookies().get("fx_imp")?.value || null;

  const { data: adminRow } = await supabase
    .from("membros")
    .select("super_admin")
    .eq("user_id", user.id)
    .eq("super_admin", true)
    .maybeSingle();
  const admin = Boolean(adminRow);

  /*
    `esc?.id ?? ""` mandava string vazia para uma coluna `uuid` — erro garantido
    (`22P02`) sempre que `esc` fosse null. E o erro era descartado, o que fazia
    o papel cair para "membro" e as telas bloqueadas para nenhuma: falha de
    leitura LIBERAVA tudo, o oposto da regra do projeto.
  */
  const membro = esc?.id
    ? await supabase
        .from("membros")
        .select("papel, menus_bloqueados")
        .eq("user_id", user.id)
        .eq("escritorio_id", esc.id)
        .maybeSingle()
    : null;
  const leituraFalhou = Boolean(escRes.error || membro?.error || !esc?.id);
  if (membro?.error) console.error("layout: papel do membro não pôde ser lido", membro.error.message);
  const papel = (membro?.data?.papel as string) ?? "membro";
  const menusBloqueados = (membro?.data?.menus_bloqueados as string[]) ?? [];

  /*
    Bloqueio de tela decidido AQUI, antes de renderizar.

    `menus_bloqueados` e o perfil `contabilidade` só existiam no navegador:
    `app-shell.tsx` fazia `router.replace` num `useEffect`. Isso é aparência de
    permissão — a página do servidor já tinha rodado, consultado o banco e
    mandado o HTML com os dados dentro; o redirect só trocava o que a pessoa
    via. Quem abrisse a URL e olhasse a resposta enxergava tudo.

    Continua sendo defesa em profundidade, não a única: RLS é quem impede a
    leitura de dado de outra empresa. O que isto fecha é a tela que o dono do
    escritório escolheu esconder de um colaborador.
  */
  /*
    Ordem e exclusões, para não trancar ninguém num laço.

    Duas armadilhas que a primeira versão tinha:

    - `contabilidade` é uma lista branca curta, e `/configuracoes` está entre as
      telas bloqueáveis. Dono zeloso bloqueia "Configurações" para o contador →
      a rota contábil é bloqueada → manda para `/carteira` → que não é rota
      contábil → manda para a rota contábil → `ERR_TOO_MANY_REDIRECTS`. Para
      esse papel a lista branca já é o bloqueio; `menus_bloqueados` não se
      aplica.
    - `/carteira` é o destino de todo bloqueio, então bloqueá-la fecha a saída.
      A tela de colaboradores não a oferece, mas `definir_menus` é chamada do
      navegador com o array que o cliente mandar.
  */
  const bloqueados = menusBloqueados.filter((m) => m && m !== "/carteira" && !"/carteira".startsWith(m + "/"));
  if (papel === "contabilidade") {
    if (!ROTAS_CONTABIL.some(dentroDe)) redirect("/configuracoes/exportar-contabil");
  } else if (bloqueados.some((m) => dentroDe(m)) || (leituraFalhou && !dentroDe("/carteira"))) {
    // leitura falhou = não sei quais telas esta pessoa pode ver. "Não sei"
    // fecha a porta: sobra a Carteira, que nunca é bloqueável.
    redirect("/carteira");
  }

  let docsNovos = 0;
  {
    const ids = (empresas ?? []).map((e) => e.id);
    if (ids.length > 0) {
      const { count } = await supabase
        .from("documentos_recebidos")
        .select("id", { count: "exact", head: true })
        .in("empresa_id", ids)
        .eq("status", "novo");
      docsNovos = count ?? 0;
    }
  }

  return (
    <ToastProvider>
      <div className="min-h-screen">
        {impNome && <ImpersonationBanner nome={impNome} />}
        <AppShell
        colapsadoInicial={colapsado}
        logoUrl={esc?.logo_url ?? null}
        admin={admin}
        papel={papel}
        /*
          O MESMO recorte que o servidor aplicou.

          Passar a lista crua deixava `app-shell.tsx` com a regra antiga — sem
          isentar `contabilidade` e sem tirar `/carteira` — e as duas camadas
          discordavam: o servidor mandava para a rota contábil, o cliente
          mandava de volta para a carteira, e a tela ficava batendo entre as
          duas.
        */
        menusBloqueados={papel === "contabilidade" ? [] : bloqueados}
        docsNovos={docsNovos}
        topbar={
          <Topbar
            empresas={empresas}
            atualId={atual?.id ?? ""}
            userEmail={user.email ?? ""}
            periodoPreset={periodo.preset}
            periodoLabel={periodo.label}
            escritorioNome={esc?.nome ?? ""}
            logoUrl={esc?.logo_url ?? null}
            papel={papel}
          />
        }
        >
          {children}
        </AppShell>
        {atual && <CommandPalette empresaId={atual.id} />}
        <SuporteChat />
        <FeedbackTab escritorioId={esc?.id ?? ""} />
      </div>
    </ToastProvider>
  );
}
