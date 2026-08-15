// Resolve o código IBGE de 7 dígitos de um município.
//
// O código do município emissor (cLocEmi/cLocPrestacao) precisa existir no
// convênio nacional da NFS-e. Ninguém sabe esse código de cabeça, então em vez
// de exigir digitação manual nós o derivamos do que a empresa já tem cadastrado:
// município + UF (que vêm da Receita pelo CNPJ).
//
// Fonte: API pública de localidades do IBGE. Sem chave, sem custo.

function norm(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .trim();
}

// Cache em memória por processo: a lista de municípios de uma UF não muda.
const cacheUf = new Map<string, Array<{ id: number; nome: string }>>();

/**
 * Retorna o código IBGE (7 dígitos, string) do município, ou null se não achar.
 * Casa por nome normalizado (ignora acento/caixa), tolerando o formato que a
 * Receita devolve.
 */
export async function ibgePorMunicipioUf(municipio: string | null | undefined, uf: string | null | undefined): Promise<string | null> {
  const ufUp = (uf ?? "").trim().toUpperCase();
  const alvo = norm(municipio);
  if (!ufUp || ufUp.length !== 2 || !alvo) return null;

  try {
    let lista = cacheUf.get(ufUp);
    if (!lista) {
      const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ufUp}/municipios`, {
        cache: "no-store",
      });
      if (!r.ok) return null;
      lista = (await r.json()) as Array<{ id: number; nome: string }>;
      if (Array.isArray(lista) && lista.length > 0) cacheUf.set(ufUp, lista);
    }
    const achou = lista.find((m) => norm(m.nome) === alvo);
    return achou ? String(achou.id) : null;
  } catch {
    return null;
  }
}

/**
 * Valida que um código IBGE tem o formato plausível: 7 dígitos, começando pelo
 * código de UF (11–53). Não garante que existe no convênio, mas barra valores
 * obviamente inválidos (vazio, curto, com não-dígitos).
 */
export function codigoIbgePlausivel(codigo: string | null | undefined): boolean {
  const d = (codigo ?? "").replace(/\D/g, "");
  if (d.length !== 7) return false;
  const uf = Number(d.slice(0, 2));
  return uf >= 11 && uf <= 53;
}

/**
 * Resolve o código IBGE do emitente a partir da config e da empresa.
 * Ordem: usa o que já está salvo (se plausível); senão deriva por município+UF.
 * Retorna o código e se ele foi derivado agora (para gravar de volta).
 */
export async function resolverIbgeEmitente(opts: {
  codigoSalvo: string | null | undefined;
  municipio: string | null | undefined;
  uf: string | null | undefined;
}): Promise<{ codigo: string | null; derivado: boolean }> {
  if (codigoIbgePlausivel(opts.codigoSalvo)) {
    return { codigo: (opts.codigoSalvo ?? "").replace(/\D/g, ""), derivado: false };
  }
  const derivado = await ibgePorMunicipioUf(opts.municipio, opts.uf);
  return { codigo: derivado, derivado: derivado != null };
}
