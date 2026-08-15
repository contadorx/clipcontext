import type { Metadata } from "next";
import { DocumentoLegal, Itens, Secao } from "../documento-legal";
import { ancoraDoSite, baseDoSite, paginaDoSite } from "@/lib/site-links";

export const metadata: Metadata = {
  title: "Termos de uso",
  description:
    "Condições de uso do FinanceiroX: contratação, planos, pagamentos, responsabilidades sobre CNAB, boleto e NFS-e, suporte, cancelamento e exportação de dados.",
  alternates: { canonical: "/termos" },
};

const SECOES = [
  { id: "aceite", titulo: "Aceite destes termos" },
  { id: "definicoes", titulo: "Definições" },
  { id: "servico", titulo: "O que o FinanceiroX faz" },
  { id: "conta", titulo: "Cadastro, conta e acesso" },
  { id: "usuarios", titulo: "Usuários, papéis e portal do cliente" },
  { id: "planos", titulo: "Planos, empresas e cobrança" },
  { id: "pagamento", titulo: "Pagamento, atraso e suspensão" },
  { id: "teste", titulo: "Teste, arrependimento e reembolso" },
  { id: "dados-cliente", titulo: "Seus dados e sua responsabilidade sobre eles" },
  { id: "bancario", titulo: "Conciliação, extratos e arquivos CNAB" },
  { id: "cobranca", titulo: "Emissão de boleto e recebimentos" },
  { id: "fiscal", titulo: "NFS-e e obrigações fiscais" },
  { id: "ia", titulo: "Recursos de inteligência artificial" },
  { id: "disponibilidade", titulo: "Disponibilidade e suporte" },
  { id: "uso-proibido", titulo: "Uso proibido" },
  { id: "propriedade", titulo: "Propriedade intelectual" },
  { id: "responsabilidade", titulo: "Limitação de responsabilidade" },
  { id: "encerramento", titulo: "Cancelamento, encerramento e exportação" },
  { id: "alteracoes", titulo: "Alterações destes termos" },
  { id: "foro", titulo: "Lei aplicável e foro" },
];

export default function TermosPage() {
  const base = baseDoSite();

  return (
    <DocumentoLegal
      titulo="Termos de uso"
      resumo="As condições de contratação e uso do FinanceiroX. Vale a pena ler os itens 6 a 12: são os que definem quem responde pelo quê quando o assunto é dinheiro saindo, boleto entrando e nota sendo emitida."
      secoes={SECOES}
    >
      <Secao id="aceite" n={1} titulo="Aceite destes termos">
        <p>
          O FinanceiroX é operado por <strong>Produtize Tecnologia</strong>, inscrita no CNPJ sob o nº
          48.417.292/0001-99 (&quot;nós&quot;). Ao criar uma conta, acessar ou usar a plataforma, você
          (&quot;Cliente&quot;) declara que leu, entendeu e concorda com estes Termos de uso e com a{" "}
          <a className="font-semibold text-brand hover:underline" href={paginaDoSite(base, "/privacidade")}>
            Política de Privacidade
          </a>
          .
        </p>
        <p>
          Se você aceita estes Termos em nome de uma empresa, declara ter poderes para obrigá-la. Se não
          concorda com algum ponto, não use a plataforma.
        </p>
      </Secao>

      <Secao id="definicoes" n={2} titulo="Definições">
        <Itens>
          <li>
            <strong>Plataforma</strong>: o sistema FinanceiroX, acessível em financeirox.com.br e
            app.financeirox.com.br.
          </li>
          <li>
            <strong>Cliente</strong>: a pessoa física ou jurídica titular da conta contratante.
          </li>
          <li>
            <strong>Empresa</strong>: cada CNPJ (ou unidade) cadastrado dentro da conta, com seu próprio
            plano de contas, contas bancárias e lançamentos.
          </li>
          <li>
            <strong>Usuário</strong>: cada pessoa com login próprio na conta do Cliente.
          </li>
          <li>
            <strong>Portal do cliente</strong>: área de acesso restrito em que o Cliente publica
            informações para um terceiro (por exemplo, a empresa que ele administra).
          </li>
          <li>
            <strong>Dados do Cliente</strong>: tudo que é inserido, importado ou gerado dentro da conta —
            lançamentos, extratos, documentos, cadastros.
          </li>
        </Itens>
      </Secao>

      <Secao id="servico" n={3} titulo="O que o FinanceiroX faz">
        <p>
          O FinanceiroX é um software de gestão financeira oferecido como serviço (SaaS). Ele registra e
          organiza movimento financeiro: contas a pagar e a receber, conciliação de extratos bancários,
          fluxo de caixa, orçado × realizado, recorrências, fechamento de mês, exportação para a
          contabilidade, geração de arquivos de pagamento e de cobrança (CNAB), emissão de NFS-e e publicação de
          informações no portal do cliente.
        </p>
        <p>
          O FinanceiroX <strong>não</strong> é instituição financeira, não é banco, não movimenta dinheiro
          por conta própria, não presta serviço de contabilidade, de auditoria ou de consultoria tributária.
          Ele produz informação e arquivos a partir do que o Cliente registra.
        </p>
      </Secao>

      <Secao id="conta" n={4} titulo="Cadastro, conta e acesso">
        <p>
          O Cliente é responsável pela veracidade dos dados de cadastro e por mantê-los atualizados. As
          credenciais de acesso são pessoais e intransferíveis.
        </p>
        <p>
          O Cliente responde por todo uso feito com as credenciais dos seus usuários, inclusive por atos de
          pessoas que ele autorizou. Se suspeitar de acesso indevido, avise imediatamente em{" "}
          <a className="font-semibold text-brand hover:underline" href="mailto:seguranca@financeirox.com.br">
            seguranca@financeirox.com.br
          </a>{" "}
          e revogue o acesso do usuário envolvido dentro da própria plataforma.
        </p>
      </Secao>

      <Secao id="usuarios" n={5} titulo="Usuários, papéis e portal do cliente">
        <p>
          A conta pode ter vários usuários, com papéis distintos. Cabe ao Cliente definir quem vê e quem
          altera cada empresa, e revisar essas permissões periodicamente — especialmente quando alguém sai
          da equipe.
        </p>
        <p>
          Ao publicar informações no portal do cliente, o Cliente declara ter autorização para compartilhar
          aqueles dados com aquele destinatário. O acesso ao portal exige credencial própria; o Cliente é
          responsável por conceder e revogar esses acessos.
        </p>
      </Secao>

      <Secao id="planos" n={6} titulo="Planos, empresas e cobrança">
        <p>
          O preço é calculado pela <strong>quantidade de empresas ativas</strong> na conta, no ciclo
          contratado (mensal, semestral ou anual). Os valores vigentes estão publicados em{" "}
          <a className="font-semibold text-brand hover:underline" href={ancoraDoSite(base, "preco")}>
            financeirox.com.br/#preço
          </a>
          .
        </p>
        <p>
          A quantidade contratada nunca é inferior ao número de empresas ativas na conta. Ao ativar uma
          empresa além do contratado, a assinatura é ajustada para cima. Ao desativar empresas, a redução
          passa a valer no ciclo seguinte — não há devolução proporcional dentro de um ciclo já pago.
        </p>
        <p>
          Reajustes anuais seguem a variação do IPCA ou índice que o substitua, com aviso prévio de 30
          dias. Alterações de preço fora disso só valem a partir da renovação seguinte, também com aviso
          prévio de 30 dias.
        </p>
      </Secao>

      <Secao id="pagamento" n={7} titulo="Pagamento, atraso e suspensão">
        <p>
          A cobrança é processada por parceiro de pagamentos. O Cliente pode pagar por cartão, boleto ou
          Pix, conforme as opções disponíveis no momento da contratação.
        </p>
        <p>
          Em caso de atraso, enviamos avisos antes de qualquer restrição. Persistindo o atraso, o acesso
          pode ser suspenso a partir do 10º dia e a conta pode ser encerrada a partir do 60º dia. Durante a
          suspensão os dados continuam armazenados e a exportação continua disponível.
        </p>
        <p>
          Sobre valores em atraso incidem multa de 2% e juros de 1% ao mês, pro rata die, além de correção
          monetária.
        </p>
      </Secao>

      <Secao id="teste" n={8} titulo="Teste, arrependimento e reembolso">
        <p>
          Contas novas podem contar com um período de teste, informado no momento da contratação. Durante o
          teste não há cobrança e o cancelamento é imediato.
        </p>
        <p>
          Na contratação a distância, o Cliente pode desistir em até <strong>7 (sete) dias</strong> contados
          do pagamento, com devolução integral do valor, conforme o art. 49 do Código de Defesa do
          Consumidor.
        </p>
        <p>
          Fora dessa hipótese, não há reembolso de ciclos já iniciados. Em planos semestral e anual pagos
          antecipadamente, o cancelamento antes do fim do período dá direito à devolução proporcional aos
          meses inteiros ainda não usufruídos, descontado o desconto concedido pela adesão ao ciclo longo.
        </p>
      </Secao>

      <Secao id="dados-cliente" n={9} titulo="Seus dados e sua responsabilidade sobre eles">
        <p>
          Os Dados do Cliente pertencem ao Cliente. Não os vendemos, não os usamos para publicidade e não
          os compartilhamos com terceiros fora do necessário para operar o serviço, conforme descrito na
          Política de Privacidade.
        </p>
        <p>
          A exatidão do que está registrado é responsabilidade do Cliente. A plataforma calcula sobre o que
          recebe: um lançamento com valor errado produz um relatório errado, uma conciliação errada produz
          um saldo errado. Ferramentas de conferência existem, mas não substituem a revisão de quem responde
          pelo caixa.
        </p>
      </Secao>

      <Secao id="bancario" n={10} titulo="Conciliação, extratos e arquivos CNAB">
        <p>
          A conciliação bancária trabalha sobre extratos importados pelo Cliente (OFX, CSV ou equivalente).
          O FinanceiroX não acessa contas bancárias, não movimenta saldo e não emite ordens de pagamento
          diretamente ao banco.
        </p>
        <p>
          Na remessa CNAB, o FinanceiroX <strong>gera um arquivo</strong>. Quem envia esse arquivo ao banco,
          quem confere os beneficiários e quem aprova o pagamento é o Cliente, dentro do canal do próprio
          banco. Conferir o arquivo antes de aprovar é etapa obrigatória do processo do Cliente: um dado
          bancário incorreto no cadastro do favorecido produz um pagamento incorreto, e essa conferência
          está fora do nosso alcance.
        </p>
        <p>
          Layouts CNAB variam por banco e mudam sem aviso. Fazemos o possível para acompanhar essas
          mudanças, mas não garantimos aceitação de todo arquivo por todo banco em toda versão de layout.
        </p>
      </Secao>

      <Secao id="cobranca" n={11} titulo="Emissão de boleto e recebimentos">
        <p>
          Os boletos são emitidos <strong>na conta bancária do próprio Cliente</strong>. A plataforma monta o
          título, calcula o código de barras e a linha digitável conforme o layout do banco e gera o arquivo
          de remessa de cobrança (CNAB); quem registra o título é o banco do Cliente, com quem ele mantém o
          convênio de cobrança. A baixa é lida do arquivo de retorno que o Cliente importa.
        </p>
        <p>
          Isso tem duas consequências que o Cliente precisa conhecer antes de contratar:
        </p>
        <Itens>
          <li>
            É necessário ter convênio de cobrança ativo no banco, com carteira, agência/conta e faixa de
            &quot;nosso número&quot; fornecidos por ele. As tarifas de registro e de liquidação são do banco.
          </li>
          <li>
            Todo banco exige <strong>homologação do primeiro arquivo</strong> antes de aceitar remessa em
            produção. Esse processo é entre o Cliente e o banco; não temos como conduzi-lo nem prazo para
            garantir.
          </li>
        </Itens>
        <p>
          O FinanceiroX não retém, não custodia e não repassa valores de cobrança — os recebimentos caem
          direto na conta do Cliente, sem passar por nós. A cobrança da <em>assinatura do FinanceiroX</em>,
          essa sim, é processada por instituição de pagamento parceira (item 7).
        </p>
      </Secao>

      <Secao id="fiscal" n={12} titulo="NFS-e e obrigações fiscais">
        <p>
          A emissão é feita <strong>diretamente</strong> pela plataforma ao órgão emissor — o padrão nacional
          (Sefin Nacional) e o de São Paulo —, sem intermediário. Ela depende do município, de certificado
          digital A1 válido e do cadastro correto do Cliente na prefeitura. Indisponibilidade, mudança de
          layout ou rejeição por parte do órgão emissor não configuram falha da plataforma.
        </p>
        <p>
          Para assinar a nota, o Cliente envia à plataforma o <strong>certificado digital A1 e sua senha</strong>,
          que ficam armazenados de forma cifrada e são usados exclusivamente para assinar e transmitir os
          documentos que o Cliente mandar emitir. Cabe ao Cliente substituí-lo antes do vencimento e removê-lo
          ao encerrar a conta.
        </p>
        <p>
          A escolha de código de serviço, alíquota, retenções e regime tributário é do Cliente e de seu
          contador. O FinanceiroX transmite o que foi informado; não faz enquadramento fiscal nem substitui
          orientação contábil.
        </p>
      </Secao>

      <Secao id="ia" n={13} titulo="Recursos de inteligência artificial">
        <p>
          Alguns recursos usam modelos de linguagem: resumir os números do mês, responder perguntas sobre o
          período, sugerir a categorização de transações do extrato e ler nota ou boleto recebido para
          preencher um lançamento. Essas saídas são <strong>apoio, não parecer</strong>: podem conter erro e
          não constituem orientação contábil, fiscal, jurídica ou de investimento. A conferência e a decisão
          continuam sendo do Cliente.
        </p>
        <p>
          O envio ao provedor acontece por ação do Cliente, nunca de forma contínua sobre a base inteira, e o
          conteúdo enviado varia conforme o recurso — inclusive descrições de transações bancárias e o
          documento completo, quando é ele que está sendo lido. O detalhamento está no item 8 da{" "}
          <a className="font-semibold text-brand hover:underline" href={paginaDoSite(base, "/privacidade")}>
            Política de Privacidade
          </a>
          . Contratualmente, esse conteúdo não é usado para treinar modelos de terceiros.
        </p>
        <p>
          O uso é limitado por créditos e por teto diário, informados na própria tela.
        </p>
      </Secao>

      <Secao id="disponibilidade" n={14} titulo="Disponibilidade e suporte">
        <p>
          Buscamos disponibilidade mensal de <strong>99,5%</strong>, excluídas janelas de manutenção
          programada (comunicadas com antecedência), casos fortuitos, força maior e indisponibilidade de
          terceiros dos quais o serviço depende — provedor de nuvem, banco, prefeitura, instituição de
          pagamento.
        </p>
        <p>
          O suporte é prestado por e-mail e pelos canais indicados na plataforma, em dias úteis das 9h às
          18h (horário de Brasília).
        </p>
      </Secao>

      <Secao id="uso-proibido" n={15} titulo="Uso proibido">
        <Itens>
          <li>Usar a plataforma para atividade ilícita, fraude, lavagem de dinheiro ou evasão fiscal.</li>
          <li>Inserir dados de terceiros sem base legal ou autorização para tratá-los.</li>
          <li>
            Tentar burlar limites de plano, acessar dados de outra conta, fazer engenharia reversa ou
            explorar vulnerabilidades.
          </li>
          <li>
            Sobrecarregar a infraestrutura com automações não autorizadas, raspagem de dados ou volume
            anormal de requisições.
          </li>
          <li>Revender, sublicenciar ou disponibilizar o acesso a terceiros fora do contratado.</li>
        </Itens>
        <p>
          Constatada infração, podemos suspender o acesso imediatamente, com comunicação ao Cliente e sem
          prejuízo das medidas cabíveis.
        </p>
      </Secao>

      <Secao id="propriedade" n={16} titulo="Propriedade intelectual">
        <p>
          O software, a marca FinanceiroX, a interface, a documentação e todo o material da plataforma são
          de nossa propriedade. O contrato concede ao Cliente uma licença de uso não exclusiva,
          intransferível e limitada à vigência da assinatura.
        </p>
        <p>
          Sugestões e feedback enviados pelo Cliente podem ser incorporados ao produto sem que isso gere
          qualquer direito, remuneração ou coautoria.
        </p>
      </Secao>

      <Secao id="responsabilidade" n={17} titulo="Limitação de responsabilidade">
        <p>
          Respondemos por danos diretos comprovadamente causados por falha do serviço, limitados ao valor
          pago pelo Cliente nos <strong>12 (doze) meses</strong> anteriores ao evento.
        </p>
        <p>
          Não respondemos por lucros cessantes, perda de oportunidade, multas fiscais ou contratuais
          decorrentes de dado incorreto informado pelo Cliente, de pagamento aprovado pelo Cliente no canal
          do banco, de indisponibilidade de terceiros, nem por decisões tomadas com base em relatórios ou
          sugestões da plataforma.
        </p>
        <p>Nada nestes Termos afasta direitos irrenunciáveis previstos em lei.</p>
      </Secao>

      <Secao id="encerramento" n={18} titulo="Cancelamento, encerramento e exportação">
        <p>
          O Cliente pode cancelar a qualquer momento escrevendo para{" "}
          <a className="font-semibold text-brand hover:underline" href="mailto:contato@financeirox.com.br">
            contato@financeirox.com.br
          </a>
          . O acesso permanece até o fim do ciclo já pago. Cancelar pela própria tela ainda não existe; até
          existir, o pedido por e-mail vale a partir da data em que foi enviado.
        </p>
        <p>
          Após o encerramento, os dados ficam disponíveis para exportação por <strong>30 (trinta) dias</strong>
          . Passado esse prazo, são eliminados dos ambientes de produção, ressalvadas as informações que
          precisamos reter por obrigação legal — registros fiscais e contábeis, e os registros de acesso
          exigidos pelo Marco Civil da Internet.
        </p>
        <p>
          Durante a vigência do contrato, o Cliente exporta pela própria plataforma, em formato aberto e sem
          custo, os relatórios, o extrato de cada conta e os lançamentos no layout do seu sistema contábil.
          Uma exportação integral da base, em uma única operação, ainda não existe na tela — até que exista,
          ela é atendida por solicitação a{" "}
          <a className="font-semibold text-brand hover:underline" href="mailto:contato@financeirox.com.br">
            contato@financeirox.com.br
          </a>
          .
        </p>
        <p>
          <strong>Retenção de documentos anexados.</strong> Arquivos recebidos na caixa de entrada e
          documentos anexados a lançamentos são eliminados automaticamente após{" "}
          <strong>12 (doze) meses</strong>, mesmo com o contrato vigente, à exceção dos XML de nota fiscal, que
          são mantidos. Um aviso de expiração é enviado antes do prazo aos usuários ativos do portal de cada
          empresa; empresa sem usuário de portal ativo não recebe aviso. Cabe ao Cliente baixar o que
          precisar guardar por mais tempo. Os dados financeiros (lançamentos, conciliação, cadastros) não
          têm esse prazo.
        </p>
      </Secao>

      <Secao id="alteracoes" n={19} titulo="Alterações destes termos">
        <p>
          Podemos alterar estes Termos para refletir mudanças no serviço ou na legislação. Alterações
          relevantes são comunicadas por e-mail e dentro da plataforma com pelo menos{" "}
          <strong>30 dias</strong> de antecedência.
        </p>
        <p>
          Se o Cliente não concordar, pode cancelar antes da entrada em vigor, com devolução proporcional do
          período pago e não usufruído. Continuar usando depois da vigência significa aceitar a nova versão.
        </p>
      </Secao>

      <Secao id="foro" n={20} titulo="Lei aplicável e foro">
        <p>
          Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de São Paulo/SP
          para dirimir controvérsias, ressalvado o direito do consumidor de demandar no foro de seu
          domicílio.
        </p>
        <p>
          Contato para questões contratuais:{" "}
          <a className="font-semibold text-brand hover:underline" href="mailto:contato@financeirox.com.br">
            contato@financeirox.com.br
          </a>
          .
        </p>
      </Secao>
    </DocumentoLegal>
  );
}
