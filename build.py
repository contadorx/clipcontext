#!/usr/bin/env python3
"""
Gera os dois builds do ClipContext a partir de src/template.html.

  public/app.html                   -> a ferramenta, com jsPDF vindo do CDN
  offline/clipcontext-offline.html  -> jsPDF embutido, arquivo único, funciona sem internet

Edite sempre src/template.html. Os arquivos gerados são descartáveis.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).parent
MARKER = "<script>/*__JSPDF__*/</script>"
CDN = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js"

# Endereço público do site, sem barra no fim. Sai daqui para o canonical, para os
# hreflang e para o link do topo da ferramenta — trocar de domínio é mudar esta linha.
SITE = "https://clipcontext.app"

META = """<title>ClipContext — transforme vídeo em contexto para IA</title>
<meta name="description" content="Transforme qualquer vídeo em um PDF com os frames que importam e a transcrição sincronizada, pronto para colar em uma IA. Roda no seu navegador: o vídeo não sai do seu computador.">
<meta property="og:type" content="website">
<meta property="og:title" content="ClipContext — transforme vídeo em contexto para IA">
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
        L: {"home": pre[L] or "/", "app": "/app" + ("" if L == "pt" else "?lang=" + L),
            "precos": pre[L] + "/precos", "privacidade": pre[L] + "/privacidade",
            "termos": pre[L] + "/termos", "root": "/"}
        for L in IDIOMAS
    }
    paginas = {L: {"home": caminhos[L]["home"], "precos": caminhos[L]["precos"],
                   "privacidade": caminhos[L]["privacidade"], "termos": caminhos[L]["termos"]}
               for L in IDIOMAS}

    for lang in IDIOMAS:
        t = dict(dic[lang])
        t.update(caminhos[lang])
        t["site"] = SITE
        t["selfPath"] = caminhos[lang]["home"]
        t["switcher"] = _switcher(lang, paginas, "home")
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
        "precos": {"pt": ("Preços — ClipContext", "A ferramenta no navegador é gratuita e sempre será: não há custo de servidor."),
                   "en": ("Pricing — ClipContext", "The browser tool is free and always will be: there is no server cost."),
                   "es": ("Precios — ClipContext", "La herramienta del navegador es gratuita y siempre lo será: no hay coste de servidor.")},
        "privacidade": {"pt": ("Política de Privacidade — ClipContext", "O ClipContext não coleta dados pessoais e não recebe seus vídeos."),
                        "en": ("Privacy Policy — ClipContext", "ClipContext collects no personal data and never receives your videos."),
                        "es": ("Política de Privacidad — ClipContext", "ClipContext no recoge datos personales y no recibe tus vídeos.")},
        "termos": {"pt": ("Termos de Uso — ClipContext", "Condições de uso do ClipContext, ferramenta gratuita e de código aberto."),
                   "en": ("Terms of Use — ClipContext", "Terms for ClipContext, a free and open-source tool."),
                   "es": ("Términos de Uso — ClipContext", "Condiciones de uso de ClipContext, herramienta gratuita y de código abierto.")},
    }
    for pagina, metas in METAS.items():
        for lang in IDIOMAS:
            corpo_arq = root / "src" / "site" / "bodies" / f"{pagina}.{lang}.html"
            if not corpo_arq.exists():
                print(f"AVISO: falta {corpo_arq.relative_to(root)}", file=sys.stderr)
                continue
            t = dict(dic[lang]); t.update(caminhos[lang])
            t["site"] = SITE
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
            saida = root / "public" / (f"{pagina}.html" if lang == "pt" else f"{lang}/{pagina}.html")
            saida.parent.mkdir(parents=True, exist_ok=True)
            saida.write_text(html, encoding="utf-8")
            print(f"{saida.relative_to(root)}  {len(html)/1024:.1f} KB")
    return 0


def main() -> int:
    template = ROOT / "src" / "template.html"
    vendor = ROOT / "vendor" / "jspdf.umd.min.js"

    for path in (template, vendor):
        if not path.exists():
            print(f"faltando: {path}", file=sys.stderr)
            return 1

    src = template.read_text(encoding="utf-8")
    src = src.replace("__SITE__", SITE)                      # domínio público, definido no topo
    src = src.replace("__SITEDOM__", SITE.split("//")[-1])  # o mesmo, sem o esquema, para exibir
    if MARKER not in src:
        print(f"marcador {MARKER} não encontrado em src/template.html", file=sys.stderr)
        return 1

    # build web: metadados de SEO + jsPDF do CDN
    web = src.replace(MARKER, f'<script src="{CDN}"></script>')
    if PLAIN_TITLE in web:
        web = web.replace(PLAIN_TITLE, META)
    out_web = ROOT / "public" / "app.html"
    out_web.parent.mkdir(exist_ok=True)
    out_web.write_text(web, encoding="utf-8")

    # build offline: biblioteca embutida, sem nenhuma dependência de rede para o PDF
    lib = vendor.read_text(encoding="utf-8")
    offline = src.replace(MARKER, f"<script>{lib}</script>")
    out_off = ROOT / "offline" / "clipcontext-offline.html"
    out_off.parent.mkdir(exist_ok=True)
    out_off.write_text(offline, encoding="utf-8")

    for path in (out_web, out_off):
        print(f"{path.relative_to(ROOT)}  {len(path.read_text(encoding='utf-8')) / 1024:.1f} KB")

    build_site(ROOT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
