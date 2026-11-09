/**
 * CategoriaPonto — bolinha com a cor da categoria (a mesma em todo o app).
 *
 * Props (um dos dois):
 *  - categoria {string}  nome da categoria; a cor vem das categorias do USUÁRIO
 *                        (useCategorias().resolver). Sem correspondência → cor de "Outros".
 *  - cor       {string}  cor "#RRGGBB" direta (ex.: prévia no formulário de nova categoria).
 *  - grande    {boolean} bolinha um pouco maior (seletores e lista de gerenciamento).
 *
 * Decorativa (`aria-hidden`): o nome da categoria sempre aparece em texto ao lado.
 * Usada na lista e no formulário de Despesas, no gerenciamento de categorias, na rosca/lista do
 * Resumo e em "Maiores despesas".
 */
import { useCategorias } from '../context/CategoriasContext.jsx';

export default function CategoriaPonto({ categoria, cor, grande = false }) {
  const { resolver } = useCategorias();
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ${grande ? 'h-3 w-3' : 'h-2.5 w-2.5'}`}
      style={{ backgroundColor: cor ?? resolver(categoria).cor }}
    />
  );
}
