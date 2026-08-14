#!/usr/bin/env python3
"""
Gera os dois builds a partir de src/template.html.

  public/app.html                   -> a ferramenta, com jsPDF vindo do CDN
  offline/walkstamp-offline.html  -> jsPDF embutido, arquivo único, funciona sem internet

Edite sempre src/template.html. Os arquivos gerados são descartáveis.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).parent
MARKER = "<script>/*__JSPDF__*/</script>"
CDN = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js"

# Nome de exibição da marca. Trocar de nome é trocar ESTA linha e o SITE abaixo.
# Antes disto ele estava escrito à mão em 46 lugares, em três idiomas — o tipo de
# coisa que faz uma decisão de dez minutos virar uma tarde de caça.
MARCA = "Walkstamp"
# O logotipo escreve a marca em duas metades, a segunda em destaque.
MARCA_A, MARCA_B = "Walk", "stamp"

# Endereço público do site, sem barra no fim. Sai daqui para o canonical, para os
# hreflang e para o link do topo da ferramenta — trocar de domínio é mudar esta linha.
SITE = "https://walkstamp.com"

# Versão dos ícones. O navegador guarda favicon com unhas e dentes: sem um
# parâmetro que mude, quem já visitou o site continua vendo o ícone antigo
# mesmo depois do deploy. Suba este número sempre que a marca mudar.
ICON_V = "3"

# ---------------------------------------------------------------------------
# Medição. São duas coisas separadas, de propósito:
#
#   Vercel Web Analytics  -> quantas pessoas chegaram e de onde. Só visitas de
#                            página, sem cookie e sem identificador persistente.
#                            Eventos personalizados são recurso de plano pago,
#                            então o funil NÃO passa por aqui.
#   Supabase              -> os três marcos do funil e a lista de aviso. Chama
#                            duas funções que só sabem inserir; as tabelas ficam
#                            num schema fora da API e ninguém as lê pelo cliente.
#
# Nada disso entra no build offline: os tokens abaixo viram string vazia lá, e o
# código sai junto. O arquivo único continua sendo um arquivo que não fala com
# ninguém — e isso é verificável abrindo ele e procurando por "supabase".
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Identificação legal. Sai daqui para os Termos e para a Política de Privacidade
# nos três idiomas — a LGPD exige que o controlador esteja identificado, e um
# CNPJ digitado em nove lugares vira nove chances de digitar errado.
#
# ATENÇÃO: o endereço abaixo precisa RECEBER e-mail de verdade. Publicar canal de
# titular que não responde é pior que não publicar — o prazo do art. 19 corre do
# mesmo jeito. Se preferir usar outro, é esta linha.
# ---------------------------------------------------------------------------
EMPRESA = "Produtize Produtos e Serviços Inteligentes Ltda."
CNPJ    = "48.417.292/0001-99"
CONTATO = "privacidade@walkstamp.com"

SUPA_URL = "https://zyqncemxjobkvdveordz.supabase.co"
SUPA_KEY = "sb_publishable_HQDSfL4rTtPx2wwbgh_huw_llog8ZJk"

# Snippet oficial do Vercel para site em HTML puro. O `window.va` enfileira
# chamadas feitas antes do script chegar; o script cuida do resto.
ANALYTICS = (
    '<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};</script>'
    '<script defer src="/_vercel/insights/script.js"></script>'
)

META = f"""<title>{MARCA} — transforme vídeo em contexto para IA</title>
<meta name="description" content="Transforme qualquer vídeo em um PDF com os frames que importam e a transcrição sincronizada, pronto para colar em uma IA. Roda no seu navegador: o vídeo não sai do seu computador.">
<meta property="og:type" content="website">
<meta property="og:title" content="{MARCA} — transforme vídeo em contexto para IA">
<meta property="og:description" content="Frames por mudança de cena + transcrição sincronizada, em um PDF único. Nada é enviado para servidor nenhum.">
<meta name="twitter:card" content="summary_large_image">"""

PLAIN_TITLE = "<title>Vídeo → PDF (frames + transcrição)</title>"


# ---------------------------------------------------------------------------
# Páginas do site em pt / en / es, geradas do dicionário src/i18n-site.json.
# Arquivos separados por idioma (e não tradução no navegador) porque só assim
# o buscador indexa cada versão.
# ---------------------------------------------------------------------------

IDIOMAS = ["pt", "en", "es"]
NOMES = {"pt": "Português", "en": "English", "es": "Español"}

REDIRECT = """<script>
/* Detecção automática de idioma, só na home em português e só quando não há
   escolha explícita (?lang=). O seletor no topo sempre permite trocar. */
(function(){
  try{
    if (new URLSearchParams(location.search).has('lang')) return;
    var n = (navigator.language || '').slice(0,2).toLowerCase();
    if (n === 'en') location.replace('/en');
    else if (n === 'es') location.replace('/es');
  }catch(e){}
})();
</script>"""


# O endereço de cada página interna, por idioma. Só as páginas de conteúdo têm
# endereço traduzido: é nelas que o buscador procura pelas palavras que a pessoa
# digita, e "/en/substituto-do-steps-recorder" não seria encontrado por ninguém.
# As páginas legais mantêm o mesmo caminho nos três idiomas, porque quem chega
# nelas chega por link, não por busca.
SLUGS = {
    "precos":      {"pt": "precos",      "en": "precos",      "es": "precos"},
    "privacidade": {"pt": "privacidade", "en": "privacidade", "es": "privacidade"},
    "termos":      {"pt": "termos",      "en": "termos",      "es": "termos"},
    "seguranca":   {"pt": "seguranca",   "en": "security",    "es": "seguridad"},
    "comparativo": {"pt": "comparativo",  "en": "compare",     "es": "comparativa"},
    "steps":       {"pt": "substituto-do-steps-recorder",
                    "en": "steps-recorder-replacement",
                    "es": "alternativa-al-steps-recorder"},
}


def _switcher(lang, paginas_por_idioma, pagina):
    """Seletor de idioma: links diretos para a mesma página nos outros idiomas."""
    itens = []
    for L in IDIOMAS:
        destino = paginas_por_idioma[L][pagina]
        if L == "pt":
            destino += "?lang=pt"          # evita que a detecção redirecione de novo
        atual = ' style="color:var(--ink);font-weight:600"' if L == lang else ""
        itens.append(f'<a href="{destino}"{atual}>{L.upper()}</a>')
    return ('<span style="display:inline-flex;gap:9px;border-left:1px solid var(--line);padding-left:16px">'
            + "".join(itens) + "</span>")


def build_site(root: pathlib.Path) -> None:
    import json
    dic = json.loads((root / "src" / "i18n-site.json").read_text(encoding="utf-8"))
    modelo = (root / "src" / "site" / "home.html").read_text(encoding="utf-8")

    pre = {"pt": "", "en": "/en", "es": "/es"}
    caminhos = {
        # o ?lang vai nos três: quem escolheu o idioma do site escolheu o do app.
        # Sem ele, um navegador em inglês abria o app em inglês mesmo vindo da
        # página em português — e a pessoa achava que era defeito.
        L: dict({"home": pre[L] or "/", "app": "/app?lang=" + L,
                 "root": "/"},
                **{pg: pre[L] + "/" + sl[L] for pg, sl in SLUGS.items()})
        for L in IDIOMAS
    }
    paginas = {L: dict({"home": caminhos[L]["home"]},
                       **{pg: caminhos[L][pg] for pg in SLUGS})
               for L in IDIOMAS}

    for lang in IDIOMAS:
        t = dict(dic[lang])
        t.update(caminhos[lang])
        t["site"] = SITE
        t["marca"] = MARCA
        t["marcaA"], t["marcaB"] = MARCA_A, MARCA_B
        t["ICONV"] = ICON_V
        t["analytics"] = ANALYTICS
        t["supaUrl"] = SUPA_URL
        t["supaKey"] = SUPA_KEY
        t["empresa"] = EMPRESA
        t["cnpj"] = CNPJ
        t["contato"] = CONTATO
        t["selfPath"] = caminhos[lang]["home"]
        t["switcher"] = _switcher(lang, paginas, "home")
        # o link do comparativo vai montado aqui: colocar <a> dentro do JSON de
        # tradução quebraria o dia em que alguém trocar o caminho da página
        t["duoCompLinked"] = t["duoComp"].replace(
            "{0}", f'<a href="{caminhos[lang]["comparativo"]}" style="color:var(--accent)">').replace("{1}", "</a>")
        t["lang"] = lang
        t["redirect"] = REDIRECT if lang == "pt" else ""

        html = modelo
        for k, v in t.items():
            html = html.replace("{{" + k + "}}", str(v))

        faltando = set(re.findall(r"\{\{(\w+)\}\}", html))
        if faltando:
            print(f"AVISO: chaves sem tradução em {lang}: {sorted(faltando)}", file=sys.stderr)
            return 1

        destino = root / "public" / ("index.html" if lang == "pt" else f"{lang}/index.html")
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(html, encoding="utf-8")
        print(f"{destino.relative_to(root)}  {len(html)/1024:.1f} KB")

    # páginas internas: mesmo cabeçalho e rodapé, corpo escrito por idioma
    doc = (root / "src" / "site" / "doc.html").read_text(encoding="utf-8")
    METAS = {
        "precos": {"pt": (f"Preços — {MARCA}", "A ferramenta no navegador é gratuita e sempre será: não há custo de servidor."),
                   "en": (f"Pricing — {MARCA}", "The browser tool is free and always will be: there is no server cost."),
                   "es": (f"Precios — {MARCA}", "La herramienta del navegador es gratuita y siempre lo será: no hay coste de servidor.")},
        "privacidade": {"pt": (f"Política de Privacidade — {MARCA}", f"O {MARCA} não coleta dados pessoais e não recebe seus vídeos."),
                        "en": (f"Privacy Policy — {MARCA}", f"{MARCA} collects no personal data and never receives your videos."),
                        "es": (f"Política de Privacidad — {MARCA}", f"{MARCA} no recoge datos personales y no recibe tus vídeos.")},
        "termos": {"pt": (f"Termos de Uso — {MARCA}", f"Condições de uso do {MARCA}, ferramenta gratuita que roda inteira no seu navegador."),
                   "en": (f"Terms of Use — {MARCA}", f"Terms for {MARCA}, a free tool that runs entirely in your browser."),
                   "es": (f"Términos de Uso — {MARCA}", f"Condiciones de uso de {MARCA}, herramienta gratuita que funciona entera en tu navegador.")},
        "seguranca": {"pt": (f"Segurança da informação — {MARCA}",
                             "Como funciona sem servidor, o que sai da sua máquina, e a lista honesta das certificações que não temos."),
                      "en": (f"Information security — {MARCA}",
                             "How it works with no server, what leaves your machine, and the honest list of certifications we do not hold."),
                      "es": (f"Seguridad de la información — {MARCA}",
                             "Cómo funciona sin servidor, qué sale de tu equipo y la lista honesta de las certificaciones que no tenemos.")},
        "comparativo": {"pt": (f"Comparativo — {MARCA} e as alternativas",
                               "FlowShare, Scribe, Tosca, Steps Recorder: o que cada um faz, o preço de tabela e onde cada um ganha — inclusive da gente."),
                        "en": (f"Compare — {MARCA} and the alternatives",
                               "FlowShare, Scribe, Tosca, Steps Recorder: what each does, list prices, and where each one wins — including against us."),
                        "es": (f"Comparativa — {MARCA} y las alternativas",
                               "FlowShare, Scribe, Tosca, Steps Recorder: qué hace cada uno, el precio de tarifa y dónde gana cada uno — incluso a nosotros.")},
        "steps": {"pt": (f"O Steps Recorder acabou — o que usar no lugar | {MARCA}",
                         "O Gravador de Etapas do Windows foi descontinuado e nada que a Microsoft indica gera documento de passos. O que fazer."),
                  "en": (f"Steps Recorder is gone — what to use instead | {MARCA}",
                         "Windows Steps Recorder was deprecated and none of Microsoft's suggested replacements produce a step document. What to do."),
                  "es": (f"Steps Recorder se acabó — qué usar en su lugar | {MARCA}",
                         "La Grabadora de Acciones de Windows fue descontinuada y nada de lo que Microsoft sugiere genera un documento de pasos. Qué hacer.")},
    }
    for pagina, metas in METAS.items():
        for lang in IDIOMAS:
            corpo_arq = root / "src" / "site" / "bodies" / f"{pagina}.{lang}.html"
            if not corpo_arq.exists():
                print(f"AVISO: falta {corpo_arq.relative_to(root)}", file=sys.stderr)
                continue
            t = dict(dic[lang]); t.update(caminhos[lang])
            t["site"] = SITE
            t["marca"] = MARCA
            t["marcaA"], t["marcaB"] = MARCA_A, MARCA_B
            t["ICONV"] = ICON_V
            t["analytics"] = ANALYTICS
            t["supaUrl"] = SUPA_URL
            t["supaKey"] = SUPA_KEY
            t["empresa"] = EMPRESA
            t["cnpj"] = CNPJ
            t["contato"] = CONTATO
            t["lang"] = lang
            t["docTitle"], t["docDesc"] = metas[lang]
            t["selfPath"] = caminhos[lang][pagina]
            t["ptPath"] = paginas["pt"][pagina]
            t["enPath"] = paginas["en"][pagina]
            t["esPath"] = paginas["es"][pagina]
            t["switcher"] = _switcher(lang, paginas, pagina)
            corpo = corpo_arq.read_text(encoding="utf-8")
            for k, v in t.items():
                corpo = corpo.replace("{{" + k + "}}", str(v))
            t["body"] = corpo
            html = doc
            for k, v in t.items():
                html = html.replace("{{" + k + "}}", str(v))
            sobrando = set(re.findall(r"\{\{(\w+)\}\}", html))
            if sobrando:
                print(f"AVISO: chaves sem valor em {pagina}.{lang}: {sorted(sobrando)}", file=sys.stderr)
            arq = SLUGS[pagina][lang] + ".html"
            saida = root / "public" / (arq if lang == "pt" else f"{lang}/{arq}")
            saida.parent.mkdir(parents=True, exist_ok=True)
            saida.write_text(html, encoding="utf-8")
            print(f"{saida.relative_to(root)}  {len(html)/1024:.1f} KB")

    # sitemap e robots: a página do Steps Recorder só serve se for encontrada,
    # e um site sem mapa deixa o buscador adivinhar. As alternativas de idioma
    # vão declaradas em cada URL, senão as três versões competem entre si.
    urls = []
    for pagina in ["home"] + list(SLUGS):
        for lang in IDIOMAS:
            alt = "".join(
                f'\n    <xhtml:link rel="alternate" hreflang="{L if L != "pt" else "pt-BR"}" '
                f'href="{SITE}{paginas[L][pagina]}"/>'
                for L in IDIOMAS)
            urls.append(f'  <url>\n    <loc>{SITE}{paginas[lang][pagina]}</loc>{alt}\n'
                        f'    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE}{paginas["en"][pagina]}"/>\n'
                        f'  </url>')
    sitemap = ('<?xml version="1.0" encoding="UTF-8"?>\n'
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
               'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
               + "\n".join(urls) + "\n</urlset>\n")
    (root / "public" / "sitemap.xml").write_text(sitemap, encoding="utf-8")
    print(f"public/sitemap.xml  {len(sitemap)/1024:.1f} KB")

    robots = f"User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n"
    (root / "public" / "robots.txt").write_text(robots, encoding="utf-8")
    print("public/robots.txt")

    # support.js: o único texto do site que não vinha de template — e foi
    # exatamente onde o nome antigo sobreviveu à troca. Agora ele mora em src
    # com o token {{marca}} e é estampado aqui, como todo o resto.
    sup = (root / "src" / "site" / "support.js").read_text(encoding="utf-8")
    sup = sup.replace("{{marca}}", MARCA)
    (root / "public" / "support.js").write_text(sup, encoding="utf-8")
    print(f"public/support.js  {len(sup)/1024:.1f} KB")

    # A trava da troca de nome: nome antigo em qualquer página que não seja o
    # aviso histórico (termos e privacidade citam o ClipContext de propósito,
    # explicando a mudança) derruba o build em vez de ir parar no ar.
    permitidos = {"termos.html", "privacidade.html"}
    for arq in sorted((root / "public").rglob("*")):
        if arq.suffix not in (".html", ".js", ".xml", ".txt", ".css"):
            continue
        if arq.name in permitidos:
            continue
        if "clipcontext" in arq.read_text(encoding="utf-8", errors="ignore").lower():
            print(f"o nome antigo sobrou em {arq.relative_to(root)} — corrija a fonte", file=sys.stderr)
            return 1
    return 0


def main() -> int:
    template = ROOT / "src" / "template.html"
    vendor = ROOT / "vendor" / "jspdf.umd.min.js"

    for path in (template, vendor):
        if not path.exists():
            print(f"faltando: {path}", file=sys.stderr)
            return 1

    src = template.read_text(encoding="utf-8")
    src = src.replace("__MARCA__", MARCA)
    src = src.replace("__CONTATO__", CONTATO)
    src = src.replace("__MARCAA__", MARCA_A).replace("__MARCAB__", MARCA_B)
    src = src.replace("__SITE__", SITE)                      # domínio público, definido no topo
    src = src.replace("__SITEDOM__", SITE.split("//")[-1])  # o mesmo, sem o esquema, para exibir
    src = src.replace("__ICONV__", ICON_V)
    if MARKER not in src:
        print(f"marcador {MARKER} não encontrado em src/template.html", file=sys.stderr)
        return 1

    # build web: metadados de SEO + jsPDF do CDN + medição
    web = src.replace(MARKER, f'<script src="{CDN}"></script>')
    if PLAIN_TITLE in web:
        web = web.replace(PLAIN_TITLE, META)
    web = web.replace("__SUPAURL__", SUPA_URL).replace("__SUPAKEY__", SUPA_KEY)
    web = web.replace("<!--__ANALYTICS__-->", ANALYTICS)
    out_web = ROOT / "public" / "app.html"
    out_web.parent.mkdir(exist_ok=True)
    out_web.write_text(web, encoding="utf-8")

    # build offline: biblioteca embutida, sem nenhuma dependência de rede para o
    # PDF — e sem endereço de medição nenhum. As strings vazias fazem o `medir()`
    # sair pelo primeiro `if` e o snippet do Vercel simplesmente não existir.
    lib = vendor.read_text(encoding="utf-8")
    offline = src.replace(MARKER, f"<script>{lib}</script>")
    offline = offline.replace("__SUPAURL__", "").replace("__SUPAKEY__", "")
    offline = offline.replace("<!--__ANALYTICS__-->", "")
    out_off = ROOT / "offline" / "walkstamp-offline.html"
    out_off.parent.mkdir(exist_ok=True)
    out_off.write_text(offline, encoding="utf-8")

    # Trava, não conferência: se um dia alguém colar um endereço direto no
    # template, o build quebra em vez de publicar um "offline" que telefona.
    for proibido in ("supabase.co", "_vercel/insights"):
        if proibido in offline:
            print(f"o build offline contém {proibido!r} — ele tem que ser mudo", file=sys.stderr)
            return 1

    for path in (out_web, out_off):
        print(f"{path.relative_to(ROOT)}  {len(path.read_text(encoding='utf-8')) / 1024:.1f} KB")

    build_site(ROOT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
