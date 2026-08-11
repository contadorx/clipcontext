#!/usr/bin/env python3
"""
Gera os dois builds do ClipContext a partir de src/template.html.

  public/index.html                 -> jsPDF vindo do CDN (é o que a Vercel publica)
  offline/clipcontext-offline.html  -> jsPDF embutido, arquivo único, funciona sem internet

Edite sempre src/template.html. Os arquivos gerados são descartáveis.
"""

import pathlib
import sys

ROOT = pathlib.Path(__file__).parent
MARKER = "<script>/*__JSPDF__*/</script>"
CDN = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js"

META = """<title>ClipContext — transforme vídeo em contexto para IA</title>
<meta name="description" content="Transforme qualquer vídeo em um PDF com os frames que importam e a transcrição sincronizada, pronto para colar em uma IA. Roda no seu navegador: o vídeo não sai do seu computador.">
<meta property="og:type" content="website">
<meta property="og:title" content="ClipContext — transforme vídeo em contexto para IA">
<meta property="og:description" content="Frames por mudança de cena + transcrição sincronizada, em um PDF único. Nada é enviado para servidor nenhum.">
<meta name="twitter:card" content="summary_large_image">"""

PLAIN_TITLE = "<title>Vídeo → PDF (frames + transcrição)</title>"


def main() -> int:
    template = ROOT / "src" / "template.html"
    vendor = ROOT / "vendor" / "jspdf.umd.min.js"

    for path in (template, vendor):
        if not path.exists():
            print(f"faltando: {path}", file=sys.stderr)
            return 1

    src = template.read_text(encoding="utf-8")
    if MARKER not in src:
        print(f"marcador {MARKER} não encontrado em src/template.html", file=sys.stderr)
        return 1

    # build web: metadados de SEO + jsPDF do CDN
    web = src.replace(MARKER, f'<script src="{CDN}"></script>')
    if PLAIN_TITLE in web:
        web = web.replace(PLAIN_TITLE, META)
    out_web = ROOT / "public" / "index.html"
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
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
