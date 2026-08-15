import Link from "next/link";
import { baseDoSite, paginaDoSite } from "@/lib/site-links";
import { URL_APP } from "@/lib/hosts";
import { Aurora, MockCarteira, MockConciliacao, MockFluxo, MockPortal } from "./graficos";
import { carregarPrecoConfig } from "@/lib/precos-server";
import { precoMensalBase } from "@/lib/precos";
import { brl } from "@/lib/formato";
import {
  ArrowRight,
  Banknote,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileText,
  Inbox,
  Landmark,
  Layers,
  Lock,
  MonitorSmartphone,
  Receipt,
  Repeat,
  ShieldCheck,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";

const APP = URL_APP;

/* ─────────────────────────── peças ─────────────────────────── */

function Secao({
  id,
  tag,
  titulo,
  sub,
  children,
  fundo = "branco",
}: {
  id?: string;
  tag?: string;
  titulo: string;
  sub?: string;
  children?: React.ReactNode;
  fundo?: "branco" | "cinza" | "escuro";
}) {
  const cls =
    fundo === "escuro" ? "bg-rail text-white" : fundo === "cinza" ? "bg-surface" : "bg-white";
  return (
    <section id={id} className={`${cls} scroll-mt-16 border-t border-line`}>
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        {tag && (
          <p className={`text-xs font-bold uppercase tracking-widest ${fundo === "escuro" ? "text-brand" : "text-brand"}`}>
            {tag}
          </p>
        )}
        <h2
          className={`mt-2 max-w-3xl text-2xl font-extrabold tracking-tight sm:text-3xl ${
            fundo === "escuro" ? "text-white" : "text-ink"
          }`}
        >
          {titulo}
        </h2>
        {sub && (
          <p className={`mt-3 max-w-2xl text-base ${fundo === "escuro" ? "text-white/70" : "text-ink-muted"}`}>{sub}</p>
        )}
        {children}
      </div>
    </section>
  );
}

function Recurso({ icon: Icon, titulo, children }: { icon: typeof Wallet; titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl2 border border-line bg-white p-5 shadow-card">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-brand">
        <Icon size={19} />
      </span>
      <h3 className="mt-3 text-sm font-bold text-ink">{titulo}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{children}</p>
    </div>
  );
}

function Passo({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-extrabold text-white">
        {n}
      </span>
      <div>
        <h3 className="text-sm font-bold text-ink">{titulo}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{children}</p>
      </div>
    </div>
  );
}

function Pergunta({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group border-b border-line py-4">
      <summary className="cursor-pointer list-none text-[15px] font-bold text-ink marker:hidden">
        <span className="flex items-start justify-between gap-4">
          {q}
          <span className="mt-0.5 shrink-0 text-ink-soft transition group-open:rotate-45">+</span>
        </span>
      </summary>
      <div className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-muted">{children}</div>
    </details>
  );
}

/* ─────────────────────────── página ─────────────────────────── */

/**
 * Vitrine de preço: os números que aparecem aqui.
 *
 * Calculados pelo MESMO motor que cobra (`lib/precos`), lendo a MESMA
 * configuração que a tela de assinatura lê. Escrever os valores à mão foi o
 * primeiro impulso e estava errado por quase o dobro — e uma tabela de preço
 * escrita à mão só é descoberta errada quando o cliente chega na tela de
 * pagamento e vê outro número. Aqui não há como divergir: se o preço mudar no
 * admin, a home muda junto — desde que a página continue dinâmica (ver abaixo).
 */
const VITRINE = [5, 15, 30];

/*
  `force-dynamic` não é zelo excessivo: sem ele, o `fetch` que o supabase-js faz
  por baixo herda o `force-cache` padrão do Next 14 e a tabela de preço fica
  congelada no build. A home mostraria o preço velho enquanto a tela de
  assinatura — que é `force-dynamic` — cobra o novo. Seria a mesma divergência
  de escrever os números à mão, só que mais difícil de enxergar.
*/
export const dynamic = "force-dynamic";

function pct(desc: number): string {
  return `${Math.round(desc * 100)}%`;
}

export default async function SiteHome() {
  const cfg = await carregarPrecoConfig();
  const precos = VITRINE.map((n) => {
    const mensal = precoMensalBase(n, cfg);
    return { n, mensal, unit: mensal / n };
  });
  const semestral = cfg.ciclos.find((c) => c.id === "semestral");
  const anual = cfg.ciclos.find((c) => c.id === "anual");
  const piso = cfg.piso;

  return (
    <main>
      {/* ── topo ──
          O hero escuro do site antigo, refeito: gradiente do rail, brilhos
          radiais teal/magenta, e o produto à direita numa janela de navegador.
          O mockup é a Carteira como ela é — mesmas pílulas, mesmos textos. */}
      <section className="relative overflow-hidden bg-[linear-gradient(155deg,#15212B,#0E1820)]">
        <Aurora />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-14 sm:pb-20 sm:pt-20 lg:grid-cols-[1.04fr_.96fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[.12em] text-[#5FE9D4]">
              <Layers size={13} /> Uma empresa ou uma carteira inteira
            </span>
            <h1 className="mt-6 text-3xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-[52px]">
              O financeiro inteiro sob controle — do extrato do banco à{" "}
              <span className="bg-gradient-to-r from-brand to-[#5FE9D4] bg-clip-text text-transparent">
                nota emitida
              </span>
              .
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">
              Concilie o extrato em lote, acompanhe o caixa de hoje e o dos próximos 30 dias, cobre por boleto,
              emita NFS-e e mostre ao seu cliente — ou ao seu sócio — exatamente o que está acontecendo. Sem
              planilha paralela.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={`${APP}/login`}
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-bold text-white shadow-[0_10px_30px_-8px_rgba(18,165,148,.6)] transition hover:bg-brand-dark"
              >
                Começar grátis <ArrowRight size={16} />
              </a>
              <a
                href="#o-que-faz"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-5 py-3 text-sm font-bold text-white transition hover:border-brand hover:text-[#5FE9D4]"
              >
                Ver o que faz
              </a>
            </div>
            <p className="mt-4 text-xs text-white/50">
              1 mês grátis, sem cartão · sem fidelidade · seus dados na nuvem, com backup
            </p>
          </div>

          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-6 rounded-[28px] opacity-40 blur-2xl"
              style={{ background: "radial-gradient(closest-side, rgba(18,165,148,.5), transparent 75%)" }}
            />
            <div className="relative">
              <MockCarteira />
            </div>
          </div>
        </div>

        {/* strip — os três números que eram cards brancos, agora na faixa escura */}
        <div className="relative border-t border-white/10 bg-black/20">
          <div className="mx-auto grid max-w-6xl gap-x-8 gap-y-2.5 px-5 py-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: "6 bancos", d: "com remessa e retorno CNAB" },
              { n: "1 tela", d: "para o caixa de todas as empresas" },
              { n: "0 planilha", d: "paralela para fechar o mês" },
              { n: "Portal", d: "com a sua marca, no celular do cliente" },
            ].map((k) => (
              <p key={k.n} className="text-sm text-white/55">
                <b className="mr-1.5 font-extrabold text-white">{k.n}</b>
                {k.d}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ── o problema ── */}
      <Secao
        fundo="cinza"
        tag="O problema"
        titulo="O financeiro não cabe numa planilha — e não cabe num ERP feito para outra coisa"
        sub="Quem responde pelo caixa passa o dia costurando sistemas que não conversam. O trabalho existe; o resultado é frágil."
      >
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              t: "Conciliação na unha",
              d: "Extrato de um lado, lançamentos do outro, e a tarde inteira passando linha por linha para descobrir o que já foi pago.",
            },
            {
              t: "Números que não batem",
              d: "O saldo do sistema, o do banco e o da planilha discordam — e ninguém sabe qual está certo até alguém sentar e refazer.",
            },
            {
              t: "Cobrança solta",
              d: "Boleto num lugar, nota em outro, cobrança no WhatsApp. O que foi pago e o que não foi só aparece quando o cliente reclama.",
            },
            {
              t: "Quem decide não enxerga",
              d: "O sócio, o gestor ou o cliente pede um relatório. Alguém para o que está fazendo e monta um PDF à mão.",
            },
          ].map((x) => (
            <div key={x.t} className="rounded-xl2 border border-line bg-white p-5">
              <h3 className="text-sm font-bold text-ink">{x.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{x.d}</p>
            </div>
          ))}
        </div>
      </Secao>

      {/* ── o que faz ── */}
      <Secao
        id="o-que-faz"
        tag="O ciclo completo"
        titulo="A rotina financeira inteira, sem trocar de aba"
        sub="Não é um módulo de lançamentos com relatório no fim. É o caminho do dinheiro do começo ao fim, no mesmo lugar."
      >
        {/* três telas do produto, em miniatura — a mesma linguagem do hero */}
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {[
            { m: <MockConciliacao className="h-full" />, t: "Conciliação", d: "38 de 42 linhas casadas sozinhas; a diferença de centavos fica visível para você decidir." },
            { m: <MockFluxo className="h-full" />, t: "Fluxo de caixa", d: "Entradas e saídas mês a mês, com o saldo e o resultado na mesma tela." },
            { m: <MockPortal className="h-full" />, t: "Portal do cliente", d: "O resultado do mês com a sua marca, no navegador ou instalado no celular do cliente." },
          ].map((x) => (
            <figure key={x.t} className="flex flex-col">
              <div className="flex-1">{x.m}</div>
              <figcaption className="mt-3 px-1">
                <b className="text-sm font-extrabold text-ink">{x.t}</b>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{x.d}</p>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Recurso icon={Landmark} titulo="Conciliação bancária em lote">
            Importe o extrato em OFX ou CSV — ou em PDF, que está em beta. O sistema casa o que dá para casar sozinho
            e você confirma o lote inteiro de uma vez.
          </Recurso>
          <Recurso icon={Wallet} titulo="Contas a pagar e a receber">
            Lançamentos com competência, vencimento e pagamento separados — porque o mês do resultado não é o mês do
            caixa.
          </Recurso>
          <Recurso icon={Repeat} titulo="Recorrências">
            Aluguel, mensalidade, assinatura. Cadastre uma vez; o sistema materializa o mês seguinte sem duplicar o
            que já existe.
          </Recurso>
          <Recurso icon={BarChart3} titulo="Fluxo de caixa e resultado">
            Caixa de hoje, previsão dos próximos dias e o resultado por competência — com a diferença entre os dois
            escrita na tela.
          </Recurso>
          <Recurso icon={Target} titulo="Orçado × Realizado">
            Meta por categoria comparada com o que aconteceu de verdade, mês a mês. Centro de custo tem relatório
            próprio de realizado.
          </Recurso>
          <Recurso icon={Banknote} titulo="Pagamentos por CNAB">
            Selecione as contas a pagar do dia e gere a remessa para Itaú, Banco do Brasil, Bradesco, Santander,
            Sicoob e Caixa. Cada forma sai no próprio arquivo, como o banco exige — boleto e TED nos seis; Pix, por
            enquanto, só no Itaú.
          </Recurso>
          <Recurso icon={Receipt} titulo="Cobrança por boleto">
            Boleto a partir de uma venda, de um contrato ou de um lançamento a receber, com remessa e retorno
            bancário e baixa automática.
          </Recurso>
          <Recurso icon={FileText} titulo="NFS-e">
            Emissão no padrão nacional e no de São Paulo, com reemissão e cancelamento, ligada à venda que a originou.
          </Recurso>
          <Recurso icon={Inbox} titulo="Caixa de entrada de documentos">
            O cliente envia a nota pelo portal; o sistema lê a chave, o emitente e o valor, e o documento já chega
            perto do lançamento certo.
          </Recurso>
          <Recurso icon={CalendarClock} titulo="Fechamento de mês">
            Trave a competência entregue. Depois disso, ninguém mexe no passado sem reabrir de propósito.
          </Recurso>
          <Recurso icon={Layers} titulo="Exportação contábil">
            O lançamento sai no formato do seu sistema contábil, com plano de contas e contrapartidas configurados.
          </Recurso>
          <Recurso icon={MonitorSmartphone} titulo="Portal do cliente">
            Uma página com a sua marca, onde o cliente vê o próprio resultado, o caixa e o relatório do mês — e envia
            documentos.
          </Recurso>
        </div>
      </Secao>

      {/* ── conciliação ── */}
      <Secao
        id="conciliacao"
        fundo="cinza"
        tag="Conciliação"
        titulo="Em lote, não linha por linha"
        sub="A conciliação é o gargalo de todo financeiro. É a primeira coisa que este sistema resolve de verdade."
      >
        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <div className="space-y-6">
            <Passo n={1} titulo="Importe o extrato">
              OFX ou CSV de qualquer banco; PDF em beta, com as linhas conferidas por você. O arquivo é lido no
              navegador e as linhas repetidas são reconhecidas — importar o mesmo extrato duas vezes não duplica
              nada.
            </Passo>
            <Passo n={2} titulo="O motor casa sozinho">
              Valor, data e texto. O que casa exato aparece pronto; o que casa por aproximação aparece com a
              diferença visível, para você decidir. Um pagamento pode casar com vários lançamentos e vice-versa.
            </Passo>
            <Passo n={3} titulo="Confirme o lote">
              Um clique fecha tudo que estava pronto. O que sobrou fica numa fila curta, com a razão de cada linha ter
              ficado de fora.
            </Passo>
            <Passo n={4} titulo="Ensine uma vez">
              Ao aceitar uma classificação, ela vira regra. Da próxima vez que aquele texto aparecer no extrato, ele
              já chega classificado — na empresa ou no escritório inteiro.
            </Passo>
          </div>
          <div className="rounded-xl2 border border-line bg-white p-6 shadow-card">
            <p className="text-xs font-bold uppercase tracking-widest text-brand">O que você não precisa fazer</p>
            <ul className="mt-4 space-y-3 text-sm text-ink-muted">
              {[
                "Abrir o internet banking para conferir se o pagamento entrou.",
                "Manter uma planilha paralela do que já foi conciliado.",
                "Refazer a classificação do mesmo fornecedor todo mês.",
                "Descobrir no fechamento que faltou lançar a metade do extrato.",
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-line pt-4 text-xs leading-relaxed text-ink-soft">
              Transferência entre contas próprias é reconhecida como transferência — entra e sai no mesmo lugar, sem
              inflar receita nem despesa.
            </p>
          </div>
        </div>
      </Secao>

      {/* ── multiempresa ── */}
      <Secao
        id="multiempresa"
        tag="Multiempresa"
        titulo="Feito para administrar várias empresas ao mesmo tempo"
        sub="A maioria dos sistemas foi desenhada para uma empresa e ganhou o resto depois. Aqui a carteira é o ponto de partida."
      >
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <Recurso icon={Building2} titulo="A carteira numa tela">
            Caixa, previsão, documentos novos, conciliação pendente e relatório do mês de cada empresa — lado a lado,
            com quem precisa de atenção primeiro.
          </Recurso>
          <Recurso icon={Lock} titulo="Equipe com escopo">
            Cada colaborador enxerga as empresas que são dele, e só as telas que o dono liberou. A regra vale no
            servidor, não só no menu.
          </Recurso>
          <Recurso icon={Sparkles} titulo="Padrões que se repetem">
            Modelo de plano de contas aplicado em qualquer empresa nova, regras de conciliação valendo para o
            escritório inteiro, importação de cadastros por planilha.
          </Recurso>
        </div>
        <div className="mt-6 rounded-xl2 border border-brand/25 bg-brand-light/50 p-6">
          <p className="text-sm leading-relaxed text-ink">
            <b className="font-extrabold">Serve para os dois lados.</b> Se você administra o financeiro de uma
            empresa só, tudo aqui funciona igual — a carteira simplesmente tem uma linha. Se você opera o financeiro
            de dezenas de clientes, é aqui que o dia para de ser feito de trocas de sistema.
          </p>
        </div>
      </Secao>

      {/* ── IA ── */}
      <Secao
        fundo="cinza"
        tag="Inteligência artificial"
        titulo="A IA digita por você — a conferência continua sua"
        sub="Onde ela poupa digitação, e só aí. Nenhuma delas decide nada sozinha."
      >
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Recurso icon={Sparkles} titulo="Categorização automática">
            As transações que sobraram sem par nem regra vão para a IA em lote. Ela sugere categoria e
            cliente/fornecedor; você aceita, e o aceite vira regra para sempre.
          </Recurso>
          <Recurso icon={FileText} titulo="Análise do mês">
            Um texto em português sobre o que aconteceu no mês — entradas, saídas, maiores despesas e a comparação
            com o mês anterior. Você edita antes de publicar no portal do cliente.
          </Recurso>
          <Recurso icon={Inbox} titulo="Leitura de documentos">
            Nota ou boleto que chega em PDF ou imagem tem valor, vencimento e emitente lidos para dentro do
            lançamento. Você confere os campos antes de salvar.
          </Recurso>
        </div>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-ink-muted">
          A análise é escrita a partir dos seus números, e só deles: o modelo recebe os totais do período e é
          instruído a dizer que não tem o dado em vez de preencher o vazio. Ainda assim é um modelo de linguagem, e
          a resposta é apoio — não parecer contábil. O que vai para a IA, e em que momento, está descrito na{" "}
          <Link href={paginaDoSite(baseDoSite(), "/privacidade")} className="font-semibold text-brand underline underline-offset-2">
            Política de Privacidade
          </Link>
          .
        </p>
      </Secao>

      {/* ── confiança ── */}
      <Secao
        fundo="escuro"
        tag="O que nos diferencia"
        titulo="Um sistema financeiro que não mente para você"
        sub="É a decisão de projeto mais cara que tomamos, e a que menos aparece numa lista de recursos."
      >
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div>
            <ShieldCheck className="text-brand" size={22} />
            <h3 className="mt-3 text-sm font-bold text-white">Falhou, você fica sabendo</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-white/70">
              Quando o banco de dados recusa uma gravação, a tela diz o que ficou pendente e o que fazer — em vez de
              mostrar &quot;salvo&quot; e seguir em frente. Há um verificador no projeto que percorre o código atrás
              de gravação com erro ignorado, e ele mantém uma lista aberta do que ainda falta tratar.
            </p>
          </div>
          <div>
            <CheckCircle2 className="text-brand" size={22} />
            <h3 className="mt-3 text-sm font-bold text-white">Nada cobra duas vezes</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-white/70">
              Boleto, nota, remessa bancária e faturamento de contrato têm trava de duplicidade. Quando o sistema não
              consegue ter certeza, ele para e pergunta — não emite &quot;por via das dúvidas&quot;.
            </p>
          </div>
          <div>
            <Lock className="text-brand" size={22} />
            <h3 className="mt-3 text-sm font-bold text-white">Cada um vê o que é seu</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-white/70">
              Separação por empresa no banco de dados, não só na tela. No portal, a URL sozinha não abre nada:
              o cliente entra por um link pessoal enviado ao e-mail dele, e revogar o acesso derruba na hora.
            </p>
          </div>
        </div>
      </Secao>

      {/* ── preço ── */}
      <Secao
        id="preco"
        tag="Preço"
        titulo="Você paga por empresa ativa — e quanto mais empresas, menor o preço de cada uma"
        sub="Sem taxa de implantação, sem cobrança por usuário, sem fidelidade. Crescer não vira castigo na conta."
      >
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {precos.map((p, i) => (
            <div
              key={p.n}
              className={`relative rounded-xl2 border p-6 ${
                i === 1
                  ? "border-brand bg-gradient-to-b from-brand-light/60 to-white shadow-[0_16px_40px_-16px_rgba(18,165,148,.45)]"
                  : "border-line bg-white"
              }`}
            >
              {i === 1 && (
                <span className="absolute -top-3 left-6 rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                  mais comum
                </span>
              )}
              <p className="text-sm font-bold text-ink">{p.n} empresas</p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
                {brl(p.mensal)}
                <span className="text-base font-bold text-ink-muted">/mês</span>
              </p>
              <p className="mt-1 text-sm text-ink-muted">≈ {brl(p.unit)} por empresa</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-ink-muted">
          Valores no ciclo mensal.{" "}
          {semestral && anual ? (
            <>
              O semestral sai {pct(semestral.desc)} mais barato; o anual, {pct(anual.desc)}.{" "}
            </>
          ) : null}
          Uma empresa só custa {brl(piso)} por mês — é o piso do plano, e vale para quem administra o próprio
          financeiro.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href={`${APP}/login`}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-dark"
          >
            Começar grátis <ArrowRight size={16} />
          </a>
          <span className="text-sm text-ink-muted">1 mês grátis, sem cartão. Você só assina se fizer sentido.</span>
        </div>
      </Secao>

      {/* ── FAQ ── */}
      <Secao fundo="cinza" tag="Dúvidas" titulo="Perguntas que sempre chegam">
        <div className="mt-6 max-w-4xl">
          <Pergunta q="O FinanceiroX substitui meu sistema contábil ou fiscal?">
            Não, e nem tenta. Ele cuida do financeiro — lançamentos, conciliação, caixa, cobrança, nota de serviço e
            relatórios — e exporta os lançamentos prontos para o seu sistema contábil. Os dois trabalham juntos: ele
            entrega o controle do dia a dia que o sistema contábil não foi feito para dar.
          </Pergunta>
          <Pergunta q="Funciona com o meu banco?">
            Para importar o extrato, sim: qualquer banco que exporte OFX ou CSV — e PDF, que está em beta e pede
            conferência das linhas. Para remessa e retorno bancário (pagamento e cobrança) existem layouts de Itaú,
            Banco do Brasil, Bradesco, Santander, Sicoob e Caixa. Vale um aviso que ninguém gosta de dar depois:
            todo banco exige homologar o primeiro arquivo antes de aceitar remessa em produção, e essa etapa é entre
            você e o seu gerente. O Banco do Brasil, hoje, ainda sai marcado como teste aqui.
          </Pergunta>
          <Pergunta q="Dá para emitir nota fiscal e cobrar por boleto?">
            Dá. NFS-e no padrão nacional e no de São Paulo, com reemissão e cancelamento; boleto a partir de uma
            venda, de um contrato, de um lançamento a receber ou de uma nota emitida. Tudo com trava para não emitir
            nem cobrar duas vezes, e com o retorno do banco dando baixa sozinho.
          </Pergunta>
          <Pergunta q="Preciso instalar alguma coisa?">
            Não. Roda no navegador, no computador e no celular. O portal do cliente pode ser instalado como aplicativo
            no celular dele, com a sua marca.
          </Pergunta>
          <Pergunta q="Como funciona o preço quando eu cresço?">
            Você paga por empresa ativa, com desconto por volume: as primeiras custam mais por unidade e, conforme a
            carteira cresce, o valor por empresa cai. Empresa arquivada não conta.
            {anual ? ` No plano anual, ainda economiza ${pct(anual.desc)}.` : null}
          </Pergunta>
          <Pergunta q="Meus dados e os dos meus clientes estão seguros?">
            Os dados ficam na nuvem, separados por empresa no próprio banco de dados — não é um filtro de tela, é
            regra de acesso. Cada colaborador enxerga só as empresas do escopo dele. No portal, saber a URL não
            dá acesso: o cliente entra por um link pessoal enviado ao e-mail dele, e revogar vale na hora.
            Detalhes em{" "}
            <Link href={paginaDoSite(baseDoSite(), "/seguranca")} className="font-semibold text-brand underline underline-offset-2">
              Segurança
            </Link>{" "}
            e na{" "}
            <Link href={paginaDoSite(baseDoSite(), "/privacidade")} className="font-semibold text-brand underline underline-offset-2">
              Política de Privacidade
            </Link>
            .
          </Pergunta>
          <Pergunta q="E se eu quiser sair?">
            Sem fidelidade e sem multa: você cancela quando quiser e o acesso vale até o fim do ciclo já pago.
            Depois do encerramento, seus dados ficam disponíveis para exportação por 30 dias. Nos primeiros 7 dias de
            assinatura vale o direito de arrependimento previsto no Código de Defesa do Consumidor.
          </Pergunta>
        </div>
      </Secao>

      {/* ── CTA final — fecha como o hero abriu ── */}
      <section className="relative overflow-hidden bg-[linear-gradient(155deg,#15212B,#0E1820)]">
        <Aurora />
        <div className="relative mx-auto max-w-6xl px-5 py-16 text-center sm:py-20">
          <h2 className="mx-auto max-w-2xl text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Comece hoje com a empresa que mais dá trabalho
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-white/65">
            Importe um extrato, concilie o primeiro lote e veja o caixa se formar. Leva menos tempo que fechar a
            planilha de um mês.
          </p>
          <a
            href={`${APP}/login`}
            className="mt-7 inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_-8px_rgba(18,165,148,.6)] transition hover:bg-brand-dark"
          >
            Criar minha conta grátis <ArrowRight size={16} />
          </a>
          <p className="mt-4 text-xs text-white/45">1 mês grátis · sem cartão · cancele quando quiser</p>
        </div>
      </section>
    </main>
  );
}
