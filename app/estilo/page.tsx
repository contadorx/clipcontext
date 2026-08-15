"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { Plus, Trash2, Pencil, Search, Link2 } from "lucide-react";
import Botao, { BotaoIcone, BotaoLink } from "@/components/ui/botao";
import Campo, { CampoTexto, classeControle } from "@/components/ui/campo";
import Card from "@/components/ui/card";
import EmptyState from "@/components/ui/empty-state";
import MessageStrip from "@/components/ui/message-strip";
import ObjectStatus, { StatusIcone } from "@/components/ui/object-status";
import { SkeletonCartoes, SkeletonLinhas } from "@/components/ui/skeleton";
import Tabela, { LinhaTabela } from "@/components/ui/tabela";
import type { ColunaDef } from "@/components/ui/config-colunas";
import { bancadaLiberada } from "@/lib/bancada";

/**
 * Catálogo dos componentes base.
 *
 * Existe para poder **olhar**. Todo o resto da verificação deste app é
 * `tsc`, `next build` e asserções — e nenhum dos três abre uma tela. Um botão
 * com o padding errado passa nos três.
 *
 * Esta página não depende de banco nem de sessão, então roda com o app
 * desconectado: é a única parte do sistema que dá para inspecionar visualmente
 * sem credenciais.
 *
 * Não é documentação: é bancada de teste. Quando um componente ganhar variante,
 * ela entra aqui — senão a variante nasce sem ninguém nunca ter visto.
 */
const COLUNAS: ColunaDef[] = [
  { id: "venc", label: "Venc.", largura: "90px" },
  { id: "descricao", label: "Descrição", largura: "1.4fr" },
  { id: "pessoa", label: "Fornecedor", largura: "1fr" },
  { id: "situacao", label: "Situação", largura: "120px" },
  { id: "valor", label: "Valor", largura: "120px", alinha: "dir" },
];
const GRID = COLUNAS.map((c) => c.largura).join(" ");

const LINHAS = [
  {
    venc: "13/08/2026",
    d: "Aluguel do ponto comercial",
    p: "Imobiliária Prado",
    tom: "critico",
    s: "Vence hoje",
    v: "−R$ 8.400,00",
  },
  {
    venc: "15/08/2026",
    d: "Folha de pagamento — agosto",
    p: "Diversos",
    tom: "info",
    s: "Agendada",
    v: "−R$ 22.150,00",
  },
  {
    venc: "02/08/2026",
    d: "Energia elétrica",
    p: "Enel",
    tom: "negativo",
    s: "Vencido",
    v: "−R$ 3.195,60",
  },
  {
    venc: "20/08/2026",
    d: "Contrato mensal — Hotel Bela Vista",
    p: "Hotel Bela Vista",
    tom: "positivo",
    s: "Recebido",
    v: "R$ 12.500,00",
  },
] as const;

function Secao({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-ink-soft">
          {titulo}
        </h2>
        {nota && <p className="mt-0.5 text-xs text-ink-muted">{nota}</p>}
      </div>
      {children}
    </section>
  );
}

export default function EstiloPage() {
  if (!bancadaLiberada()) notFound();

  const [foco, setFoco] = useState(1);
  const [sel, setSel] = useState<Set<number>>(new Set([2]));

  return (
    <div className="min-h-screen bg-surface px-6 py-8">
      <div className="mx-auto max-w-[1100px] space-y-10">
        <header>
          <h1 className="text-xl font-bold tracking-tight text-ink">
            Componentes base
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Bancada de teste visual. Não depende de banco nem de sessão — abre
            com o app desconectado.
          </p>
        </header>

        <Secao
          titulo="Botão"
          nota="As cinco variantes que existem no app, nos dois tamanhos."
        >
          <Card titulo="Variantes">
            <div className="flex flex-wrap items-center gap-2">
              <Botao variante="primario">
                <Plus size={15} /> Primário
              </Botao>
              <Botao variante="secundario">Secundário</Botao>
              <Botao variante="discreto">Discreto</Botao>
              <Botao variante="perigo">
                <Trash2 size={15} /> Perigo
              </Botao>
              <Botao variante="neutro">Neutro (saída)</Botao>
              <BotaoLink href="/estilo" variante="secundario">
                Link com cara de botão
              </BotaoLink>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Botao variante="primario" tamanho="sm">
                <Plus size={13} /> Pequeno
              </Botao>
              <Botao variante="secundario" tamanho="sm">
                Secundário sm
              </Botao>
              <Botao variante="discreto" tamanho="sm">
                Discreto sm
              </Botao>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Botao variante="primario" disabled>
                Desabilitado
              </Botao>
              <Botao variante="secundario" disabled>
                Desabilitado
              </Botao>
              <Botao variante="perigo" disabled>
                Desabilitado
              </Botao>
              <BotaoIcone rotulo="Editar">
                <Pencil size={15} />
              </BotaoIcone>
              <BotaoIcone rotulo="Excluir" variante="perigo">
                <Trash2 size={15} />
              </BotaoIcone>
            </div>

            <div className="mt-4">
              <Botao variante="primario" largura>
                Largura total (rodapé de diálogo)
              </Botao>
            </div>
          </Card>
        </Secao>

        <Secao
          titulo="Campo"
          nota="Duas alturas: md em formulário, sm em barra de filtros."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Card titulo="Formulário (md)">
              <div className="space-y-3">
                <CampoTexto
                  id="c1"
                  rotulo="Nome"
                  obrigatorio
                  placeholder="Padaria Aurora Ltda"
                />
                <CampoTexto
                  id="c2"
                  rotulo="CNPJ"
                  ajuda="Só números; a máscara é aplicada ao digitar."
                  placeholder="00.000.000/0000-00"
                />
                <CampoTexto
                  id="c3"
                  rotulo="E-mail"
                  erro="Informe um e-mail válido."
                  defaultValue="contato@"
                />
                <CampoTexto
                  id="c4"
                  rotulo="Código contábil"
                  disabled
                  defaultValue="1.1.02.001"
                />
                <Campo rotulo="Observações" htmlFor="c5">
                  <textarea id="c5" rows={2} className={classeControle("md")} />
                </Campo>
              </div>
            </Card>

            <Card titulo="Barra de filtros (sm)">
              <div className="flex flex-wrap items-end gap-3">
                <Campo rotulo="De" tamanho="sm" className="min-w-[140px]">
                  <input
                    type="date"
                    defaultValue="2026-08-01"
                    className={classeControle("sm", false, "num")}
                  />
                </Campo>
                <Campo rotulo="Até" tamanho="sm" className="min-w-[140px]">
                  <input
                    type="date"
                    defaultValue="2026-08-31"
                    className={classeControle("sm", false, "num")}
                  />
                </Campo>
                <Campo rotulo="Buscar" tamanho="sm" className="min-w-[200px]">
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft"
                    />
                    <input
                      placeholder="Descrição"
                      className={classeControle("sm", false, "pl-8")}
                    />
                  </div>
                </Campo>
                <Campo rotulo="Situação" tamanho="sm" className="min-w-[160px]">
                  <select className={classeControle("sm")}>
                    <option>Todas</option>
                    <option>Vencidas</option>
                  </select>
                </Campo>
              </div>
            </Card>
          </div>
        </Secao>

        <Secao
          titulo="Object status"
          nota="Cor é significado. Saída e despesa são neutras — dado, não alarme."
        >
          <Card titulo="Marcador + texto, e pílula">
            <div className="flex flex-wrap items-center gap-4">
              <ObjectStatus tom="positivo">Efetivada</ObjectStatus>
              <ObjectStatus tom="negativo">Vencido</ObjectStatus>
              <ObjectStatus tom="critico">Vence hoje</ObjectStatus>
              <ObjectStatus tom="info">Agendada</ObjectStatus>
              <ObjectStatus tom="neutro">Previsto</ObjectStatus>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <ObjectStatus pilula tom="positivo">
                liquidado
              </ObjectStatus>
              <ObjectStatus pilula tom="negativo">
                rejeitada
              </ObjectStatus>
              <ObjectStatus pilula tom="critico">
                homologação
              </ObjectStatus>
              <ObjectStatus pilula tom="info">
                em remessa
              </ObjectStatus>
              <ObjectStatus pilula tom="neutro">
                gerado
              </ObjectStatus>
              <StatusIcone tom="positivo" title="Conciliado">
                <Link2 size={11} />
              </StatusIcone>
            </div>
          </Card>
        </Secao>

        <Secao titulo="Aviso">
          <div className="space-y-2">
            <MessageStrip tipo="erro">
              Não foi possível salvar: a competência está fechada.
            </MessageStrip>
            <MessageStrip tipo="alerta">
              Esta conta tem mais de 1.200 itens pendentes. A tela está
              trabalhando com os mais recentes.
            </MessageStrip>
            <MessageStrip tipo="ok">
              18 conciliações aplicadas e 3 regras novas aprendidas.
            </MessageStrip>
            <MessageStrip tipo="info" fechavel>
              O rateio não duplica o lançamento — só o relatório por centro
              enxerga a divisão.
            </MessageStrip>
          </div>
        </Secao>

        <Secao
          titulo="Tabela"
          nota="Cabeçalho grudento, foco de teclado e seleção como estados distintos."
        >
          <Tabela colunas={COLUNAS} gridTemplate={GRID} larguraMinima="720px">
            {LINHAS.map((l, i) => (
              <LinhaTabela
                key={l.d}
                gridTemplate={GRID}
                emFoco={foco === i}
                selecionada={sel.has(i)}
                onClick={() => setFoco(i)}
              >
                <span className="num text-ink-muted">{l.venc}</span>
                <span className="truncate font-medium text-ink">{l.d}</span>
                <span className="truncate text-ink-muted">{l.p}</span>
                <ObjectStatus tom={l.tom}>{l.s}</ObjectStatus>
                <span
                  className={`num text-right font-semibold ${l.v.startsWith("−") ? "text-ink" : "text-brand-dark"}`}
                >
                  {l.v}
                </span>
              </LinhaTabela>
            ))}
          </Tabela>
          <div className="flex gap-2">
            <Botao
              tamanho="sm"
              onClick={() => setSel(new Set(sel.size ? [] : [0, 1, 2, 3]))}
            >
              Alternar seleção
            </Botao>
          </div>
        </Secao>

        <Secao titulo="Carregando e vazio">
          <div className="grid gap-4 md:grid-cols-2">
            <Card titulo="Carregando" corpoSemPadding>
              <SkeletonLinhas linhas={4} colunas={4} />
            </Card>
            <Card titulo="Vazio por filtro">
              <EmptyState
                filtrado
                titulo="Nenhuma movimentação neste período"
                descricao="Amplie o intervalo de datas."
              />
            </Card>
            <Card titulo="Vazio de começo">
              <EmptyState
                titulo="Nenhum serviço cadastrado"
                descricao="O catálogo alimenta as vendas e os contratos."
                acao={
                  <Botao variante="primario" tamanho="sm">
                    <Plus size={13} /> Cadastrar o primeiro
                  </Botao>
                }
              />
            </Card>
            <Card titulo="Vazio compacto (painel)">
              <EmptyState compacto titulo="Nenhuma conta cadastrada" />
            </Card>
          </div>
          <SkeletonCartoes n={4} />
        </Secao>
      </div>
    </div>
  );
}
