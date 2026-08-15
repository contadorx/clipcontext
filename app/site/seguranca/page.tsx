import type { Metadata } from "next";
import { DocumentoLegal, Itens, Secao } from "../documento-legal";

export const metadata: Metadata = {
  title: "Segurança",
  description:
    "Como o FinanceiroX protege dados financeiros: isolamento por conta no banco de dados, criptografia, controle de acesso por papel, backups e o que fazemos em caso de incidente.",
  alternates: { canonical: "/seguranca" },
};

const SECOES = [
  { id: "isolamento", titulo: "Isolamento entre contas" },
  { id: "criptografia", titulo: "Criptografia" },
  { id: "acesso", titulo: "Controle de acesso" },
  { id: "portal", titulo: "Portal do cliente" },
  { id: "dinheiro", titulo: "O que o sistema não faz com dinheiro" },
  { id: "acesso-interno", titulo: "Acesso da nossa equipe" },
  { id: "backups", titulo: "Backups e continuidade" },
  { id: "infra", titulo: "Infraestrutura e fornecedores" },
  { id: "desenvolvimento", titulo: "Como o software é alterado" },
  { id: "incidentes", titulo: "Incidentes" },
  { id: "reportar", titulo: "Como reportar uma vulnerabilidade" },
  { id: "roadmap", titulo: "O que ainda não temos" },
];

export default function SegurancaPage() {
  return (
    <DocumentoLegal
      titulo="Segurança"
      resumo="O que protege os seus dados aqui dentro, descrito sem rodeio — inclusive o que ainda não existe. O item 12 é a lista do que está no roteiro e não pode ser vendido como pronto."
      secoes={SECOES}
    >
      <Secao id="isolamento" n={1} titulo="Isolamento entre contas">
        <p>
          O isolamento não depende do código da aplicação lembrar de filtrar. Ele é imposto pelo próprio
          banco de dados, com <strong>Row Level Security</strong>: cada linha carrega a qual conta e a qual
          empresa pertence, e a política do banco recusa a leitura de qualquer linha fora da conta de quem
          está autenticado.
        </p>
        <p>
          A diferença prática: uma consulta escrita errado por nós não vira vazamento de dados de outro
          cliente — ela simplesmente não retorna nada. A trava está uma camada abaixo do lugar onde os erros
          acontecem.
        </p>
      </Secao>

      <Secao id="criptografia" n={2} titulo="Criptografia">
        <Itens>
          <li>
            <strong>Em trânsito</strong>: todo o tráfego usa TLS. O acesso por HTTP simples é redirecionado.
          </li>
          <li>
            <strong>Em repouso</strong>: banco de dados e arquivos armazenados são criptografados em disco
            pelo provedor de infraestrutura.
          </li>
          <li>
            <strong>Senhas</strong>: nunca são armazenadas em texto. Guardamos apenas o hash, e ele não
            permite recuperar a senha original — nem por nós.
          </li>
        </Itens>
      </Secao>

      <Secao id="acesso" n={3} titulo="Controle de acesso">
        <p>
          Cada pessoa tem login próprio. Dentro da conta há papéis distintos, e as ações que mexem em
          dinheiro ou apagam histórico — zerar uma empresa, alterar assinatura, remover usuários — são
          verificadas no servidor, não apenas escondidas na tela.
        </p>
        <p>
          Essa distinção importa: esconder um botão no navegador não protege nada, porque a requisição pode
          ser feita sem passar pela tela. A verificação de papel acontece no mesmo lugar onde a alteração é
          gravada.
        </p>
        <p>
          Sobre o cookie de sessão, vale a precisão em vez do slogan: o do <strong>app</strong> é lido pela
          biblioteca de autenticação dentro do navegador, então <strong>não</strong> é{" "}
          <code className="rounded bg-surface px-1 text-[13px]">HttpOnly</code> — é assinado, expira e é
          revogado no logout, mas quem executasse JavaScript na página conseguiria lê-lo. Os cookies do{" "}
          <strong>portal do cliente</strong> e o de sessão de suporte, esses sim, são{" "}
          <code className="rounded bg-surface px-1 text-[13px]">HttpOnly</code>.
        </p>
      </Secao>

      <Secao id="portal" n={4} titulo="Portal do cliente">
        <p>
          A URL do portal, sozinha, não abre nada: quem chega nela sem sessão vê a tela de acesso. A
          credencial é um link de uso pessoal enviado por e-mail, válido por 24 horas, que estabelece uma
          sessão daquele portal — validada no servidor a cada requisição e derrubada na hora quando o
          usuário é desativado. Dito de forma direta: não há senha, então quem tiver acesso à caixa de
          e-mail do destinatário dentro dessas 24 horas entra.
        </p>
        <p>
          Os dados exibidos no portal são lidos por um caminho privilegiado no servidor, atrás dessa
          verificação de sessão. Não há como consultá-los a partir do navegador sem estar autenticado
          naquele portal específico.
        </p>
        <p>
          Cada entrada no portal e cada documento enviado pelo cliente ficam registrados, com data e autor.
          O portal é de leitura e envio; não há download de documento por lá.
        </p>
      </Secao>

      <Secao id="dinheiro" n={5} titulo="O que o sistema não faz com dinheiro">
        <p>Boa parte da segurança de um financeiro está no que o software deliberadamente não pode fazer:</p>
        <Itens>
          <li>Não temos acesso às suas contas bancárias. Extratos entram por arquivo importado por você.</li>
          <li>
            Não enviamos ordens de pagamento ao banco. Geramos o arquivo CNAB; quem envia e aprova, no canal
            do próprio banco, é você.
          </li>
          <li>
            Não custodiamos valores. O boleto que você emite é registrado no <strong>seu</strong> banco, por
            arquivo de remessa, e o dinheiro cai na sua conta — sem passar por nós em momento algum.
          </li>
        </Itens>
        <p>
          A consequência é direta: um comprometimento da plataforma não move dinheiro sozinho — ainda seria
          preciso passar pela aprovação no banco.
        </p>
      </Secao>

      <Secao id="acesso-interno" n={6} titulo="Acesso da nossa equipe">
        <p>
          Existe uma função de suporte que permite a um administrador nosso assumir a sessão do titular de
          uma conta para diagnosticar um problema que não se reproduz de fora. É restrito a administradores
          do FinanceiroX, com a verificação feita no servidor, e o acesso registra quem, qual conta e
          quando. Esse registro ainda não bloqueia o acesso quando falha ao gravar — está no item 12.
        </p>
        <p>
          Está escrito aqui pelo mesmo motivo do item 12: uma página de segurança que só lista o que protege,
          e omite quem consegue entrar, não está descrevendo o sistema.
        </p>
      </Secao>

      <Secao id="backups" n={7} titulo="Backups e continuidade">
        <p>
          O banco de dados tem backup automático diário, com retenção conforme o plano de infraestrutura
          (até 30 dias) e possibilidade de restauração a ponto no tempo.
        </p>
        <p>
          Independentemente disso, você tira os seus dados da plataforma sem pedir para ninguém: relatórios e
          extrato de conta em CSV, e os lançamentos no layout do seu sistema contábil. O que ainda não existe
          na tela é a exportação integral da base numa operação só; até existir, ela é atendida por pedido ao
          suporte. Está escrito aqui porque backup que depende de pedir ao fornecedor é backup que não
          existe no dia em que ele é preciso — e essa parte, hoje, ainda depende de pedir.
        </p>
      </Secao>

      <Secao id="infra" n={8} titulo="Infraestrutura e fornecedores">
        <p>
          A aplicação roda em infraestrutura gerenciada, com atualização de sistema operacional e patches de
          segurança a cargo do provedor. O banco de dados é gerenciado, com atualizações aplicadas pelo
          fornecedor.
        </p>
        <p>
          Chaves de serviço e segredos ficam em variáveis de ambiente do servidor, nunca no código enviado
          ao navegador, e são rotacionáveis sem alteração de código.
        </p>
      </Secao>

      <Secao id="desenvolvimento" n={9} titulo="Como o software é alterado">
        <p>
          Cada versão passa por checagem de tipos, build completo, testes das regras de cálculo e uma
          verificação que percorre o código atrás de gravações no banco cujo erro esteja sendo ignorado. Hoje
          essas quatro rodam como parte do processo de publicação, não como trava automática de repositório —
          amarrá-las a um pipeline que barre a publicação é item do roteiro (ver 12).
        </p>
        <p>
          Essa última existe por um motivo aprendido na prática: a biblioteca que usamos não interrompe a
          execução quando o banco recusa uma gravação — ela devolve o erro em um campo que é fácil não ler.
          Código que ignora esse campo silenciosamente dá a impressão de que gravou. Em um sistema
          financeiro, isso é a diferença entre &quot;pago&quot; e &quot;acha que pagou&quot;.
        </p>
      </Secao>

      <Secao id="incidentes" n={10} titulo="Incidentes">
        <p>
          Em caso de incidente com risco relevante, comunicamos os clientes afetados em até{" "}
          <strong>72 horas</strong> da confirmação, com o que já se sabe: o que aconteceu, quais dados foram
          envolvidos, o que foi contido e o que recomendamos fazer. Autoridades e titulares são comunicados
          quando a lei exigir.
        </p>
        <p>
          Não esperamos ter todas as respostas para avisar. Avisamos com o que temos e atualizamos depois.
        </p>
      </Secao>

      <Secao id="reportar" n={11} titulo="Como reportar uma vulnerabilidade">
        <p>
          Se você encontrou algo, escreva para{" "}
          <a className="font-semibold text-brand hover:underline" href="mailto:seguranca@financeirox.com.br">
            seguranca@financeirox.com.br
          </a>{" "}
          com a descrição e os passos para reproduzir. Respondemos em até 3 dias úteis.
        </p>
        <p>
          Pedimos que a análise se limite a contas de sua própria titularidade e que não haja acesso, cópia
          ou alteração de dados de terceiros. Reportes feitos de boa-fé, dentro desses limites, não geram
          medida de nossa parte.
        </p>
      </Secao>

      <Secao id="roadmap" n={12} titulo="O que ainda não temos">
        <p>
          Um item de segurança que está no roteiro não é um item entregue. Hoje{" "}
          <strong>não oferecemos</strong>:
        </p>
        <Itens>
          <li>Autenticação em dois fatores (MFA) — está no roteiro.</li>
          <li>Login corporativo via SSO/SAML.</li>
          <li>Certificação SOC 2 ou ISO 27001. Não somos certificados e não afirmamos ser.</li>
          <li>Teste de intrusão por empresa independente com relatório publicado.</li>
          <li>
            Trilha de auditoria completa de todas as alterações. Hoje existem registros específicos — entrada
            e envio no portal, uso da função de suporte, remessas geradas, envios de cobrança —, não um
            histórico de toda alteração.
          </li>
          <li>
            Pipeline que barre a publicação quando uma verificação falha (as verificações existem; a trava
            automática não).
          </li>
          <li>Exportação integral da base em uma operação, pela própria tela.</li>
          <li>Registro bloqueante do acesso de suporte: hoje ele é gravado, mas não impede o acesso se falhar.</li>
          <li>Cancelamento da assinatura pela própria tela (hoje é por e-mail).</li>
        </Itens>
        <p>
          Se algum desses itens é requisito do seu processo de compras, fale conosco antes de contratar —
          preferimos dizer &quot;ainda não&quot; agora do que na renovação.
        </p>
      </Secao>
    </DocumentoLegal>
  );
}
