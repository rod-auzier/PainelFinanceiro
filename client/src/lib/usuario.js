/**
 * Helpers para EXIBIR o usuário (nome e inicial do avatar). Funções puras.
 *
 * Usuários antigos foram criados antes de existirem `nome` e `sobrenome`: esses campos vêm
 * vazios/ausentes. Nesse caso o app usa o E-MAIL como nome exibido (e a inicial do e-mail no
 * avatar) até a pessoa preencher o nome pelo Perfil. Nada quebra por falta do nome.
 */

/** Limite de caracteres de nome e sobrenome (igual ao do backend, models/User.js). */
export const NOME_MAX = 50;
/** Mínimo de caracteres de nome e sobrenome. */
export const NOME_MIN = 2;

/**
 * Nome a exibir: "Nome Sobrenome", ou o e-mail se o usuário ainda não tem nome.
 * @param {{ nome?: string, sobrenome?: string, email?: string } | null} user
 */
export function nomeExibido(user) {
  const completo = [user?.nome, user?.sobrenome].map((p) => (p ?? '').trim()).filter(Boolean).join(' ');
  return completo || user?.email || '';
}

/** Inicial do avatar: 1ª letra do NOME (maiúscula); sem nome, a do e-mail; sem nada, "?". */
export function inicialDoUsuario(user) {
  const base = (user?.nome ?? '').trim() || (user?.email ?? '').trim();
  return base ? base.charAt(0).toUpperCase() : '?';
}

/**
 * Valida nome/sobrenome (mesmas regras do cadastro e do backend): texto sem espaços nas pontas,
 * de 2 a 50 caracteres.
 * @param   {string} valor
 * @param   {'Nome'|'Sobrenome'} rotulo  só para a mensagem
 * @returns {{ valor?: string, erro?: string }}
 */
export function validarNomeCampo(valor, rotulo) {
  const texto = (valor ?? '').trim();
  if (!texto) return { erro: `${rotulo} é obrigatório.` };
  if (texto.length < NOME_MIN) return { erro: `${rotulo} deve ter ao menos ${NOME_MIN} caracteres.` };
  if (texto.length > NOME_MAX) return { erro: `${rotulo} deve ter no máximo ${NOME_MAX} caracteres.` };
  return { valor: texto };
}
