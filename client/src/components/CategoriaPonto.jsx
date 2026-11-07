/**
 * CategoriaPonto — bolinha com a cor FIXA da categoria (a mesma em todo o app).
 *
 * Props:
 *  - categoria {string}  nome da categoria; se não estiver na lista oficial usa a cor de "Outros".
 *
 * Decorativa (`aria-hidden`): o nome da categoria sempre aparece em texto ao lado.
 * Usada na lista de Despesas, na rosca/lista do Resumo e em "Maiores despesas".
 */
import { corDaCategoria } from '../lib/constants.js';

export default function CategoriaPonto({ categoria }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: corDaCategoria(categoria) }}
    />
  );
}
