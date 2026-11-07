/**
 * Model: Meta (objetivo pessoal com checkbox de conclusão)
 * --------------------------------------------------------
 * Campos:
 *  - userId    : referência (ObjectId) ao usuário dono da meta.
 *                Obrigatório e indexado — todas as consultas filtram por ele,
 *                garantindo que um usuário só veja/altere as próprias metas.
 *  - titulo    : texto da meta (ex.: "Juntar R$ 5.000 de reserva"). Obrigatório,
 *                sem espaços nas pontas, até 200 caracteres.
 *  - concluida : se a meta já foi cumprida (checkbox marcado). Padrão `false`.
 *                O usuário pode marcar/desmarcar à mão; além disso, o sistema marca
 *                sozinho quando o total guardado atinge `valorAlvo` (ver services/guardado.js).
 *  - valorAlvo : valor em R$ a atingir (ex.: 5000). OPCIONAL — sem ele a meta é só um
 *                item de checklist. Quando existe, a tela mostra barra de progresso.
 *  - alvoAtingido : controle INTERNO da conclusão automática: vira `true` no momento em que
 *                o total alcança `valorAlvo` e a meta é marcada sozinha. Serve para NÃO
 *                remarcar uma meta que o usuário desmarcou à mão. É "rearmado" (volta a
 *                `false`) se o total cair abaixo do alvo ou se o valorAlvo mudar.
 *  - createdAt : data de criação, gerada pelo `timestamps` do Mongoose (que
 *                também cria `updatedAt`). A listagem usa para ordenar.
 */
import mongoose from 'mongoose';

export const TITULO_MAX = 200;

const metaSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    titulo: {
      type: String,
      required: [true, 'titulo é obrigatório'],
      trim: true,
      maxlength: [TITULO_MAX, `titulo deve ter no máximo ${TITULO_MAX} caracteres`],
    },
    concluida: {
      type: Boolean,
      default: false,
    },
    valorAlvo: {
      type: Number,
      min: [0.01, 'valorAlvo deve ser maior que zero'],
      default: null,
    },
    alvoAtingido: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export const Meta = mongoose.model('Meta', metaSchema);
