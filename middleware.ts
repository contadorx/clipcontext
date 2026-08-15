import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ehHostDoApp, ehHostDoSite, HOST_APP, HOST_SITE, SPLIT_ATIVO } from "@/lib/hosts";

/**
 * Um projeto Vercel, dois sites.
 *
 * `financeirox.com.br` é a página pública; `app.financeirox.com.br` é o
 * produto. Os dois vivem no mesmo deploy, e é o hostname que decide qual
 * responde — não o caminho. Isso mantém as rotas do app como estão (`/carteira`,
 * `/movimentacoes`…), deixa o cookie de sessão fora do domínio público e evita
 * que o SEO do site dispute com as telas do produto.
 *
 * A lista abaixo é de páginas do SITE, não do app — e essa direção importa.
 * Com uma lista do app, toda tela que não estivesse nela viraria 404 no domínio
 * público: `/documentos`, `/relatorios`, `/b/<token>` de boleto, `/convite/…`.
 * São vinte e tantas rotas, e a lista envelheceria a cada tela nova, em
 * silêncio. O site tem quatro páginas e cresce devagar; é ele que cabe numa
 * lista. O que não está aqui é do app, e o pior caso vira um redirecionamento
 * que funciona, não uma página que não existe.
 *
 * Os hostnames e a guarda anti-laço vivem em `lib/hosts.ts`, compartilhados com
 * o layout do site, o robots e o sitemap — quatro leituras da mesma variável que
 * antes divergiam no tratamento.
 */

/**
 * Páginas que existem sob `app/site/`. Ao criar uma página pública nova,
 * acrescente o caminho aqui (e em `app/sitemap.ts`) — sem isso ela só responde
 * no host do app.
 */
const DO_SITE = ["/", "/termos", "/privacidade", "/seguranca"];

/**
 * Tira barra final e barras repetidas, para que `/termos/` e `/termos//` sejam
 * o mesmo caminho que `/termos` — tanto na hora de reconhecer a página quanto
 * na hora de reescrever. Reconhecer sem normalizar a reescrita produzia
 * `/site/termos//`, um 404 vindo justamente do caminho que acabara de ser
 * reconhecido como válido.
 */
function normalizarCaminho(caminho: string): string {
  const limpo = caminho.replace(/\/{2,}/g, "/").replace(/(.)\/+$/, "$1");
  return limpo || "/";
}

function ehPaginaDoSite(caminho: string): boolean {
  return DO_SITE.includes(caminho);
}

/**
 * Redireciona para OUTRO host preservando caminho e query — sem montar URL a
 * partir de string.
 *
 * `new URL("//evil.com", "https://app.financeirox.com.br")` devolve
 * `https://evil.com/`: duas barras no começo do caminho fazem o navegador (e o
 * WHATWG URL) lerem aquilo como host, e a base é descartada. Como o caminho vem
 * do pedido, `financeirox.com.br//evil.com` viraria um redirecionamento aberto
 * saindo do domínio que carrega o cookie de sessão. Clonar `nextUrl` e trocar só
 * o host não tem esse buraco: o caminho continua sendo caminho.
 *
 * 307 e não 308: 308 é permanente e fica gravado no navegador sem forma de
 * revogar. Um domínio ainda não propagado, ou uma página pública nova esquecida
 * em `DO_SITE`, deixaria a pessoa presa num destino errado mesmo depois do
 * conserto. O roteamento é idêntico; o que muda é poder voltar atrás.
 */
function paraHost(request: NextRequest, host: string, caminho: string): NextResponse {
  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.host = host;
  url.port = "";
  url.pathname = caminho;
  return NextResponse.redirect(url, 307);
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const caminho = normalizarCaminho(request.nextUrl.pathname);
  const prefixoInterno = caminho === "/site" || caminho.startsWith("/site/");

  if (SPLIT_ATIVO && ehHostDoSite(host)) {
    /*
      `/site/termos` pedido no domínio público seria a mesma página num segundo
      endereço — e reescrever de novo geraria `/site/site/termos`. Manda para a
      URL limpa, que é a única que deve circular.
    */
    if (prefixoInterno) {
      return paraHost(request, HOST_SITE, caminho.replace(/^\/site/, "") || "/");
    }

    /*
      No domínio público não há sessão para conferir — e conferir custaria uma
      ida ao Supabase em toda visita de quem só está lendo a página.
    */
    if (ehPaginaDoSite(caminho)) {
      // `/site` é o prefixo real das páginas públicas; a URL que a pessoa vê não tem
      const url = request.nextUrl.clone();
      url.pathname = caminho === "/" ? "/site" : `/site${caminho}`;
      return NextResponse.rewrite(url);
    }

    // Qualquer outra coisa no domínio público é tela do produto.
    return paraHost(request, HOST_APP, caminho);
  }

  if (prefixoInterno) {
    /*
      No host do app, `/site/...` existe mas não deve ser indexado nem visitado:
      seria a mesma página em dois endereços. Manda para o endereço público.

      Em localhost e no preview da Vercel, ao contrário, `/site/...` é o ÚNICO
      jeito de abrir a página pública — não há como apontar o hostname. Mandar
      para produção aqui deixaria o site institucional sem forma de revisão antes
      de publicar, que é justamente quando ele precisa ser revisado.
    */
    if (SPLIT_ATIVO && ehHostDoApp(host)) {
      return paraHost(request, HOST_SITE, caminho.replace(/^\/site/, "") || "/");
    }
    return NextResponse.next();
  }

  return comSessao(request);
}

async function comSessao(request: NextRequest) {
  /*
    O caminho pedido, num cabeçalho, para o layout do servidor poder lê-lo.

    Layout de servidor não recebe a rota — e é ele que sabe o papel e as telas
    bloqueadas do colaborador. Sem isso, o bloqueio só existia no navegador
    (`app-shell.tsx`), ou seja: a página era renderizada com os dados dentro,
    entregue, e só depois o React trocava a rota. Quem olhasse a resposta via
    tudo.
  */
  request.headers.set("x-fs-path", request.nextUrl.pathname);
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLogin = path === "/login";
  const isPortal = path.startsWith("/portal");
  const isConvite = path.startsWith("/convite");
  const isRedefinir = path.startsWith("/redefinir-senha");
  // Catálogo visual dos componentes: não lê nem escreve dado, e precisa abrir
  // sem sessão — é a única tela que dá para inspecionar sem credenciais.
  // Fora de desenvolvimento ele não existe (ver app/estilo/page.tsx).
  const isEstilo = path === "/estilo" || path.startsWith("/estilo/");
  /*
    Segunda via de boleto. O link vai por e-mail para o SACADO — o cliente do
    cliente —, que não tem conta aqui e nunca vai ter. Estava caindo na regra
    "sem sessão, manda pro login": quem ia pagar via a tela de login de um
    sistema do qual nunca ouviu falar. O token na URL é a credencial.
  */
  const isBoletoPublico = path === "/b" || path.startsWith("/b/");

  // Portal do cliente, convite, redefinição de senha, 2ª via e catálogo são públicos
  if (isPortal || isConvite || isRedefinir || isEstilo || isBoletoPublico) {
    return response;
  }

  // Sem sessão e fora do login -> manda pro login
  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Com sessão e tentando o login -> manda pro painel
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/carteira";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
      `api/` fora do matcher, e isso conserta um buraco silencioso.

      Toda rota de API já confere sessão por conta própria (`getUser()` no
      handler) ou por segredo (`CRON_SECRET`, assinatura do webhook). Passando
      pelo middleware, porém, uma chamada SEM cookie — que é exatamente o caso do
      webhook do Asaas e dos crons da Vercel — batia em "sem sessão, manda pro
      login" e recebia um 307. Redirecionamento 307 preserva o método: o Asaas
      repostava o corpo em `/login`, recebia 200 com o HTML da tela e marcava a
      notificação como entregue. Baixa de pagamento perdida, log limpo.

      `robots.txt` e `sitemap.xml` pela mesma razão: eram servidos ao robô como
      um 307 para `/login`, e um crawler que recebe HTML no lugar do robots.txt
      conclui que pode indexar tudo.
    */
    "/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
