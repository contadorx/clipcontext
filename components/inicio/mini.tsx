/**
 * Gráficos de tile: SVG escrito à mão, sem biblioteca.
 *
 * O `Tile` sempre teve um slot para "mini gráfico ou barra de progresso" e ele
 * nunca foi usado. Aqui ele é preenchido — mas com SVG direto, não com o
 * recharts que o resto do app usa.
 *
 * O motivo é tamanho, não gosto: recharts mede o container, monta eixos,
 * legendas e tooltip. Num quadrado de 145 × 46 px não cabe nada disso, e o
 * custo em JavaScript é o mesmo de um gráfico inteiro. Estes desenham um
 * `<path>` e param.
 *
 * Nenhum deles tem eixo, número ou legenda: **o número já está no tile**, logo
 * acima. O desenho serve para dizer a forma — se está subindo, se despencou no
 * meio, se uma faixa domina — e forma é exatamente o que um número sozinho não
 * conta.
 */
const BRAND = "#12A594";
const DANGER = "#E11D48";
const SOFT = "#CBD5E1";

/**
 * Linha do saldo ao longo do tempo.
 *
 * `corteProjecao` é o índice em que o realizado vira projeção: dali para a
 * frente a linha é tracejada, como no gráfico grande. Se o saldo cruzar o zero,
 * a linha do zero aparece em vermelho — sem ela, um mergulho para −8 mil e um
 * mergulho para 8 mil desenham igual.
 */
export function Sparkline({
  valores,
  corteProjecao,
  largura = 144,
  altura = 46,
}: {
  valores: number[];
  corteProjecao?: number;
  largura?: number;
  altura?: number;
}) {
  if (valores.length < 2) return null;

  const min = Math.min(...valores, 0);
  const max = Math.max(...valores, 0);
  const amplitude = max - min || 1;
  const px = (i: number) => (i / (valores.length - 1)) * largura;
  const py = (v: number) => altura - ((v - min) / amplitude) * altura;

  const caminho = (de: number, ate: number) =>
    valores
      .slice(de, ate + 1)
      .map((v, k) => `${k === 0 ? "M" : "L"} ${px(de + k).toFixed(1)} ${py(v).toFixed(1)}`)
      .join(" ");

  const corte = corteProjecao ?? valores.length - 1;
  const temNegativo = min < 0;
  const yZero = py(0);

  return (
    <svg width="100%" height={altura} viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none" aria-hidden>
      {temNegativo && (
        <line x1="0" y1={yZero} x2={largura} y2={yZero} stroke={DANGER} strokeWidth="1" strokeOpacity=".5" />
      )}
      <path d={caminho(0, corte)} fill="none" stroke={BRAND} strokeWidth="1.8" strokeLinejoin="round" />
      {corte < valores.length - 1 && (
        <path
          d={caminho(corte, valores.length - 1)}
          fill="none"
          stroke={BRAND}
          strokeWidth="1.8"
          strokeDasharray="3 3"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/**
 * Barras curtas — faixas de aging, meses de resultado.
 *
 * A barra que estoura o critério fica vermelha. Sem isso, cinco barras cinzas
 * pedem que alguém compare alturas de olho para achar a que importa.
 */
export function MiniBarras({
  valores,
  destaque,
  altura = 46,
}: {
  valores: number[];
  /** índices que devem sair em vermelho — atraso, mês negativo */
  destaque?: number[];
  altura?: number;
}) {
  const max = Math.max(...valores.map(Math.abs), 1);
  const marcados = new Set(destaque ?? []);
  return (
    <div className="flex items-end gap-1" style={{ height: altura }}>
      {valores.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[2px]"
          style={{
            height: `${Math.max((Math.abs(v) / max) * 100, 4)}%`,
            background: marcados.has(i) ? DANGER : v === 0 ? SOFT : BRAND,
            opacity: v === 0 ? 0.5 : 1,
          }}
        />
      ))}
    </div>
  );
}

/** Consumo de orçamento: a barra passa a vermelha quando estoura. */
export function MiniProgresso({ fracao, rotulo }: { fracao: number; rotulo?: string }) {
  const acima = fracao > 1;
  return (
    <div className="flex h-[46px] flex-col justify-end gap-1">
      {rotulo && <span className="truncate text-[10.5px] text-ink-soft">{rotulo}</span>}
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(Math.min(fracao, 1) * 100, 3)}%`,
            background: acima ? DANGER : BRAND,
          }}
        />
      </div>
      <span className={`text-[10.5px] font-semibold ${acima ? "text-danger" : "text-ink-soft"}`}>
        {Math.round(fracao * 100)}% do orçado
      </span>
    </div>
  );
}
