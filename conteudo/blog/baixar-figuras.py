#!/usr/bin/env python3
"""AS FIGURAS DO BLOG, DO BALDE VELHO PARA O PROJETO — Build 70.

Os posts saíram do banco para `conteudo/blog/`. As figuras moravam no balde
`blog` do Supabase, e cada `post.json` guarda, para cada uma, o endereço de
origem, o tamanho e o MD5 que o balde registrava.

Este script baixa só o que falta em `public/img/blog/<chave>/<arquivo>` e só
grava o arquivo se o tamanho E o MD5 baterem com o registrado. Uma figura que
chega diferente não entra: o build (`escrever_blog`) para enquanto ela faltar,
e é melhor parar do que publicar outra imagem com o nome da certa.

Depende de o balde ainda existir — ele some no Build 72, junto com o projeto.
Depois disso, a cópia é a que está no repositório.

    python3 conteudo/blog/baixar-figuras.py
"""
import hashlib
import json
import os
import pathlib
import ssl
import sys
import urllib.request

RAIZ = pathlib.Path(__file__).resolve().parents[2]
BASE = RAIZ / "conteudo" / "blog"
DESTINO = RAIZ / "public" / "img" / "blog"


def contexto_tls():
    ca = os.environ.get("SSL_CERT_FILE") or os.environ.get("REQUESTS_CA_BUNDLE")
    return ssl.create_default_context(cafile=ca) if ca else ssl.create_default_context()


def main() -> int:
    faltam = baixadas = erradas = 0
    tls = contexto_tls()
    for meta_arq in sorted(BASE.glob("*/post.json")):
        meta = json.loads(meta_arq.read_text(encoding="utf-8"))
        for f in meta.get("figuras") or []:
            alvo = DESTINO / meta["chave"] / f["arquivo"]
            if alvo.exists() and hashlib.md5(alvo.read_bytes()).hexdigest() == f.get("md5"):
                continue
            faltam += 1
            try:
                with urllib.request.urlopen(f["origem"], timeout=60, context=tls) as r:
                    dados = r.read()
            except Exception as e:  # noqa: BLE001 — o motivo vai para a tela
                print(f"  FALHOU  {meta['chave']}/{f['arquivo']}: {e}")
                erradas += 1
                continue
            md5 = hashlib.md5(dados).hexdigest()
            if len(dados) != f.get("bytes") or md5 != f.get("md5"):
                print(f"  DIFERENTE  {meta['chave']}/{f['arquivo']}: "
                      f"{len(dados)} bytes, md5 {md5} — esperado {f.get('bytes')} e {f.get('md5')}")
                erradas += 1
                continue
            alvo.parent.mkdir(parents=True, exist_ok=True)
            alvo.write_bytes(dados)
            baixadas += 1
            print(f"  ok  {meta['chave']}/{f['arquivo']}  {len(dados)} bytes")
    print(f"faltavam {faltam}; baixadas e conferidas {baixadas}; com problema {erradas}")
    return 1 if erradas else 0


if __name__ == "__main__":
    sys.exit(main())
