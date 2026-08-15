import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  competenciaAtual,
  addMesCompetencia,
  vencimentoNaCompetencia,
  competenciasAMaterializar,
  type RecorrenciaViva,
} from "@/lib/recorrencias/datas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Materializa o próximo mês de cada recorrência viva com 1 mês de
// antecedência (a competência atual + a próxima já entram como previstos).
// Idempotente: usa ultima_competencia/proxima_competencia como cursor, e
// não duplica se rodar duas vezes no mesmo dia.

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  /*
    Sem `CRON_SECRET` configurado, esta linha era um `if` que nunca entrava: a
    ausência da variável liberava a rota para qualquer um. Enquanto o middleware
    devolvia 307 para o login em tudo que era `/api`, uma segunda fechadura
    escondia o problema — e ela foi removida de propósito, porque quebrava o
    webhook do Asaas e os próprios crons. Sem segredo, ninguém entra: um GET
    anônimo em `/api/cron/expurgo-documentos` apagaria documento de todas as
    contas.
  */
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const atual = competenciaAtual();
  const limite = addMesCompetencia(atual, 1); // lookahead de 1 mês

  const { data: recs, error } = await admin
    .from("recorrencias")
    .select(
      "id, empresa_id, tipo, valor, descricao, categoria_id, conta_id, cliente_fornecedor_id, centro_custo_id, dia_vencimento, ativa, ultima_competencia, proxima_competencia, fim",
    )
    .eq("ativa", true)
    .lte("proxima_competencia", limite);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let criados = 0;
  let recorrenciasTocadas = 0;
  const encerradas: string[] = [];

  for (const rRaw of (recs ?? []) as RecorrenciaViva[]) {
    const comps = competenciasAMaterializar(rRaw, limite);
    if (comps.length === 0) {
      // passou do fim → desativa
      if (rRaw.fim) {
        // se a desativação não grava, a recorrência já vencida volta a ser
        // lida em toda execução do cron — para sempre, sem gerar nada e sem
        // aparecer em lugar nenhum
        const off = await admin.from("recorrencias").update({ ativa: false }).eq("id", rRaw.id);
        if (off.error) console.error("recorrencias: não desativou recorrência encerrada", { id: rRaw.id, erro: off.error.message });
        else encerradas.push(rRaw.id);
      }
      continue;
    }

    /*
      Última competência que ficou realmente gravada.

      O cursor avançava para o fim do intervalo mesmo quando um insert falhava,
      e `competenciasAMaterializar` parte de `proxima_competencia` — então a
      competência perdida nunca mais era tentada. O aluguel de outubro
      simplesmente não existia, com o cron devolvendo `ok: true`. Agora o cursor
      só passa por cima do que confirmou.
    */
    let ultimaOk: string | null = null;
    for (const comp of comps) {
      const venc = vencimentoNaCompetencia(comp, rRaw.dia_vencimento);
      // proteção anti-duplicação: já existe lançamento desta recorrência nesta competência?
      const dup = await admin
        .from("lancamentos")
        .select("id")
        .eq("recorrencia_viva_id", rRaw.id)
        .eq("data_competencia", comp)
        .maybeSingle();
      /*
        A checagem que barra a duplicação não pode falhar aberta: com o erro
        descartado, `ja` virava null e o insert acontecia de novo. Sem saber se
        já existe, o certo é não criar — o próximo ciclo do cron tenta de novo.
      */
      if (dup.error) {
        console.error("recorrencias: checagem anti-duplicação falhou", { id: rRaw.id, comp, erro: dup.error.message });
        break;
      }
      if (dup.data) {
        ultimaOk = comp;
        continue;
      }

      const { error: errIns } = await admin.from("lancamentos").insert({
        empresa_id: rRaw.empresa_id,
        tipo: rRaw.tipo,
        valor: rRaw.valor,
        descricao: rRaw.descricao,
        categoria_id: rRaw.categoria_id,
        conta_id: rRaw.conta_id,
        cliente_fornecedor_id: rRaw.cliente_fornecedor_id,
        centro_custo_id: rRaw.centro_custo_id,
        data_competencia: comp,
        data_vencimento: venc,
        data_pagamento: null,
        transferencia: false,
        recorrencia_viva_id: rRaw.id,
      });
      if (errIns) {
        console.error("recorrencias: lançamento não criado", { id: rRaw.id, comp, erro: errIns.message });
        break;
      }
      criados++;
      ultimaOk = comp;
    }

    // avança o cursor para o mês seguinte ao último materializado COM SUCESSO;
    // se nada passou, o cursor fica onde está e o próximo ciclo tenta de novo
    if (!ultimaOk) continue;
    const ultima = ultimaOk;
    const proxima = addMesCompetencia(ultima, 1);
    const updates: Record<string, unknown> = {
      ultima_competencia: ultima,
      proxima_competencia: proxima,
      atualizado_em: new Date().toISOString(),
    };
    // se já passou do fim, desativa
    const encerra = Boolean(rRaw.fim && proxima.slice(0, 7) > rRaw.fim.slice(0, 7));
    if (encerra) updates.ativa = false;
    /*
      Avanço do marcador da recorrência.

      Se não gravar, a recorrência é lida de novo na próxima execução do cron e
      as mesmas competências são reprocessadas. Não duplica lançamento — a
      checagem por `recorrencia_viva_id` + competência, logo acima, barra —
      mas gira sem sair do lugar todo dia, e `ativa: false` fica pendurado: uma
      recorrência que devia ter terminado continua sendo varrida para sempre.
      O contador só sobe quando a gravação confirma, senão o retorno do cron
      diz que processou o que não processou.
    */
    const av = await admin.from("recorrencias").update(updates).eq("id", rRaw.id);
    if (av.error) {
      console.error("recorrencias: marcador não avançou", { id: rRaw.id, erro: av.error.message });
      continue;
    }
    // `encerradas` só depois da confirmação: era empilhado antes da gravação e
    // o cron relatava como encerrada uma recorrência que continuava ativa
    if (encerra) encerradas.push(rRaw.id);
    recorrenciasTocadas++;
  }

  return NextResponse.json({
    ok: true,
    competencia_atual: atual,
    lancamentos_criados: criados,
    recorrencias_processadas: recorrenciasTocadas,
    encerradas: encerradas.length,
  });
}
