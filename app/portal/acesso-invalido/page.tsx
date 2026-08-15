export const dynamic = "force-dynamic";

/*
  Duas causas, duas mensagens.

  "Link inválido, peça outro" para uma falha de CONFIGURAÇÃO nossa cria um laço
  que o cliente não consegue quebrar: ele pede, recebe um link novo, e ele
  também não funciona. A página do portal já tratava isso com
  `PortalIndisponivel`; o consumo do magic link acontece antes dela, e por isso
  precisa da mesma distinção aqui.

  `?motivo=config` é escrito só pela rota de entrada, quando falta a chave de
  serviço. Sem o parâmetro, a mensagem é a de sempre — que é a causa comum.
*/
export default function AcessoInvalido({
  searchParams,
}: {
  searchParams?: { motivo?: string };
}) {
  const config = searchParams?.motivo === "config";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F1F5F9",
        padding: 24,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          background: "#fff",
          border: "1px solid #E2E8F0",
          borderRadius: 16,
          padding: 28,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            background: config ? "#FEF3C7" : "#FEF2F2",
            color: config ? "#B45309" : "#DB2777",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            fontSize: 24,
            fontWeight: 800,
          }}
        >
          !
        </div>
        <h1 style={{ margin: "0 0 8px", fontSize: 20, color: "#0F172A" }}>
          {config ? "Portal temporariamente indisponível" : "Link inválido ou expirado"}
        </h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#334155" }}>
          {config
            ? "Não é problema do seu link — ele continua válido. Há uma configuração pendente do lado do sistema. Avise o seu contador; pedir um link novo não vai resolver."
            : "Este link de acesso já foi usado ou passou da validade. Cada link é pessoal e vale por 24 horas. Peça um novo acesso à sua contabilidade."}
        </p>
      </div>
    </div>
  );
}
