#!/usr/bin/env node
/**
 * Testes das regras puras — rateio entre centros de custo e atalhos de data.
 *
 * Rode com:  npm run test:regras
 *
 * São as duas peças onde um erro silencioso sai caro: rateio errado desequilibra
 * relatório por centro, e data errada joga lançamento no mês errado. Não exige
 * framework de teste: compila os dois módulos com o tsc do projeto e confere
 * as asserções em Node.
 */

const { execFileSync } = require("node:child_process");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");

const raiz = path.resolve(__dirname, "..");
const saida = mkdtempSync(path.join(tmpdir(), "fs-regras-"));

try {
  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "tsc",
      "lib/rateio.ts",
      "lib/data-atalho.ts",
      "lib/formato.ts",
      "--outDir",
      saida,
      "--module",
      "commonjs",
      "--target",
      "es2020",
      "--moduleResolution",
      "node",
      "--skipLibCheck",
    ],
    { cwd: raiz, stdio: "inherit" },
  );

  const R = require(path.join(saida, "rateio.js"));
  const D = require(path.join(saida, "data-atalho.js"));

  let falhas = 0;
  const eq = (nome, a, b) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      falhas++;
      console.log(`FALHOU: ${nome}\n  obtido:   ${JSON.stringify(a)}\n  esperado: ${JSON.stringify(b)}`);
    } else {
      console.log(`ok: ${nome}`);
    }
  };

  /* ------------------------------------------------------------- rateio --- */
  const mapa = new Map([
    ["L1", [{ centro_custo_id: "A", valor: 60 }, { centro_custo_id: "B", valor: 40 }]],
  ]);
  const L1 = { id: "L1", valor: 100, centro_custo_id: null };
  const L2 = { id: "L2", valor: 250, centro_custo_id: "C" };
  const L3 = { id: "L3", valor: 80, centro_custo_id: null };

  eq("rateado expande nas partes", R.expandirPorCentro(L1, mapa), [
    { centro_custo_id: "A", valor: 60 },
    { centro_custo_id: "B", valor: 40 },
  ]);
  eq("sem rateio usa o centro do lançamento", R.expandirPorCentro(L2, mapa), [
    { centro_custo_id: "C", valor: 250 },
  ]);
  eq("sem centro nenhum cai em __sem__", R.expandirPorCentro(L3, mapa), [
    { centro_custo_id: "__sem__", valor: 80 },
  ]);
  eq("valor no centro A", R.valorNoCentro(L1, mapa, "A"), 60);
  eq("centro que não participa devolve 0", R.valorNoCentro(L1, mapa, "Z"), 0);

  // rateio parcial (ou valor editado depois): a sobra não pode sumir do relatório
  const parcial = new Map([["L4", [{ centro_custo_id: "A", valor: 30 }]]]);
  const L4 = { id: "L4", valor: 100, centro_custo_id: null };
  eq("sobra de rateio parcial vira sem-centro", R.expandirPorCentro(L4, parcial), [
    { centro_custo_id: "A", valor: 30 },
    { centro_custo_id: "__sem__", valor: 70 },
  ]);
  eq(
    "a soma das partes sempre fecha o total",
    R.expandirPorCentro(L4, parcial).reduce((s, p) => s + p.valor, 0),
    100,
  );

  const lista = [L1, L2, L3];
  eq("recorte por A traz só a parte de A", R.recortarPorCentro(lista, mapa, "A").map((l) => [l.id, l.valor]), [["L1", 60]]);
  eq("recorte por C traz o valor inteiro", R.recortarPorCentro(lista, mapa, "C").map((l) => [l.id, l.valor]), [["L2", 250]]);
  eq("recorte sem-centro", R.recortarPorCentro(lista, mapa, "__sem__").map((l) => [l.id, l.valor]), [["L3", 80]]);

  eq("validação: partes fecham o total", R.validarRateio([{ centro_custo_id: "A", valor: 60 }, { centro_custo_id: "B", valor: 40 }], 100).ok, true);
  eq("validação: faltando valor", R.validarRateio([{ centro_custo_id: "A", valor: 60 }, { centro_custo_id: "B", valor: 30 }], 100).ok, false);
  eq("validação: centro repetido", R.validarRateio([{ centro_custo_id: "A", valor: 60 }, { centro_custo_id: "A", valor: 40 }], 100).ok, false);
  eq("validação: um centro só não é rateio", R.validarRateio([{ centro_custo_id: "A", valor: 100 }], 100).ok, false);
  eq("validação: sem partes é válido (não há rateio)", R.validarRateio([], 100).ok, true);

  eq("dividir 100 em 3 fecha em 100", R.dividirIgualmente(100, 3).reduce((a, b) => R.arredonda2(a + b), 0), 100);
  eq("dividir 10 em 4", R.dividirIgualmente(10, 4), [2.5, 2.5, 2.5, 2.5]);

  /* -------------------------------------------------------------- datas --- */
  const base = new Date(2026, 7, 12); // 12/08/2026
  eq("campo vazio = hoje", D.parseDataAtalho("", base), "2026-08-12");
  eq('"hoje"', D.parseDataAtalho("hoje", base), "2026-08-12");
  eq('"+30" soma 30 dias', D.parseDataAtalho("+30", base), "2026-09-11");
  eq('"15" = dia 15 do mês', D.parseDataAtalho("15", base), "2026-08-15");
  eq('"15/09"', D.parseDataAtalho("15/09", base), "2026-09-15");
  eq('"15/09/27"', D.parseDataAtalho("15/09/27", base), "2027-09-15");
  eq('"fim" = último dia do mês', D.parseDataAtalho("fim", base), "2026-08-31");
  eq('"ontem"', D.parseDataAtalho("ontem", base), "2026-08-11");
  eq('"amanhã" com acento', D.parseDataAtalho("amanhã", base), "2026-08-13");
  eq('"31" em fevereiro vira o último dia', D.parseDataAtalho("31", new Date(2026, 1, 10)), "2026-02-28");
  eq("ISO passa direto", D.parseDataAtalho("2026-12-01", base), "2026-12-01");
  eq("texto sem sentido devolve null", D.parseDataAtalho("abcxyz", base), null);
  eq("31/02 devolve null", D.parseDataAtalho("31/02", base), null);

  console.log(falhas === 0 ? "\nTodos os testes passaram." : `\n${falhas} teste(s) falharam.`);
  process.exit(falhas ? 1 : 0);
} finally {
  rmSync(saida, { recursive: true, force: true });
}
