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

# ---------------------------------------------------------------------------
# Google Drive e Google Docs. Os três nascem VAZIOS e é assim que devem ficar
# em qualquer cópia que não seja a sua: com eles vazios, nenhum botão do Google
# é renderizado e nenhum endereço do Google é requisitado.
#
# São valores PÚBLICOS por natureza — vão para dentro de um HTML estático que
# qualquer pessoa lê. O que protege a chave não é o segredo, é a lista de
# origens autorizadas no console do Google. O passo a passo está em
# GOOGLE-DRIVE.md.
#
#   G_CLIENT  -> liga "Enviar para o Google Docs" (só ele já basta)
#   G_KEY     -> chave de API, restrita a Picker API + seus domínios
#   G_APP     -> número do projeto, só dígitos
#              os três juntos ligam "Abrir do Google Drive"
#
# Nada disso entra no build offline: lá os três viram string vazia, como os
# tokens de medição.
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Licença do plano Time. Esta é a chave PÚBLICA — ela só sabe CONFERIR uma
# assinatura, nunca produzir uma. Pode ir para o HTML e para o repositório
# público sem risco nenhum; quem assina é a privada, que fica no
# emitir-licenca.py e nunca entra aqui.
#
# Trocar o par derruba todas as licenças já emitidas. Só faça isso se a privada
# vazar — e aí é justamente o que se quer.
# ---------------------------------------------------------------------------
LIC_PUB = "sVXqPeioW7lkGRM2EPNSOadXCQNFGTBXLtzTknMSeYE"
# A segunda chave pública: a do emissor AUTOMÁTICO (a função da Supabase que
# manda o link por e-mail). São duas de propósito. A de cima assina qualquer
# licença e a privada dela nunca sai da máquina do Leandro; a de baixo vive num
# segredo da Supabase, e o navegador só aceita dela licenças curtas (até 100
# dias) e pequenas (até 25 assentos). Se o servidor for comprometido, o estrago
# máximo é um punhado de licenças de teste — nunca uma licença perpétua.
LIC_PUB_AUTO = "XTO_Xcc5mByFV3tIcijyhjIaJZR-8cyf_HCb1npPtMs"

G_CLIENT = "184815388097-6aki8j9sfgat025onau4alnsu6vqje0b.apps.googleusercontent.com"
G_KEY    = "AIzaSyBsXkxGvHeiSlj4U42wMNDAd-GdlrO18QM"
G_APP    = "184815388097"

# Projeto PRÓPRIO do Walkstamp, na organização Softaria (região sa-east-1).
# Antes era o projeto do SalaVox, emprestado: dois produtos no mesmo banco, na
# mesma conta de e-mail e nos mesmos limites. Separado, cada um cresce sem
# atropelar o outro — e o dia em que um for vendido, migrado ou desligado não
# arrasta o outro junto.
#
# Estas duas linhas são PÚBLICAS por construção: a chave publicável é a chave
# anônima, e só consegue chamar duas funções que apenas INSEREM (medição e lista
# de aviso). Ler a lista de e-mails ou a tabela de licenças é privilégio do
# service_role, que nunca sai do servidor.
SUPA_URL = "https://kjlnyyblhanficgpends.supabase.co"
SUPA_KEY = "sb_publishable_J78bnm05t_zuzcLQ65pW-A_9K3HtU81"

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
/* Detecção de idioma na home. Três regras, e a ordem importa:

   1. `?lang=` na URL manda em tudo — quem clicou numa sigla escolheu, e a
      escolha fica registrada para as próximas visitas;
   2. uma escolha anterior (guardada no `localStorage`, e é a ÚNICA coisa que
      esta página guarda) vale mais que o idioma do sistema: quem já disse que
      lê em português num computador em inglês não quer ser mandado de volta
      para /en toda vez;
   3. só então o idioma do navegador decide.

   `navigator.languages` e não `navigator.language`: quem tem "pt-BR, en-US"
   configurado prefere português, e olhar só o primeiro item já erraria menos,
   mas a lista inteira erra menos ainda quando o primeiro é um idioma que não
   temos. */
(function(){
  try{
    var q = new URLSearchParams(location.search).get('lang');
    var temos = ['pt','en','es'];
    if (q && temos.indexOf(q) >= 0) { try{ localStorage.setItem('walkstamp.lang', q); }catch(e){} return; }
    var salvo = null;
    try{ salvo = localStorage.getItem('walkstamp.lang'); }catch(e){}
    var escolhido = (temos.indexOf(salvo) >= 0) ? salvo : null;
    if (!escolhido) {
      var lista = navigator.languages && navigator.languages.length
        ? navigator.languages : [navigator.language || ''];
      for (var i = 0; i < lista.length && !escolhido; i++) {
        var n = String(lista[i]).slice(0,2).toLowerCase();
        if (temos.indexOf(n) >= 0) escolhido = n;
      }
    }
    if (escolhido === 'en') location.replace('/en');
    else if (escolhido === 'es') location.replace('/es');
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
    "verificar":   {"pt": "verificar",   "en": "verify",      "es": "verificar"},
    "comparativo": {"pt": "comparativo",  "en": "compare",     "es": "comparativa"},
    "link":        {"pt": "link",        "en": "link",        "es": "link"},
    "time":        {"pt": "time",        "en": "team",        "es": "equipo"},
    # As cinco páginas de caso de uso. O endereço é traduzido de propósito: é
    # nelas que a busca acontece, e ninguém procura "caso-usabilidade" em inglês.
    "casoEv":  {"pt": "evidencia-de-teste",    "en": "test-evidence",    "es": "evidencia-de-prueba"},
    "casoIn":  {"pt": "instrucao-de-trabalho", "en": "work-instruction", "es": "instruccion-de-trabajo"},
    "casoAta": {"pt": "ata-de-reuniao",        "en": "meeting-minutes",  "es": "acta-de-reunion"},
    "casoIa":  {"pt": "contexto-para-ia",      "en": "context-for-ai",   "es": "contexto-para-ia"},
    "casoUx":  {"pt": "teste-de-usabilidade",  "en": "usability-test",   "es": "prueba-de-usabilidad"},
    "steps":       {"pt": "substituto-do-steps-recorder",
                    "en": "steps-recorder-replacement",
                    "es": "alternativa-al-steps-recorder"},
}


LEMBRAR = """<script>
/* Só registra a escolha; quem está em /en ou /es chegou por link ou por
   redirecionamento, e nos dois casos a detecção já fez o trabalho dela. */
(function(){
  try{
    var q = new URLSearchParams(location.search).get('lang');
    if (['pt','en','es'].indexOf(q) >= 0) localStorage.setItem('walkstamp.lang', q);
  }catch(e){}
})();
</script>"""


def _switcher(lang, paginas_por_idioma, pagina):
    """Seletor de idioma: links diretos para a mesma página nos outros idiomas."""
    itens = []
    for L in IDIOMAS:
        destino = paginas_por_idioma[L][pagina]
        # `?lang=` em TODOS: é o sinal explícito que a home registra para não
        # mandar a pessoa de volta pelo idioma do sistema na próxima visita
        destino += ("&" if "?" in destino else "?") + "lang=" + L
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
        t["redirect"] = REDIRECT if lang == "pt" else LEMBRAR

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
        "verificar": {"pt": (f"Conferir uma evidência — {MARCA}",
                             "Arraste o zip ou o json e confira, no seu próprio navegador, se as imagens continuam as mesmas."),
                      "en": (f"Check a piece of evidence — {MARCA}",
                             "Drop the zip or the json and check, in your own browser, whether the images are still the same."),
                      "es": (f"Comprobar una evidencia — {MARCA}",
                             "Arrastra el zip o el json y comprueba, en tu propio navegador, si las imágenes siguen siendo las mismas.")},
        "link": {"pt": (f"Link pronto para o seu sistema de teste — {MARCA}",
                        "Monte um link que abre o Walkstamp com o caso, o chamado e o sistema já preenchidos. Cole no Zephyr, no Jira, no TestRail ou numa planilha. Grátis, sem integração e sem cadastro."),
                 "en": (f"A ready-made link for your test management tool — {MARCA}",
                        "Build a link that opens Walkstamp with the case, the ticket and the system already filled in. Paste it into Zephyr, Jira, TestRail or a spreadsheet. Free, no integration, no sign-up."),
                 "es": (f"Un enlace listo para tu sistema de pruebas — {MARCA}",
                        "Arma un enlace que abre Walkstamp con el caso, el ticket y el sistema ya rellenados. Pégalo en Zephyr, Jira, TestRail o una hoja de cálculo. Gratis, sin integración y sin registro.")},
        "casoEv": {"pt": (f"Evidência de teste que a auditoria aceita — {MARCA}",
                          "Grave o teste e saia com o PDF: uma tela por passo, hora de relógio, cabeçalho de identificação e verificação de integridade. Grátis, no navegador, sem instalar nada."),
                   "en": (f"Test evidence an auditor will accept — {MARCA}",
                          "Record the test and walk away with the PDF: one screen per step, clock time, identification header and integrity verification. Free, in the browser, nothing to install."),
                   "es": (f"Evidencia de prueba que la auditoría acepta — {MARCA}",
                          "Graba la prueba y sal con el PDF: una pantalla por paso, hora de reloj, cabecera de identificación y comprobación de integridad. Gratis, en el navegador, sin instalar nada.")},
        "casoIn": {"pt": (f"Instrução de trabalho sem colar prints à mão — {MARCA}",
                          "O passo a passo do key user gerado de uma gravação: sua narração vira o texto de cada passo, sem carimbo de data e sem instalar programa."),
                   "en": (f"Work instructions without pasting screenshots by hand — {MARCA}",
                          "The key user's step-by-step produced from one recording: your narration becomes the text of each step, with no date stamp and nothing to install."),
                   "es": (f"Instrucción de trabajo sin pegar capturas a mano — {MARCA}",
                          "El paso a paso del key user generado de una grabación: tu narración se vuelve el texto de cada paso, sin sello de fecha y sin instalar nada.")},
        "casoAta": {"pt": (f"Ata de reunião com as telas do que foi mostrado — {MARCA}",
                           "A gravação da reunião vira um documento com os momentos que importam, a tela de cada um e a fala pareada. O arquivo não sai do seu computador."),
                    "en": (f"Meeting minutes with the screens of what was shown — {MARCA}",
                           "The meeting recording becomes a document with the moments that matter, the screen of each one and the speech paired to it. The file never leaves your computer."),
                    "es": (f"Acta de reunión con las pantallas de lo que se mostró — {MARCA}",
                           "La grabación de la reunión se vuelve un documento con los momentos que importan, la pantalla de cada uno y el habla emparejada. El archivo no sale de tu ordenador.")},
        "casoIa": {"pt": (f"Um vídeo que a IA consegue ler inteiro — {MARCA}",
                          "~60 telas em vez de 3.600, cada uma pareada com a fala daquele trecho, e o prompt pronto. Cabe em qualquer modelo, inclusive nos que recusam vídeo."),
                   "en": (f"A video the AI can actually read end to end — {MARCA}",
                          "~60 screens instead of 3,600, each paired with the speech of that stretch, plus a ready-made prompt. Fits any model, including the ones that refuse video."),
                   "es": (f"Un vídeo que la IA sí puede leer entero — {MARCA}",
                          "~60 pantallas en vez de 3.600, cada una emparejada con el habla de ese tramo, y el prompt listo. Cabe en cualquier modelo, incluidos los que rechazan vídeo.")},
        "casoUx": {"pt": (f"Sessão de teste de usabilidade que vira relatório — {MARCA}",
                          "Moderador e participante separados, momentos marcados durante a sessão e tarja para anonimizar. A gravação do participante não sai do seu computador."),
                   "en": (f"A usability session that turns into a report — {MARCA}",
                          "Moderator and participant kept apart, moments marked during the session, and redaction to anonymise. The participant's recording never leaves your computer."),
                   "es": (f"Una sesión de usabilidad que se convierte en informe — {MARCA}",
                          "Moderador y participante separados, momentos marcados durante la sesión y tapado para anonimizar. La grabación del participante no sale de tu ordenador.")},
        "time": {"pt": (f"Plano Time: receba seu link por e-mail — {MARCA}",
                        "Informe seu e-mail e receba um link que ativa o plano Time no navegador do seu time. Teste de 14 dias, sem cadastro, sem senha e sem cartão."),
                 "en": (f"Team plan: get your link by email — {MARCA}",
                        "Enter your email and get a link that switches on the Team plan in your team's browser. 14-day trial, no sign-up, no password, no card."),
                 "es": (f"Plan Equipo: recibe tu enlace por correo — {MARCA}",
                        "Escribe tu correo y recibe un enlace que activa el plan Equipo en el navegador de tu equipo. Prueba de 14 días, sin registro, sin contraseña y sin tarjeta.")},
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

    # ---- PWA ----
    # "Instalar sem instalar": o atalho vai para a área de trabalho sem que a TI
    # precise aprovar um executável, e o cache resolve rede instável no meio de
    # uma gravação. O service worker é REDE-PRIMEIRO para as páginas: um app que
    # serve HTML velho de cache é pior que um app que não instala.
    manifest = {
        "name": MARCA, "short_name": MARCA,
        "description": {"pt": "Grave a tela e receba um documento com hora por passo.",
                        "en": "Record the screen and get a document with a time on every step.",
                        "es": "Graba la pantalla y recibe un documento con hora en cada paso."}["pt"],
        "start_url": "/app?lang=pt", "scope": "/", "display": "standalone",
        "background_color": "#f7f8fb", "theme_color": "#3A3F9E", "lang": "pt-BR",
        "icons": [
            {"src": "/favicon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any"},
            {"src": f"/apple-touch-icon.png?v={ICON_V}", "sizes": "180x180", "type": "image/png"}
        ]
    }
    (root / "public" / "manifest.webmanifest").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("public/manifest.webmanifest")

    sw = """/* Service worker do %s.
   Rede primeiro para documentos: uma ferramenta que abre a versão de ontem
   depois de um deploy é pior do que uma que não instala. O cache existe para o
   caso de a rede cair no meio do trabalho, e para os arquivos estáticos.
   Ele NÃO guarda vídeo, áudio, transcrição nem documento gerado: nada disso
   passa por aqui, porque nada disso é uma requisição de rede. */
const CACHE = 'walkstamp-v%s';
const ESSENCIAIS = ['/app', '/site.css', '/favicon.svg', '/logo.svg'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ESSENCIAIS)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ns =>
    Promise.all(ns.filter(n => n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // CDN e modelo não passam por aqui
  e.respondWith(
    fetch(req).then(r => {
      const copia = r.clone();
      caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
      return r;
    }).catch(() => caches.match(req).then(r => r || caches.match('/app')))
  );
});
""" % (MARCA, ICON_V)
    (root / "public" / "sw.js").write_text(sw, encoding="utf-8")
    print("public/sw.js")

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

    # A trava do token esquecido. Um __TOKEN__ que sobrevive ao build vira texto
    # literal na tela ou, pior, uma credencial que não existe e um botão que
    # falha só em produção. Barato de checar, caro de descobrir depois.
    saidas = [root / "public" / "app.html", root / "offline" / "walkstamp-offline.html"]
    for arq in saidas:
        sobrou = sorted(set(re.findall(r"__[A-Z][A-Z0-9_]*__", arq.read_text(encoding="utf-8"))))
        sobrou = [x for x in sobrou if x != "__JSPDF__"]
        if sobrou:
            print(f"token não substituído em {arq.relative_to(root)}: {', '.join(sobrou)}",
                  file=sys.stderr)
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
    # a chave PÚBLICA da licença vale nos dois builds: ela só confere assinatura
    src = src.replace("__LICPUB__", LIC_PUB)
    src = src.replace("__LICPUBAUTO__", LIC_PUB_AUTO)
    if MARKER not in src:
        print(f"marcador {MARKER} não encontrado em src/template.html", file=sys.stderr)
        return 1

    # build web: metadados de SEO + jsPDF do CDN + medição
    web = src.replace(MARKER, f'<script src="{CDN}"></script>')
    if PLAIN_TITLE in web:
        web = web.replace(PLAIN_TITLE, META)
    web = web.replace("__SUPAURL__", SUPA_URL).replace("__SUPAKEY__", SUPA_KEY)
    web = (web.replace("__GCLIENT__", G_CLIENT)
              .replace("__GKEY__", G_KEY)
              .replace("__GAPP__", G_APP))
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
    for tok in ("__GCLIENT__", "__GKEY__", "__GAPP__"):
        offline = offline.replace(tok, "")
    offline = offline.replace("<!--__ANALYTICS__-->", "")
    # o arquivo único é aberto de file://: manifesto e service worker não têm
    # origem para existir ali, e um <link> apontando para /manifest.webmanifest
    # só produziria um 404 no console de quem o abrir
    offline = offline.replace('<link rel="manifest" href="/manifest.webmanifest">\n', "")
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
