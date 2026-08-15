// Mantém as telas voltadas ao cliente final em 100% (neutraliza o zoom global do app).
export default function TelaClienteLayout({ children }: { children: React.ReactNode }) {
  return <div className="tela-cliente">{children}</div>;
}
