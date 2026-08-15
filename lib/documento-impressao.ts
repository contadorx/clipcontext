/**
 * O que fica do documento depois que o arquivo é apagado.
 *
 * O expurgo existe para o Storage não virar arquivo morto pago. Mas ele apagava
 * tudo: o contador ficava com uma linha dizendo "existiu um documento aqui" e
 * nada mais. Duas coisas cabem em bytes e resolvem quase todo uso posterior:
 *
 * 1. **A impressão digital** (SHA-256, 64 caracteres hex). É do arquivo **como
 *    foi armazenado**, depois da compressão — então ela não bate com o original
 *    de 2 MB que o cliente guardou no celular, e não serve para conferir contra
 *    ele. Serve para achar o mesmo documento enviado duas vezes, e para provar
 *    que o arquivo não mudou enquanto esteve guardado.
 * 2. **Os dados da nota**, quando o arquivo é XML. O XML da NF-e é estruturado:
 *    chave, emitente, CNPJ, valor e data saem dele sem OCR, sem IA e sem
 *    chute. São algumas centenas de bytes que continuam pesquisáveis para
 *    sempre — coisa que o PDF nunca foi, nem quando existia.
 *
 * Tudo roda no navegador, antes do upload. `crypto.subtle` e `DOMParser` são
 * nativos; nenhuma dependência nova e nenhum byte extra no servidor.
 */

export type DadosDocumento = {
  sha256: string | null;
  chaveAcesso: string | null;
  emitenteNome: string | null;
  emitenteCnpj: string | null;
  valorTotal: number | null;
  emitidoEm: string | null;
};

const VAZIO: DadosDocumento = {
  sha256: null,
  chaveAcesso: null,
  emitenteNome: null,
  emitenteCnpj: null,
  valorTotal: null,
  emitidoEm: null,
};

/**
 * SHA-256 em hexadecimal.
 *
 * `crypto.subtle` só existe em contexto seguro (https ou localhost). Em http
 * simples ele é `undefined` — daí a checagem, em vez de deixar estourar e levar
 * o envio junto por causa de um campo acessório.
 */
async function hash(file: File): Promise<string | null> {
  try {
    if (typeof crypto === "undefined" || !crypto.subtle) return null;
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

/** primeiro texto não vazio entre as tags pedidas, na ordem */
function texto(doc: Document, ...tags: string[]): string | null {
  for (const t of tags) {
    const el = doc.getElementsByTagName(t)[0];
    const v = el?.textContent?.trim();
    if (v) return v;
  }
  return null;
}

/**
 * Lê o XML de uma NF-e / NFC-e.
 *
 * O layout é fixo por lei (leiaute nacional), então os nomes de tag são
 * estáveis: `infNFe@Id` carrega a chave prefixada por "NFe", `emit/xNome` o
 * emitente, `ICMSTot/vNF` o total. `dhEmi` é o campo atual e `dEmi` o de
 * layouts antigos que ainda circulam em arquivo guardado.
 *
 * Devolve o que conseguir. Um XML que não seja NF-e — NFS-e municipal, que não
 * tem layout nacional, ou qualquer outro — simplesmente não casa com as tags e
 * volta com os campos nulos, sem erro.
 */
function lerNFe(xml: string): Omit<DadosDocumento, "sha256"> {
  try {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) return VAZIO;

    const inf = doc.getElementsByTagName("infNFe")[0];
    const id = inf?.getAttribute("Id") ?? "";
    const soDigitos = id.replace(/\D/g, "");
    const chave = soDigitos.length === 44 ? soDigitos : texto(doc, "chNFe");

    const emit = doc.getElementsByTagName("emit")[0];
    const emitenteNome = emit?.getElementsByTagName("xNome")[0]?.textContent?.trim() ?? null;
    const emitenteCnpj = emit?.getElementsByTagName("CNPJ")[0]?.textContent?.trim() ?? null;

    const vNF = texto(doc, "vNF");
    const valorTotal = vNF && Number.isFinite(Number(vNF)) ? Number(vNF) : null;

    // dhEmi vem como data-hora com fuso ("2026-08-13T10:22:00-03:00"); o
    // recorte pega o dia local do emitente, que é o que a nota diz
    const dh = texto(doc, "dhEmi", "dEmi");
    const emitidoEm = dh ? dh.slice(0, 10) : null;

    return {
      chaveAcesso: chave && chave.length === 44 ? chave : null,
      emitenteNome,
      emitenteCnpj,
      valorTotal,
      emitidoEm,
    };
  } catch {
    return VAZIO;
  }
}

/**
 * Calcula tudo o que dá para calcular sobre o arquivo, sem impedir o envio.
 *
 * Nada aqui é essencial para o documento chegar ao contador. Se o hash falhar
 * ou o XML for ilegível, o envio segue com os campos nulos — barrar uma nota
 * fiscal por causa de um metadado seria trocar o principal pelo acessório.
 */
export async function lerDadosDocumento(file: File): Promise<DadosDocumento> {
  const sha256 = await hash(file);
  const ehXml = file.type.includes("xml") || /\.xml$/i.test(file.name);
  if (!ehXml) return { ...VAZIO, sha256 };
  try {
    const texto = await file.text();
    return { ...lerNFe(texto), sha256 };
  } catch {
    return { ...VAZIO, sha256 };
  }
}
