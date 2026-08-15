import type { Metadata } from "next";
import { DocumentoLegal, Itens, Secao } from "../documento-legal";
import { ancoraDoSite, baseDoSite, paginaDoSite } from "@/lib/site-links";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Como o FinanceiroX trata dados pessoais: quais dados coleta, com que base legal, com quem compartilha, por quanto tempo guarda e como exercer seus direitos sob a LGPD.",
  alternates: { canonical: "/privacidade" },
};

const SECOES = [
  { id: "quem-somos", titulo: "Quem trata os dados" },
  { id: "papeis", titulo: "Controlador e operador: quem é quem" },
  { id: "dados", titulo: "Dados que tratamos" },
  { id: "finalidades", titulo: "Para que usamos" },
  { id: "bases", titulo: "Bases legais" },
  { id: "compartilhamento", titulo: "Com quem compartilhamos" },
  { id: "acesso-interno", titulo: "Acesso da nossa equipe aos seus dados" },
  { id: "ia", titulo: "Dados e inteligência artificial" },
  { id: "internacional", titulo: "Transferência internacional" },
  { id: "retencao", titulo: "Por quanto tempo guardamos" },
  { id: "seguranca", titulo: "Segurança da informação" },
  { id: "incidentes", titulo: "Incidentes de segurança" },
  { id: "direitos", titulo: "Seus direitos" },
  { id: "cookies", titulo: "Cookies e tecnologias semelhantes" },
  { id: "criancas", titulo: "Crianças e adolescentes" },
  { id: "alteracoes", titulo: "Alterações desta política" },
  { id: "contato", titulo: "Encarregado e contato" },
];

export default function PrivacidadePage() {
  const base = baseDoSite();

  return (
    <DocumentoLegal
      titulo="Política de Privacidade"
      resumo="O que fazemos com dados pessoais — os seus e os de quem aparece no seu financeiro. O item 2 é o mais importante: na maior parte do tempo, quem decide sobre esses dados é você, e nós apenas executamos."
      secoes={SECOES}
    >
      <Secao id="quem-somos" n={1} titulo="Quem trata os dados">
        <p>
          O FinanceiroX é operado por <strong>Produtize Tecnologia</strong>, CNPJ 48.417.292/0001-99. Esta
          política explica como tratamos dados pessoais na plataforma, em conformidade com a Lei nº
          13.709/2018 (LGPD).
        </p>
      </Secao>

      <Secao id="papeis" n={2} titulo="Controlador e operador: quem é quem">
        <p>
          A distinção muda quem responde pelo quê, então vale ser explícito:
        </p>
        <Itens>
          <li>
            <strong>Somos controladores</strong> dos dados da relação comercial com o Cliente: cadastro da
            conta, dados de faturamento, registros de acesso, comunicações de suporte, uso da plataforma.
          </li>
          <li>
            <strong>Somos operadores</strong> dos dados que o Cliente insere sobre terceiros — fornecedores,
            clientes, funcionários, favorecidos de pagamento. Sobre esses, quem define finalidade e meios é
            o Cliente, que atua como controlador. Nós tratamos apenas conforme as instruções dele e o
            necessário para prestar o serviço.
          </li>
        </Itens>
        <p>
          Se um titular nos procurar sobre dados que estão na conta de um Cliente, encaminhamos o pedido ao
          Cliente e o apoiamos no atendimento, no prazo legal.
        </p>
      </Secao>

      <Secao id="dados" n={3} titulo="Dados que tratamos">
        <Itens>
          <li>
            <strong>Cadastro e conta</strong>: nome, e-mail, telefone, CPF ou CNPJ, razão social, senha
            (armazenada como hash).
          </li>
          <li>
            <strong>Faturamento</strong>: dados necessários à cobrança e à emissão fiscal. Dados completos
            de cartão são tratados pela instituição de pagamento; não trafegam nem ficam em nossos
            servidores.
          </li>
          <li>
            <strong>Dados financeiros do Cliente</strong>: lançamentos, extratos importados, contas
            bancárias cadastradas, documentos anexados, cadastros de pessoas (fornecedores, clientes,
            favorecidos) com os dados que o Cliente inserir — inclusive CPF/CNPJ e dados bancários quando
            necessários para pagamento e cobrança.
          </li>
          <li>
            <strong>Uso e técnicos</strong>: endereço IP, data e hora de acesso, identificador de sessão,
            navegador e sistema. No portal do cliente, registramos cada entrada e cada documento enviado
            pelo cliente.
          </li>
          <li>
            <strong>Certificado digital</strong>: quem emite NFS-e envia o certificado A1 e a senha dele.
            Ficam cifrados e são usados apenas para assinar e transmitir os documentos que o Cliente mandar
            emitir.
          </li>
          <li>
            <strong>Comunicações</strong>: mensagens trocadas com o suporte.
          </li>
        </Itens>
        <p>
          Não coletamos dados sensíveis intencionalmente e não há campo destinado a eles. Se o Cliente
          inserir dado sensível em campo livre, responde por essa inclusão como controlador.
        </p>
      </Secao>

      <Secao id="finalidades" n={4} titulo="Para que usamos">
        <Itens>
          <li>Criar e manter a conta, autenticar acessos e aplicar permissões.</li>
          <li>Prestar as funções contratadas: conciliação, contas a pagar e receber, relatórios, geração de arquivos de pagamento, cobrança, emissão fiscal e portal.</li>
          <li>Cobrar pelo serviço e cumprir obrigações fiscais e contábeis.</li>
          <li>Prestar suporte e comunicar mudanças relevantes no serviço.</li>
          <li>Detectar fraude, uso indevido e ameaças à segurança.</li>
          <li>Melhorar o produto, com dados agregados que não identificam pessoas.</li>
        </Itens>
        <p>
          <strong>Não vendemos dados pessoais, não os cedemos para publicidade de terceiros e não fazemos
          perfilamento para anúncios.</strong>
        </p>
      </Secao>

      <Secao id="bases" n={5} titulo="Bases legais">
        <Itens>
          <li>
            <strong>Execução de contrato</strong> (art. 7º, V): tudo que é necessário para entregar o
            serviço contratado.
          </li>
          <li>
            <strong>Cumprimento de obrigação legal</strong> (art. 7º, II): guarda fiscal e contábil, e
            registros de acesso exigidos pelo Marco Civil da Internet.
          </li>
          <li>
            <strong>Legítimo interesse</strong> (art. 7º, IX): segurança, prevenção a fraude e melhoria do
            produto, sempre com avaliação de impacto sobre o titular.
          </li>
          <li>
            <strong>Consentimento</strong> (art. 7º, I): apenas onde ele é de fato exigido, como
            comunicações de marketing — revogável a qualquer momento.
          </li>
        </Itens>
      </Secao>

      <Secao id="compartilhamento" n={6} titulo="Com quem compartilhamos">
        <p>Compartilhamos apenas o necessário, com operadores que atuam sob contrato e sob nossas instruções:</p>
        <Itens>
          <li>
            <strong>Infraestrutura e banco de dados</strong>: provedores de nuvem que hospedam a aplicação e
            os dados.
          </li>
          <li>
            <strong>Instituição de pagamento</strong>: para cobrar do Cliente o que ele nos deve — a
            assinatura e as compras avulsas de créditos de IA. Os boletos que o Cliente emite aos clientes
            dele não passam por ela: são registrados no banco do próprio Cliente, por arquivo de remessa.
          </li>
          <li>
            <strong>Emissão fiscal</strong>: o órgão emissor da nota — a Sefin Nacional ou a prefeitura do
            município —, para quem a nota é transmitida diretamente, sem intermediário.
          </li>
          <li>
            <strong>Provedor de modelos de IA</strong>: nos limites descritos no item 8.
          </li>
          <li>
            <strong>E-mail transacional e suporte</strong>: para enviar avisos e responder chamados.
          </li>
          <li>
            <strong>Autoridades</strong>: mediante requisição legal válida.
          </li>
        </Itens>
        <p>
          Arquivos CNAB gerados na plataforma — tanto de pagamento quanto de cobrança — são baixados pelo
          Cliente e enviados por ele ao banco. Nós não transmitimos esses arquivos a instituições financeiras
          e não temos acesso às contas bancárias do Cliente.
        </p>
        <p>
          Os fornecedores em uso hoje: Supabase (banco de dados, arquivos e autenticação), Vercel
          (hospedagem), Anthropic (modelos de IA), Asaas (cobrança da assinatura e dos créditos de IA) e Brevo (e-mail
          transacional). Se essa lista mudar, esta política é atualizada.
        </p>
      </Secao>

      <Secao id="acesso-interno" n={7} titulo="Acesso da nossa equipe aos seus dados">
        <p>
          A plataforma tem uma função de suporte que permite a um administrador nosso <strong>assumir a
          sessão do titular de uma conta</strong> e ver o que ele vê. Ela existe para diagnosticar problema
          que não se reproduz de fora — e dizemos isso aqui porque uma política que omite o acesso interno
          está descrevendo um sistema que não é este.
        </p>
        <Itens>
          <li>
            O acesso registra quem acessou, qual conta e quando. Sendo exato: hoje a gravação desse registro
            não bloqueia o acesso, ou seja, uma falha ao gravar deixaria o acesso acontecer sem trilha.
            Tornar o registro bloqueante está no roteiro.
          </li>
          <li>É restrito a administradores do FinanceiroX; nenhum outro usuário alcança conta alheia.</li>
          <li>
            Não usamos esse acesso para ler dados de clientes fora de um chamado de suporte ou de uma
            obrigação legal.
          </li>
        </Itens>
        <p>
          Se o Cliente quiser ser avisado sempre que isso ocorrer na conta dele, é só pedir em{" "}
          <a className="font-semibold text-brand hover:underline" href="mailto:privacidade@financeirox.com.br">
            privacidade@financeirox.com.br
          </a>
          .
        </p>
      </Secao>

      <Secao id="ia" n={8} titulo="Dados e inteligência artificial">
        <p>
          O envio acontece <strong>por ação do Cliente</strong>, recurso a recurso — nunca de forma contínua
          ou automática sobre a base inteira. O que sai daqui depende do recurso, e a diferença é grande o
          bastante para estar escrita:
        </p>
        <Itens>
          <li>
            <strong>Análise do mês e perguntas sobre o período</strong>: apenas totais agregados (entradas,
            saídas, saldo, maiores categorias), o nome da empresa e a pergunta feita. Nenhum lançamento
            individual.
          </li>
          <li>
            <strong>Categorização de transações</strong>: a <em>descrição bruta</em> das transações do
            extrato — que costuma trazer nome de favorecido, chave Pix ou número de documento — junto com a
            lista de clientes e fornecedores já cadastrados, para que a sugestão aponte para um deles.
          </li>
          <li>
            <strong>Leitura de documento</strong>: o arquivo <em>inteiro</em> da nota ou do boleto (PDF ou
            imagem) enviado ao modelo, para extrair valor, vencimento e emitente.
          </li>
          <li>
            <strong>Assistente de suporte</strong> (a bolha de ajuda): a pergunta digitada, os últimos turnos
            da conversa e os artigos de ajuda publicados. A conversa fica guardada, com o nome do escritório
            e o e-mail de quem perguntou, para que o suporte consiga retomar de onde parou.
          </li>
        </Itens>
        <p>
          O provedor de modelos em uso é a <strong>Anthropic</strong>, nos Estados Unidos. Contratualmente,
          esse conteúdo não é usado para treinar modelos. Ainda assim: se um documento contém dado pessoal
          que não precisa ser lido, não o envie pela leitura automática.
        </p>
      </Secao>

      <Secao id="internacional" n={9} titulo="Transferência internacional">
        <p>
          Alguns fornecedores processam dados fora do Brasil. Nesses casos, a transferência se apoia em
          cláusulas contratuais que asseguram grau de proteção compatível com a LGPD, conforme o art. 33.
        </p>
      </Secao>

      <Secao id="retencao" n={10} titulo="Por quanto tempo guardamos">
        <Itens>
          <li>
            <strong>Dados da conta e financeiros</strong> (lançamentos, conciliação, cadastros): enquanto
            durar o contrato. Após o encerramento, ficam disponíveis para exportação por 30 dias e então são
            eliminados da produção.
          </li>
          <li>
            <strong>Documentos anexados e recebidos</strong> (PDF, imagem, comprovante): eliminados
            automaticamente <strong>12 meses</strong> após o recebimento, mesmo com o contrato vigente. É
            política do produto, não do encerramento. Um aviso é enviado antes do prazo aos usuários ativos
            do portal de cada empresa — empresa sem usuário de portal ativo não recebe aviso. XML de nota
            fiscal é mantido.
          </li>
          <li>
            <strong>Registros fiscais e contábeis</strong>: pelo prazo legal aplicável, tipicamente 5 anos.
          </li>
          <li>
            <strong>Registros de acesso</strong>: 6 meses, conforme o Marco Civil da Internet.
          </li>
          <li>
            <strong>Backups</strong>: expiram conforme o ciclo de retenção (até 30 dias), de forma que um
            dado excluído da produção some dos backups ao fim do ciclo.
          </li>
        </Itens>
      </Secao>

      <Secao id="seguranca" n={11} titulo="Segurança da informação">
        <p>
          Aplicamos medidas técnicas e organizacionais proporcionais ao risco: criptografia em trânsito
          (TLS) e em repouso, isolamento de dados por conta no próprio banco de dados, controle de acesso
          por papel, senhas armazenadas como hash (pelo Supabase Auth — nós nunca vemos a senha) e backups
          automáticos. Detalhes, incluindo o que ainda não temos, em{" "}
          <a className="font-semibold text-brand hover:underline" href={paginaDoSite(base, "/seguranca")}>
            Segurança
          </a>
          .
        </p>
      </Secao>

      <Secao id="incidentes" n={12} titulo="Incidentes de segurança">
        <p>
          Se ocorrer incidente com risco relevante aos titulares, comunicamos o Cliente afetado em até{" "}
          <strong>72 horas</strong> da confirmação, com o que se sabe até então: o que aconteceu, quais
          dados foram envolvidos, o que já foi feito e o que recomendamos. Comunicamos a ANPD e os titulares
          quando a lei exigir.
        </p>
      </Secao>

      <Secao id="direitos" n={13} titulo="Seus direitos">
        <p>Como titular, você pode pedir:</p>
        <Itens>
          <li>Confirmação de que tratamos seus dados e acesso a eles.</li>
          <li>Correção de dados incompletos, inexatos ou desatualizados.</li>
          <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade.</li>
          <li>Portabilidade a outro fornecedor.</li>
          <li>Informação sobre com quem compartilhamos seus dados.</li>
          <li>Revogação do consentimento, quando essa for a base legal.</li>
          <li>Oposição a tratamento fundado em legítimo interesse.</li>
        </Itens>
        <p>
          Escreva para{" "}
          <a className="font-semibold text-brand hover:underline" href="mailto:privacidade@financeirox.com.br">
            privacidade@financeirox.com.br
          </a>
          . Respondemos em até 15 dias. Se os dados estiverem sob controle de um Cliente nosso, direcionamos
          o pedido a ele — porque é ele quem pode decidir sobre aqueles dados.
        </p>
      </Secao>

      <Secao id="cookies" n={14} titulo="Cookies e tecnologias semelhantes">
        <p>Usamos apenas cookies estritamente necessários:</p>
        <Itens>
          <li>sessão autenticada (definidos pelo Supabase Auth);</li>
          <li>empresa e período selecionados, densidade da interface e estado da barra lateral;</li>
          <li>sessão do portal do cliente, um por portal;</li>
          <li>
            sessão de suporte, quando um administrador nosso assume a conta para diagnóstico (item 7).
          </li>
        </Itens>
        <p>
          Além dos cookies, guardamos no <strong>armazenamento local do navegador</strong> preferências de
          exibição — quais colunas aparecem em cada tabela, quais filtros ficam visíveis e escolhas de tela.
          Essas informações não saem do dispositivo e não são enviadas aos nossos servidores.
        </p>
        <p>
          Não usamos cookies de publicidade nem de rastreamento entre sites, e não há ferramenta de análise
          de terceiros na plataforma.
        </p>
      </Secao>

      <Secao id="criancas" n={15} titulo="Crianças e adolescentes">
        <p>
          A plataforma é destinada a uso profissional por maiores de 18 anos. Não coletamos dados de
          crianças e adolescentes de forma consciente. Ao identificar coleta indevida, eliminamos o registro.
        </p>
      </Secao>

      <Secao id="alteracoes" n={16} titulo="Alterações desta política">
        <p>
          Podemos atualizar esta política. Mudanças relevantes são comunicadas por e-mail e dentro da
          plataforma com 30 dias de antecedência. A data da última atualização está no topo desta página.
        </p>
      </Secao>

      <Secao id="contato" n={17} titulo="Encarregado e contato">
        <p>
          Encarregado pelo tratamento de dados pessoais (DPO):{" "}
          <a className="font-semibold text-brand hover:underline" href="mailto:privacidade@financeirox.com.br">
            privacidade@financeirox.com.br
          </a>
          . Assuntos de segurança:{" "}
          <a className="font-semibold text-brand hover:underline" href="mailto:seguranca@financeirox.com.br">
            seguranca@financeirox.com.br
          </a>
          .
        </p>
        <p>
          Você também pode peticionar diretamente à Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </Secao>
    </DocumentoLegal>
  );
}
