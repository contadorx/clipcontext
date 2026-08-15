/**
 * Encolhe foto de documento antes de subir.
 *
 * O peso do armazenamento não está nos boletos — um PDF de boleto tem 50 a 100
 * KB. Está nas fotos: o cliente aponta o celular para a nota e manda 2 a 8 MB
 * de uma câmera de 12 megapixels. Dezenas de vezes o tamanho do PDF, para a
 * mesma informação.
 *
 * E é informação que ninguém precisa em 12 MP. O documento é lido por uma pessoa
 * na tela: a 1600px no lado maior, a chave de acesso de 44 dígitos de uma nota
 * fiscal continua legível com folga (medido — 2,03 MB viram 193 KB, −90%). O que
 * se perde é a textura do papel.
 *
 * Roda **no navegador**, antes do upload assinado. Nenhum byte a mais atravessa
 * o servidor do app e nenhuma função serverless é acionada.
 */

/** lado maior depois de reduzir — acima disto ninguém lê melhor, só ocupa mais */
const LADO_MAX = 1600;
/** abaixo disto o ganho não paga o risco de mexer */
const MINIMO_PARA_MEXER = 600 * 1024;
/**
 * Teto de entrada. Acima disto o arquivo é devolvido intocado para ser rejeitado
 * pela regra de tamanho de quem chamou.
 *
 * Existe porque decodificar é caro **antes** de saber se vale a pena: uma foto de
 * 48 MP (8000×6000) ocupa ~192 MB de RGBA na memória do navegador só para ser
 * medida. Sem este teto, um arquivo que ia ser recusado de qualquer jeito
 * derrubava a aba de um celular modesto — e levava junto a fila inteira e o que
 * a pessoa já tinha digitado.
 */
const TETO_ENTRADA = 25 * 1024 * 1024;
/** qualidade do JPEG. 0.82 é o joelho da curva: abaixo aparece artefato em texto */
const QUALIDADE = 0.82;
/** decodificar não pode pendurar a fila para sempre */
const LIMITE_DECODE_MS = 15000;

export type ResultadoCompressao = {
  arquivo: File;
  /** true quando o arquivo devolvido é diferente do original */
  comprimido: boolean;
  bytesAntes: number;
  bytesDepois: number;
};

/**
 * Só JPEG, e só de câmera.
 *
 * PNG fica de fora de propósito. O PNG de documento é quase sempre print de tela
 * — internet banking, comprovante de Pix — com texto fino e fundo chapado, que é
 * exatamente o material em que reduzir para 1600px e recodificar em JPEG cria
 * artefato nas letras. Trocar legibilidade por KB no arquivo que a pessoa vai
 * ler é o pior negócio possível, e print de tela raramente pesa o que uma foto
 * pesa.
 *
 * WEBP também fica de fora, por outro motivo: a lista de extensões aceitas no
 * servidor não tem "webp". Se comprimíssemos, ele viraria `.jpg` e passaria —
 * mas só quando estivesse acima do limiar. O mesmo formato seria aceito ou
 * recusado conforme o peso do arquivo, que é a pior regra que se pode dar a
 * alguém. Enquanto o servidor não aceitar webp, aqui também não.
 */
function ehFotoJpeg(file: File): boolean {
  if (file.type === "image/jpeg") return true;
  // Android e alguns navegadores mandam `type` vazio; aí decide a extensão
  if (file.type === "") return /\.jpe?g$/i.test(file.name);
  return false;
}

function carregar(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    let pronto = false;
    const encerrar = () => {
      if (pronto) return true;
      pronto = true;
      URL.revokeObjectURL(url);
      return false;
    };
    /*
      O relógio existe porque `onerror` não é garantido.

      Sob pressão de memória o Chrome aborta a decodificação sem disparar evento
      nenhum, e aí a Promise não resolve nunca: o `try/catch` de quem chama não
      pega travamento, o `finally` que devolve a interface nunca roda, e a área
      de envio fica em "enviando…" até alguém recarregar a página.
    */
    const relogio = setTimeout(() => {
      if (encerrar()) return;
      img.src = "";
      reject(new Error("tempo esgotado ao decodificar"));
    }, LIMITE_DECODE_MS);
    img.onload = () => {
      clearTimeout(relogio);
      if (encerrar()) return;
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(relogio);
      if (encerrar()) return;
      reject(new Error("imagem ilegível"));
    };
    img.src = url;
  });
}

/**
 * Devolve sempre um `File` utilizável — inclusive quando não deu para comprimir.
 *
 * Falha aqui não pode impedir o envio: o cliente está tentando mandar uma nota
 * para o contador, e "não consegui reduzir sua foto" seria um detalhe interno
 * barrando a tarefa dele. Qualquer problema devolve o original.
 */
export async function comprimirImagem(file: File): Promise<ResultadoCompressao> {
  const original: ResultadoCompressao = {
    arquivo: file,
    comprimido: false,
    bytesAntes: file.size,
    bytesDepois: file.size,
  };

  if (typeof document === "undefined") return original;
  if (!ehFotoJpeg(file)) return original;
  if (file.size < MINIMO_PARA_MEXER || file.size > TETO_ENTRADA) return original;

  let img: HTMLImageElement | null = null;
  try {
    img = await carregar(file);
    const maior = Math.max(img.naturalWidth, img.naturalHeight);
    /*
      Só age quando há o que reduzir.

      Reencodar sem redimensionar seria uma segunda geração de perda por uma
      economia pequena: um scan de 1500×1500 já dimensionado ganharia artefato
      de graça. A régua é a dimensão, não o peso — peso alto com dimensão
      pequena costuma ser imagem que já está no limite do que dá para espremer.
    */
    if (maior <= LADO_MAX) return original;

    const escala = LADO_MAX / maior;
    const w = Math.round(img.naturalWidth * escala);
    const h = Math.round(img.naturalHeight * escala);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    // o padrão do canvas é transparente, e transparência vira preto no JPEG
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", QUALIDADE));
    // devolve a memória do canvas na hora; o Safari do iPhone precisa disto
    canvas.width = 0;
    canvas.height = 0;
    if (!blob) return original;

    // Recomprimir pode engordar — JPEG já bem otimizado, arte com poucas cores.
    if (blob.size >= file.size) return original;

    const nome = file.name.replace(/\.jpe?g$/i, "") + ".jpg";
    const arquivo = new File([blob], nome, { type: "image/jpeg", lastModified: file.lastModified });
    return { arquivo, comprimido: true, bytesAntes: file.size, bytesDepois: arquivo.size };
  } catch {
    return original;
  } finally {
    // solta os ~48 MB do bitmap decodificado antes do próximo da fila
    if (img) img.src = "";
  }
}
