-- O FUNIL PASSA A ACEITAR `renovacao` COMO ORIGEM DE LICENÇA.
--
-- A ferramenta ganhou a renovação silenciosa da chave e ela mede
-- `ativou_licenca` com `p_origem: 'renovacao'`. O `check` do banco não conhecia
-- essa palavra — quer dizer que a medição seria RECUSADA, e o build 22/08
-- registra que este funil já jogou fora oito de onze eventos exatamente assim.
--
-- Quem pegou foi a `funil.mjs`, comparando os literais que o produto manda com
-- o vocabulário que o banco aceita. É a régua fazendo o trabalho dela: eu
-- escrevi o valor novo e não olhei a lista.
--
-- `renovacao` é uma origem SEPARADA de `link` de propósito. As duas ativam uma
-- licença, e a diferença entre elas é justamente o que se quer medir: quantas
-- chaves entram porque alguém colou o link do e-mail, e quantas entram sem
-- ninguém fazer nada. A segunda é a promessa que este build veio cumprir, e sem
-- a distinção não há como saber se ela está sendo cumprida.

alter table walkstamp.evento drop constraint if exists evento_origem_check;
alter table walkstamp.evento add constraint evento_origem_check check (
  origem is null or origem in (
    'arquivo', 'drive', 'gravacao', 'exemplo',   -- de onde veio o vídeo
    'espera', 'link', 'renovacao',               -- sessão nova, licença por link, chave renovada sozinha
    'placa', 'modelo',                           -- o que a troca de motor trocou
    'ideia', 'elogio', 'problema',               -- que tipo de recado
    'conta', 'ferramenta'));                     -- onde a intenção paga começou
