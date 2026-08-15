import { Lock } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/page-header";
import Card from "@/components/ui/card";
import Tabela, { LinhaTabela } from "@/components/ui/tabela";
import type { ColunaDef } from "@/components/ui/config-colunas";

export const dynamic = "force-dynamic";

/**
 * Quanto cada cliente ocupa, e quanto isso vai custar.
 *
 * Existe para o custo ser visto chegando, e não descoberto na fatura. A conta do
 * Storage é a única do app que cresce sozinha, todo mês, sem ninguém decidir
 * nada — e a decisão de esticar a retenção para 12 meses só é segura enquanto
 * alguém olha este número de vez em quando.
 *
 * Os preços são os do plano Pro do Supabase (100 GB inclusos, US$ 0,0213 por GB
 * excedente por mês). Estão escritos aqui, e não vindos de API, porque a tela
 * serve para dar ordem de grandeza — se o preço mudar, o que importa é a
 * tendência da curva, não a terceira casa decimal.
 */
const GB = 1024 ** 3;
const GB_INCLUSOS = 100;
const USD_POR_GB = 0.0213;

function tamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < GB) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / GB).toFixed(2)} GB`;
}

type Linha = {
  empresa_id: string;
  tamanho: number | null;
  tipo: string | null;
  status: string | null;
  enviado_em: string;
};

/** teto da varredura: acima disto a tela avisa que está olhando uma amostra */
const TETO = 20000;

const COLUNAS: ColunaDef[] = [
  { id: "empresa", label: "Empresa", largura: "1.6fr" },
  { id: "arquivos", label: "Arquivos", largura: "90px", alinha: "dir" },
  { id: "uso", label: "Em uso", largura: "110px", alinha: "dir" },
  { id: "xml", label: "Sendo XML", largura: "110px", alinha: "dir" },
  { id: "pct", label: "% do total", largura: "90px", alinha: "dir" },
];
const GRID = COLUNAS.map((c) => c.largura).join(" ");

export default async function ArmazenamentoPage() {
  /*
    Trava de super admin, como todas as outras páginas de /admin.

    Esta tela usa o cliente de service role, que ignora RLS por definição — sem a
    trava, qualquer usuário logado digitaria o endereço e veria nome, volume e
    participação de **todas as empresas de todos os escritórios** da plataforma.
    Não há guarda de rota em camada nenhuma: o middleware só separa logado de
    deslogado, e o layout calcula `admin` apenas para esconder o link do menu.
  */
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: adminRow } = await supabase
    .from("membros")
    .select("super_admin")
    .eq("user_id", user?.id ?? "")
    .eq("super_admin", true)
    .maybeSingle();

  if (!adminRow) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-sm rounded-xl2 bg-white p-8 text-center shadow-card">
          <Lock size={24} className="mx-auto text-ink-soft" />
          <h1 className="mt-2 text-lg font-bold text-ink">Página restrita</h1>
          <p className="mt-1 text-sm text-ink-muted">
            O uso de armazenamento é visível só para administradores.
          </p>
        </div>
      </div>
    );
  }

  const admin = createAdminClient();

  /*
    Teto na varredura, e o filtro de expurgado no banco.

    Pela matemática desta própria tela, meio milhão de documentos cabem na
    franquia — e materializar meio milhão de linhas em JSON dentro de uma função
    serverless, a cada abertura, é a mesma armadilha que o Fluxo acabou de
    perder. As linhas expurgadas, que crescem para sempre e não ocupam Storage,
    ficam fora pelo `neq` em vez de por filtro em JS.
  */
  const [{ data: docsRaw }, { data: empresasRaw }] = await Promise.all([
    admin
      .from("documentos_recebidos")
      .select("empresa_id, tamanho, tipo, status, enviado_em")
      .neq("status", "expurgado")
      .order("enviado_em", { ascending: false })
      .limit(TETO),
    admin.from("empresas").select("id, nome").limit(5000),
  ]);

  const docs = (docsRaw ?? []) as Linha[];
  const noTeto = docs.length >= TETO;
  const nomes = new Map(((empresasRaw ?? []) as { id: string; nome: string | null }[]).map((e) => [e.id, e.nome]));

  // já vêm sem os expurgados do banco: a linha fica, o arquivo não
  const vivos = docs;

  const porEmpresa = new Map<string, { bytes: number; arquivos: number; xmlBytes: number }>();
  for (const d of vivos) {
    const at = porEmpresa.get(d.empresa_id) ?? { bytes: 0, arquivos: 0, xmlBytes: 0 };
    const b = Number(d.tamanho ?? 0);
    at.bytes += b;
    at.arquivos += 1;
    if ((d.tipo ?? "").toLowerCase() === "xml") at.xmlBytes += b;
    porEmpresa.set(d.empresa_id, at);
  }

  const linhas = Array.from(porEmpresa.entries())
    .map(([id, v]) => ({ id, nome: nomes.get(id) ?? "—", ...v }))
    .sort((a, b) => b.bytes - a.bytes);

  const totalBytes = linhas.reduce((s, l) => s + l.bytes, 0);
  const totalArquivos = linhas.reduce((s, l) => s + l.arquivos, 0);
  const totalGB = totalBytes / GB;
  const excedente = Math.max(0, totalGB - GB_INCLUSOS);
  const custoMes = excedente * USD_POR_GB;

  /*
    Crescimento dos últimos 90 dias, e não "desde sempre".

    A média histórica esconde a curva: um escritório que dobrou de clientes em
    junho tem média baixa e crescimento alto, e é o crescimento que decide quando
    a franquia acaba. Sem isso, a projeção seria otimista justamente para quem
    está crescendo.
  */
  const noventaDias = Date.now() - 90 * 86400000;
  const recentes = vivos.filter((d) => new Date(d.enviado_em).getTime() >= noventaDias);
  const bytesRecentes = recentes.reduce((s, d) => s + Number(d.tamanho ?? 0), 0);
  const porMes = bytesRecentes / 3;
  const mediaArquivo = vivos.length > 0 ? totalBytes / vivos.length : 0;

  /*
    Regime permanente, e não uma reta subindo até bater no teto.

    A projeção linear ("faltam N meses para os 100 GB") ignora que o expurgo
    também tira bytes. Com retenção de 12 meses, o que não é XML **estabiliza**
    em doze meses de entrada e nunca mais cresce: um escritório que recebe 1
    GB/mês para em ~12 GB, não caminha para 100. Anunciar "restam 88 meses" ali
    seria alarme falso na única tela feita para decidir custo.

    O que cresce sem parar é o XML, porque ele nunca é expurgado — e é ele que
    define se e quando a franquia acaba.
  */
  const xmlBytes = linhas.reduce((s, l) => s + l.xmlBytes, 0);
  const xmlRecentes = recentes
    .filter((d) => (d.tipo ?? "").toLowerCase() === "xml")
    .reduce((s, d) => s + Number(d.tamanho ?? 0), 0);
  const xmlPorMes = xmlRecentes / 3;
  const regime = (porMes - xmlPorMes) * 12 + xmlBytes;
  const mesesAteFranquia = xmlPorMes > 0 ? (GB_INCLUSOS * GB - regime) / xmlPorMes : Infinity;

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Armazenamento"
        sub="Quanto cada cliente ocupa no Storage e quando a franquia acaba."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Bloco rotulo="Total em uso" valor={tamanho(totalBytes)} nota={`${totalArquivos} arquivo(s)`} />
        <Bloco rotulo="Média por arquivo" valor={tamanho(mediaArquivo)} nota="depois da compressão" />
        <Bloco rotulo="Crescimento" valor={`${tamanho(porMes)}/mês`} nota="média dos últimos 90 dias" />
        <Bloco
          rotulo="Custo hoje"
          valor={custoMes > 0 ? `US$ ${custoMes.toFixed(2)}/mês` : "US$ 0,00"}
          nota={custoMes > 0 ? `${excedente.toFixed(1)} GB além dos ${GB_INCLUSOS} inclusos` : `${GB_INCLUSOS} GB inclusos`}
          tom={custoMes > 0 ? "alerta" : "ok"}
        />
      </div>

      <Card titulo="Para onde isto vai" sub="projeção pelo ritmo dos últimos 90 dias">
        {porMes <= 0 ? (
          <p className="text-sm text-ink-muted">Sem envios nos últimos 90 dias — não dá para projetar.</p>
        ) : (
          <>
            <p className="text-sm text-ink">
              Com retenção de 12 meses, o que <b>não</b> é XML estabiliza em <b>{tamanho((porMes - xmlPorMes) * 12)}</b>{" "}
              — doze meses de entrada, entrando e saindo. Não cresce depois disso.
            </p>
            <p className="mt-1.5 text-sm text-ink">
              O que cresce sem parar é o XML, que nunca expira: <b>{tamanho(xmlPorMes)}/mês</b>. Somando os dois, o
              regime é de cerca de <b>{tamanho(regime)}</b>.
            </p>
            {mesesAteFranquia === Infinity || mesesAteFranquia > 600 ? (
              <p className="mt-1.5 text-sm text-ink-muted">
                Neste ritmo a franquia de {GB_INCLUSOS} GB não acaba num horizonte relevante.
              </p>
            ) : mesesAteFranquia <= 0 ? (
              <p className="mt-1.5 text-sm font-semibold text-danger">
                A franquia de {GB_INCLUSOS} GB já foi ultrapassada. Cada GB a mais custa US$ {USD_POR_GB.toFixed(4)}/mês.
              </p>
            ) : (
              <p className="mt-1.5 text-sm text-ink">
                Só o XML levaria <b>{Math.round(mesesAteFranquia)} meses</b> para encostar nos {GB_INCLUSOS} GB.
              </p>
            )}
          </>
        )}
        <p className="mt-2 text-[11px] leading-snug text-ink-soft">
          Documentos expurgados não entram na conta: a linha fica, o arquivo já saiu. O tamanho é o que o navegador
          informou no envio — serve para ordem de grandeza, não para auditoria de fatura.
          {noTeto && (
            <>
              {" "}
              <b className="text-amber-700">
                Amostra: a varredura para em {TETO.toLocaleString("pt-BR")} documentos, os mais recentes. Os números
                acima são um piso, não o total.
              </b>
            </>
          )}
        </p>
      </Card>

      {/*
        A <table> à mão saiu; a lista usa a `Tabela` do app. O Card em volta
        saiu junto — a Tabela já traz a própria moldura, e cartão dentro de
        cartão duplicava sombra e canto. O título virou o cabeçalho da seção.
      */}
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 px-1">
          <h2 className="text-sm font-bold text-ink">Por empresa</h2>
          <span className="text-xs text-ink-soft">{linhas.length} empresa(s) com documentos</span>
        </div>
        <Tabela
          colunas={COLUNAS}
          gridTemplate={GRID}
          larguraMinima="560px"
          vazio={{ titulo: "Nenhum documento armazenado" }}
        >
          {linhas.length > 0 &&
            linhas.map((l) => (
              <LinhaTabela key={l.id} gridTemplate={GRID}>
                <span className="truncate text-ink">{l.nome}</span>
                <span className="num text-right text-ink-muted">{l.arquivos}</span>
                <span className="num text-right font-semibold text-ink">{tamanho(l.bytes)}</span>
                <span className="num text-right text-ink-soft">{tamanho(l.xmlBytes)}</span>
                <span className="num text-right text-ink-muted">
                  {totalBytes > 0 ? `${((l.bytes / totalBytes) * 100).toFixed(1)}%` : "—"}
                </span>
              </LinhaTabela>
            ))}
        </Tabela>
      </div>
    </div>
  );
}

function Bloco({
  rotulo,
  valor,
  nota,
  tom = "ok",
}: {
  rotulo: string;
  valor: string;
  nota: string;
  tom?: "ok" | "alerta";
}) {
  return (
    <div className="rounded-xl2 bg-white p-4 shadow-card">
      <p className="text-[11px] font-semibold text-ink-soft">{rotulo}</p>
      <p className={`num mt-0.5 text-xl font-extrabold ${tom === "alerta" ? "text-danger" : "text-ink"}`}>{valor}</p>
      <p className="mt-0.5 text-[11px] text-ink-soft">{nota}</p>
    </div>
  );
}
