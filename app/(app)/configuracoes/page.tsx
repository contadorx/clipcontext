import Link from "next/link";
import {
  Landmark,
  BellRing,
  Briefcase,
  BadgeCheck,
  Tags,
  Users,
  Building2,
  Building,
  Calculator,
  FileDown,
  Palette,
  Target,
  MonitorSmartphone,
  CreditCard,
  ClipboardList,
  Banknote,
  Repeat,
  Lock,
  Sun,
  Send,
  Upload,
} from "lucide-react";
import { getEmpresaContext } from "@/lib/empresa";
import { createClient } from "@/lib/supabase/server";
import ZonaPerigo from "@/components/cadastros/zona-perigo";
import PageHeader from "@/components/ui/page-header";

type Item = {
  href: string;
  titulo: string;
  desc: string;
  icon: typeof Landmark;
};

const escritorio: Item[] = [
  { href: "/configuracoes/assinatura", titulo: "Assinatura", desc: "Plano, ciclo (mensal/semestral/anual) e valor por volume.", icon: CreditCard },
  { href: "/configuracoes/marca", titulo: "Marca do escritório", desc: "Nome e logo no app e no portal do cliente.", icon: Palette },
  { href: "/configuracoes/modelos-plano-contas", titulo: "Modelos de plano de contas", desc: "Padrões de grupos e categorias para reaproveitar entre empresas.", icon: ClipboardList },
];

const estruturaFinanceira: Item[] = [
  { href: "/configuracoes/empresa", titulo: "Dados da empresa", desc: "Identificação e dados fiscais, com preenchimento por CNPJ.", icon: Building },
  { href: "/importar", titulo: "Importar dados", desc: "Trazer cadastros e lançamentos de planilha ou de outro sistema.", icon: Upload },
  { href: "/configuracoes/contas-bancarias", titulo: "Contas bancárias", desc: "Contas, dados bancários e cobrança (CNAB) num lugar só.", icon: Landmark },
  { href: "/configuracoes/categorias", titulo: "Categorias", desc: "As categorias de receita e despesa desta empresa.", icon: Tags },
  { href: "/configuracoes/servicos", titulo: "Serviços", desc: "Catálogo vendido nas vendas e contratos, com dados fiscais da NFS-e.", icon: Briefcase },
  { href: "/configuracoes/centros-custo", titulo: "Centros de custo", desc: "Para ratear por área ou projeto.", icon: Building2 },
  { href: "/configuracoes/orcamento", titulo: "Orçamento", desc: "Meta orçada por categoria e mês (Orçado × Realizado).", icon: Target },
  { href: "/configuracoes/recorrencias", titulo: "Recorrências", desc: "Lançamentos que se repetem todo mês — aluguel, mensalidades, assinaturas.", icon: Repeat },
];

const contabilBancario: Item[] = [
  { href: "/configuracoes/contabil", titulo: "Configurações contábeis", desc: "Sistema contábil e plano de contas para a exportação.", icon: Calculator },
  { href: "/configuracoes/exportar-contabil", titulo: "Exportação contábil", desc: "Gerar o arquivo de lançamentos para o sistema contábil.", icon: FileDown },
  { href: "/configuracoes/nfse", titulo: "Nota fiscal (NFS-e)", desc: "Dados do emitente e certificado A1 para a NFS-e Nacional.", icon: BadgeCheck },
  { href: "/configuracoes/lembretes-boletos", titulo: "Lembretes de boletos", desc: "E-mail automático ao cliente: antes, no dia e após o vencimento.", icon: BellRing },
  { href: "/arquivos-bancarios", titulo: "Arquivos bancários (CNAB)", desc: "Histórico de remessas de pagamento e cobrança, com 2ª via.", icon: Banknote },
  { href: "/configuracoes/fechamento", titulo: "Fechamento de mês", desc: "Proteja competências entregues contra alterações.", icon: Lock },
  { href: "/configuracoes/resumo-diario", titulo: "Resumo diário por e-mail", desc: "Receba a fotografia da carteira toda manhã.", icon: Sun },
  { href: "/configuracoes/resumo-socio", titulo: "Resumo financeiro ao sócio", desc: "Envie ao sócio de cada empresa um resumo diário, semanal, quinzenal ou mensal.", icon: Send },
];

const acessoPortal: Item[] = [
  { href: "/configuracoes/colaboradores", titulo: "Colaboradores", desc: "Equipe, funções e acesso por empresa.", icon: Users },
  { href: "/configuracoes/portal", titulo: "Portal do cliente", desc: "Link e o que o cliente vê do resumo financeiro.", icon: MonitorSmartphone },
];

function Card({ href, titulo, desc, icon: Icon }: Item) {
  return (
    <Link href={href}>
      <div className="h-full rounded-xl2 bg-white p-4 shadow-card transition hover:border-brand">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-brand">
          <Icon size={20} />
        </div>
        <h2 className="mt-3 text-sm font-bold text-ink">{titulo}</h2>
        <p className="mt-1 text-xs text-ink-muted">{desc}</p>
      </div>
    </Link>
  );
}

function Secao({ titulo, descricao, itens }: { titulo: string; descricao: string; itens: Item[] }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">{titulo}</h2>
        <p className="text-xs text-ink-muted">{descricao}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {itens.map((i) => (
          <Card key={i.titulo} {...i} />
        ))}
      </div>
    </section>
  );
}

export default async function ConfiguracoesPage() {
  const supabase = createClient();
  const { atual } = await getEmpresaContext();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let podeApagar = false;
  if (user && atual) {
    const { data: esc } = await supabase.from("escritorios").select("id").limit(1).maybeSingle();
    const { data: membro } = await supabase
      .from("membros")
      .select("papel")
      .eq("user_id", user.id)
      .eq("escritorio_id", esc?.id ?? "")
      .maybeSingle();
    const papel = (membro?.papel as string) ?? "";
    podeApagar = papel === "owner" || papel === "admin";
  }

  return (
    <div className="space-y-8">
      <PageHeader titulo="Configurações" sub="Escritório, empresa selecionada e integrações." />

      <Secao
        titulo="Escritório"
        descricao="Valem para todo o escritório, independente da empresa selecionada."
        itens={escritorio}
      />
      <Secao
        titulo="Empresa · estrutura financeira"
        descricao="Da empresa selecionada no topo: contas, plano de categorias e orçamento."
        itens={estruturaFinanceira}
      />
      <Secao
        titulo="Empresa · contábil e fiscal"
        descricao="Integração com o sistema contábil e emissão de NFS-e."
        itens={contabilBancario}
      />
      <Secao
        titulo="Empresa · acesso e portal"
        descricao="Quem acessa a empresa e o que o cliente vê no portal."
        itens={acessoPortal}
      />

      {podeApagar && atual && <ZonaPerigo empresaId={atual.id} empresaNome={atual.nome} />}
    </div>
  );
}
