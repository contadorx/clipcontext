# Revisar antes de publicar — textos legais do Walkstamp grátis (04/11/2026)

Os três documentos foram reescritos para o produto grátis, sem conta e sem
servidor: `src/site/bodies/privacidade.*.html`, `src/site/bodies/termos.*.html`
e `src/site/dpa.*.html` (cinco idiomas; o português é a fonte). Esta lista é o
que **só você** pode decidir ou confirmar. Onde eu não sabia o fato, o texto
ficou genérico e conservador — e está aqui.

## 1. Prazos que eu não tinha como saber

- [ ] **E-mails recebidos** (suporte@ e privacidade@). O texto diz: "pelo tempo
  necessário para responder e acompanhar o assunto; antes, a pedido". A LGPD
  (art. 9º, II) pede a duração. Definir um prazo concreto (ex.: 12 ou 24 meses
  depois do último contato) e apagar de fato na HostGator.
- [ ] **Registros de acesso (Marco Civil, art. 15).** A política antiga
  prometia 6 meses. A nova diz "o prazo de retenção da Vercel, respeitado o que
  a lei exigir". Decidir se a empresa se enquadra no art. 15 (pessoa jurídica,
  fins econômicos — o produto agora é grátis) e, se sim, como guardar 6 meses (a
  retenção de logs da Vercel depende do plano; talvez um *log drain*).
- [ ] **Prazo fiscal das faturas.** O texto diz "o prazo que a legislação
  tributária e contábil brasileira exige", sem número. Confirmar com a
  contabilidade (costuma-se citar 5 anos — CTN arts. 173–174; CC art. 1.194) e
  decidir se publica o número. Confirmar também o que fica no registro fiscal
  (a política antiga dizia que nome e documento eram apagados).

## 2. O sistema de contas antigo (seção "Quem teve conta antes de 4 de novembro de 2026")

- [ ] **A data.** Os três documentos dizem que conta e planos acabaram em
  **4 de novembro de 2026** e que "esse sistema foi desligado". Se 69–71 forem
  publicados em outra data, trocar a data nos 15 arquivos (e em
  `testes/legal.mjs`, constante `DATA`).
- [ ] **"Não haverá nova cobrança"** (política e termos §14). Só publicar depois
  de confirmar que **todas as assinaturas na Stripe foram canceladas** e não
  renovam sozinhas.
- [ ] **Quem pagou um plano anual ainda em vigor.** Os termos antigos diziam "sem
  devolução proporcional", mas o produto ficou grátis. O texto novo não promete
  reembolso: manda dúvidas sobre cobrança para suporte@ e preserva os direitos
  do consumidor. Decidir se haverá reembolso.
- [ ] **Aviso aos ex-clientes.** A política antiga prometia aos clientes pagos
  aviso **por e-mail, com 30 dias de antecedência**, para mudança material e
  troca de suboperador (o DPA antigo também, com direito de exportar os dados).
  Desligar a conta sem esse aviso pode descumprir o que foi prometido. Decidir
  se manda e-mail aos titulares das contas antes de excluir o banco.
- [ ] **Exclusão do banco (Build 72).** O texto diz "até a exclusão do banco",
  sem data. Decidir se publica a data. Depois da exclusão, atualizar a seção
  ("foi excluído em …").
- [ ] **A cópia de segurança.** O texto diz que ela é feita, fica com acesso
  restrito e serve só às obrigações legais e a pedidos de titulares. Decidir
  onde fica, quem acessa, **por quanto tempo**, e se os dados não fiscais saem
  dela. Uma cópia integral guardada por anos contradiz "os dados da conta são
  eliminados".
- [ ] **O que há no banco.** O texto cita: dados da conta (e-mail, configuração,
  modelos, marca, roteiros, casos, recibos, anexos, assentos, chamados), os
  endereços da antiga lista de aviso e as contagens anônimas de uso. Conferir
  com o banco real (há também os avisos de CSP, os hashes de convite e os
  arquivos do *bucket* de anexos) e garantir que tudo sai junto, inclusive
  backups e PITR do lado da Supabase.
- [ ] **Brevo e Stripe.** O texto cita os dois como passado e diz que a Stripe
  guarda os próprios registros. Decidir o que fazer com as duas contas
  (encerrar a Brevo?) e se é preciso dizer algo sobre os registros de envio da
  Brevo.
- [ ] **Base legal até a exclusão:** "execução do contrato já encerrado (art.
  7º, V) e legítimo interesse (art. 7º, IX) para concluir o desligamento".
  Confirmar.

## 3. Redação com peso jurídico

- [ ] **Termos §9:** "sem garantia e sem acordo de nível de serviço, além do que a
  lei exigir".
- [ ] **Termos §10:** limitação de responsabilidade, agora incluindo a perda do
  que fica no navegador, e a ressalva "nada afasta direitos que a lei garanta…
  inclusive os do CDC".
- [ ] **Termos §16 (lei e foro):** mantido **palavra por palavra** do texto
  anterior. Ele só elege foro quando se aplica o CDC; para cliente empresa não
  há foro eleito. Não mudei; avaliar.
- [ ] **Termos §15:** "o uso continuado significa concordância" (vinha de antes).
- [ ] **Bases legais:** legítimo interesse para os e-mails e para a contagem de
  visitas; obrigação legal para pedidos de titular e faturas. Confirmar (talvez
  registrar o teste de balanceamento do legítimo interesse).
- [ ] **RGPD/GDPR.** A política agora cita os direitos do RGPD, as bases
  correspondentes (art. 6(1)(f) e (c)) e promete avisar a "autoridade de
  controle europeia, quando aplicável". Decidir se o RGPD se aplica (art. 3(2):
  o site fala alemão e francês) e se é preciso um representante na UE (art.
  27). A correspondência "obrigação legal" para faturas brasileiras não vale no
  RGPD (art. 6(1)(c) pede lei da UE): revisar.
- [ ] **Transferência internacional (art. 33).** O texto diz que a da Vercel é
  "feita com base nas garantias contratuais oferecidas pelo fornecedor".
  Confirmar o mecanismo à luz da Resolução CD/ANPD nº 19/2024 (cláusulas-padrão
  da ANPD), e onde ficam os servidores de e-mail da HostGator (se fora do Brasil,
  também é transferência).
- [ ] **"Respondemos em até 15 dias"** aos pedidos de titular (vinha de antes;
  LGPD art. 19, II).

## 4. O DPA

- [ ] **A natureza dele mudou.** Era anexo ao contrato de assinatura; agora é
  "Anexo aos Termos de Uso" e diz que a empresa **não trata dados por conta do
  cliente**. Mantive o bloco de assinatura ("Fornecedora" / "Cliente —
  Controlador"). Decidir se continua assinável ou vira declaração unilateral.
- [ ] **Compromissos que ficaram:** publicar aviso no site e fazer as
  comunicações do art. 48 em caso de incidente (item 6); prestar informações
  por pedido escrito (item 8); a política publicada prevalece sobre o anexo
  assinado (item 11 — permite mudança unilateral).
- [ ] **Quem assinou o DPA antigo.** O item 10 diz que as obrigações de sigilo e
  de eliminação das versões anteriores continuam até serem cumpridas. Conferir
  se algum cliente assinou.
- [ ] **Regerar os PDFs** (`public/dpa-walkstamp*.pdf`, fora do meu escopo):
  `python3 build.py && node testes/gerar-dpa.mjs`.

## 5. Fatos que conferi no código e que divergem do que me foi passado

- [ ] **"Abrir do Google Drive" está ligado** no app construído (as três chaves
  `G_*` estão no `build.py`), mas `src/egressao.json` só cita o gesto "Enviar
  para o Google Docs". Os textos descrevem os dois. Confirmar se o seletor do
  Drive fica; se sim, acertar o `gesto` na matriz.
- [ ] **A indicação a um colega** ("Mandar por e-mail") abre o e-mail **sem
  destinatário** — a pessoa escolhe para quem. Não vai para suporte@. Os textos
  seguem o código.
- [ ] **O link "Me avise qual formato falhou"** monta o e-mail para
  **privacidade@** (`CONTATO`), e não para suporte@. Os textos dizem isso.
  Talvez prefira apontá-lo para suporte@ (mudança de código).
- [ ] **O relatório técnico do recado vem marcado** por padrão (dá para
  desmarcar). E montá-lo faz pedidos à Hugging Face e ao jsDelivr (testa se
  respondem). Os textos dizem as duas coisas.
- [ ] **privacidade@ é caixa ou encaminhador?** `DOMINIO-E-EMAIL.md` admite os
  dois. Os textos dizem que as duas caixas ficam na HostGator. Se privacidade@
  encaminha para outro provedor (Gmail etc.), ele também trata dados por nossa
  conta e entra na tabela "Quem trata dados por nossa conta".
- [ ] **Contratos com operadores:** confirmar que há DPA/termos de tratamento
  com a Vercel e com a HostGator (LGPD art. 39).
- [ ] **Preferência de idioma:** não achei chave de idioma no armazenamento do
  navegador; os textos não a citam.
- [ ] **HTTPS:** os textos dizem que site e ferramenta são servidos por HTTPS
  (padrão da Vercel). Confirmar o redirecionamento/HSTS em walkstamp.com.
- [ ] **Contagem de visitas:** os dados descritos (endereço da página, origem,
  país, tipo de navegador e aparelho; sem cookie; sem identificador que dure
  além do dia) vêm de `src/egressao.json`. Conferir com a documentação da
  Vercel.
