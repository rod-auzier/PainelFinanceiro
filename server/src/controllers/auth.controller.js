/**
 * Controller de autenticação.
 * Rotas: POST /api/register, POST /api/login, GET /api/me e, agora também sob o prefixo
 * /api/auth, GET /api/auth/me, PATCH /api/auth/perfil e PATCH /api/auth/senha (protegidas).
 *
 * As rotas protegidas agem SEMPRE só sobre o usuário do token (`req.userId`, lido do JWT pelo
 * middleware `authRequired`) — nunca por um id vindo do corpo/URL. Senhas e hashes nunca são
 * devolvidos nem registrados em log.
 */
import jwt from 'jsonwebtoken';
import { NOME_MAX, User } from '../models/User.js';
import { env } from '../config/env.js';

/**
 * Assina um JWT cujo "subject" (claim `sub`) é o id do usuário.
 * O middleware `authRequired` lê esse `sub` e o injeta como `req.userId`.
 */
function gerarToken(user) {
  return jwt.sign({}, env.jwtSecret, {
    subject: String(user._id),
    expiresIn: env.jwtExpiresIn, // ex.: "7d"
  });
}

/**
 * Valida e normaliza `nome`/`sobrenome` vindos do corpo: tem de ser texto, sem espaços nas
 * pontas, com 2 a NOME_MAX (50) caracteres.
 * @param   {unknown} valor
 * @param   {'nome'|'sobrenome'} campo  só para a mensagem de erro
 * @returns {{ valor?: string, erro?: string }}
 */
export function validarNome(valor, campo) {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  if (!texto) return { erro: `${campo} é obrigatório` };
  if (texto.length < 2) return { erro: `${campo} deve ter ao menos 2 caracteres` };
  if (texto.length > NOME_MAX) return { erro: `${campo} deve ter no máximo ${NOME_MAX} caracteres` };
  return { valor: texto };
}

/**
 * POST /api/register
 *
 * Recebe (JSON): { nome, sobrenome, email, senha }
 * Valida:
 *   - nome e sobrenome: obrigatórios, sem espaços nas pontas, de 2 a 50 caracteres -> 400
 *   - email e senha presentes           -> 400
 *   - senha com pelo menos 6 caracteres -> 400
 *   - email ainda não cadastrado        -> 409
 * Faz:
 *   - gera hash bcrypt da senha (User.definirSenha) e cria o usuário.
 * Retorna:
 *   - 201 { user, token }   (user sem o campo `senha`; token JWT recém-emitido)
 */
export async function register(req, res) {
  const { email, senha } = req.body ?? {};

  const nomeV = validarNome(req.body?.nome, 'nome');
  if (nomeV.erro) return res.status(400).json({ message: nomeV.erro });
  const sobrenomeV = validarNome(req.body?.sobrenome, 'sobrenome');
  if (sobrenomeV.erro) return res.status(400).json({ message: sobrenomeV.erro });

  if (!email || !senha) {
    return res.status(400).json({ message: 'email e senha são obrigatórios' });
  }
  if (String(senha).length < 6) {
    return res.status(400).json({ message: 'a senha deve ter ao menos 6 caracteres' });
  }

  const jaExiste = await User.findOne({ email: String(email).toLowerCase() });
  if (jaExiste) {
    return res.status(409).json({ message: 'email já cadastrado' });
  }

  const user = new User({ email, nome: nomeV.valor, sobrenome: sobrenomeV.valor });
  await user.definirSenha(senha);
  await user.save();

  return res.status(201).json({ user, token: gerarToken(user) });
}

/**
 * POST /api/login
 *
 * Recebe (JSON): { email, senha }
 * Valida:
 *   - email e senha presentes                          -> 400
 *   - existe usuário com o email E a senha confere      -> 401 se não
 *     (bcrypt.compare via User.verificarSenha)
 * Retorna:
 *   - 200 { user, token }   (token JWT válido por env.jwtExpiresIn)
 */
export async function login(req, res) {
  const { email, senha } = req.body ?? {};

  if (!email || !senha) {
    return res.status(400).json({ message: 'email e senha são obrigatórios' });
  }

  // `+senha` força trazer o campo que no schema tem `select: false`.
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+senha');
  if (!user || !(await user.verificarSenha(senha))) {
    return res.status(401).json({ message: 'credenciais inválidas' });
  }

  return res.json({ user, token: gerarToken(user) });
}

/**
 * GET /api/me  (rota protegida — exige `authRequired`)
 *
 * Recebe: header `Authorization: Bearer <token>` (o body é ignorado).
 * Valida: o middleware já garantiu o token; aqui só confirmamos que o
 *         usuário ainda existe no banco.
 * Retorna:
 *   - 200 { user }          usuário do token
 *   - 404 { message }       se o usuário foi removido depois da emissão
 */
export async function me(req, res) {
  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({ message: 'usuário não encontrado' });
  }
  return res.json({ user });
}

/**
 * PATCH /api/auth/perfil  (protegida)
 *
 * Atualiza nome e sobrenome do usuário LOGADO (o id vem do token, nunca do corpo). O e-mail não
 * é editável por aqui. Usado pela tela de Perfil — inclusive por usuários antigos, que ainda não
 * têm nome, para preenchê-lo pela primeira vez.
 *
 * Recebe (JSON): { nome, sobrenome } — mesmas regras do cadastro (2 a 50 caracteres, sem espaços
 *                nas pontas).
 * Retorna: 200 { user } · 400 { message } (validação) · 404 (usuário removido).
 */
export async function atualizarPerfil(req, res) {
  const nomeV = validarNome(req.body?.nome, 'nome');
  if (nomeV.erro) return res.status(400).json({ message: nomeV.erro });
  const sobrenomeV = validarNome(req.body?.sobrenome, 'sobrenome');
  if (sobrenomeV.erro) return res.status(400).json({ message: sobrenomeV.erro });

  const user = await User.findByIdAndUpdate(
    req.userId, // sempre o usuário do token
    { nome: nomeV.valor, sobrenome: sobrenomeV.valor },
    { new: true, runValidators: true },
  );
  if (!user) return res.status(404).json({ message: 'usuário não encontrado' });
  return res.json({ user });
}

// --- Troca de senha: regras e proteção contra força bruta ---
const SENHA_NOVA_MIN = 8; // mínimo de caracteres da nova senha
const MAX_ERROS_SENHA = 5; // erros seguidos da senha atual até bloquear
const BLOQUEIO_MIN = 10; // minutos de bloqueio depois disso

/** Mensagem de bloqueio com os minutos que faltam (arredondados para cima). */
const msgBloqueio = (ate) =>
  `Muitas tentativas incorretas. Tente novamente em ${Math.max(1, Math.ceil((ate - Date.now()) / 60000))} min.`;

/**
 * PATCH /api/auth/senha  (protegida)
 *
 * Troca a senha do usuário LOGADO.
 *
 * Recebe (JSON): { senhaAtual, novaSenha, confirmacao }
 * Valida, nesta ordem:
 *   1. bloqueio ativo por muitos erros seguidos           -> 429
 *   2. campos presentes; nova senha com ao menos 8 caracteres; diferente da atual; `confirmacao`
 *      igual à nova                                       -> 400 (não conta como tentativa)
 *   3. senha atual confere (bcrypt.compare)               -> 400 "Senha atual incorreta"; cada
 *      erro conta: ao 5º erro seguido a troca fica bloqueada por 10 minutos (429). Acerto zera
 *      o contador.
 * Faz: grava o novo hash bcrypt. Os contadores ficam no banco (ver models/User.js).
 * Retorna: 200 { message } — nunca a senha nem o hash. (Não registra nada em log.)
 *
 * Observação: os tokens JWT já emitidos continuam válidos até expirarem (a sessão de quem está
 * logado não é derrubada ao trocar a senha).
 */
export async function alterarSenha(req, res) {
  const { senhaAtual, novaSenha, confirmacao } = req.body ?? {};

  const user = await User.findById(req.userId).select('+senha +senhaBloqueadoAte');
  if (!user) return res.status(404).json({ message: 'usuário não encontrado' });

  // 1) Bloqueio ativo?
  if (user.senhaBloqueadoAte && user.senhaBloqueadoAte > new Date()) {
    return res.status(429).json({ message: msgBloqueio(user.senhaBloqueadoAte) });
  }

  // 2) Validação dos campos (não conta como tentativa de adivinhar a senha).
  if (typeof senhaAtual !== 'string' || !senhaAtual) {
    return res.status(400).json({ message: 'Informe a senha atual.' });
  }
  if (typeof novaSenha !== 'string' || novaSenha.length < SENHA_NOVA_MIN) {
    return res.status(400).json({ message: `A nova senha deve ter ao menos ${SENHA_NOVA_MIN} caracteres.` });
  }
  if (novaSenha === senhaAtual) {
    return res.status(400).json({ message: 'A nova senha deve ser diferente da atual.' });
  }
  if (confirmacao !== novaSenha) {
    return res.status(400).json({ message: 'A confirmação não é igual à nova senha.' });
  }

  // 3) Senha atual confere?
  if (!(await user.verificarSenha(senhaAtual))) {
    // $inc atômico: tentativas simultâneas não "escapam" da contagem.
    const apos = await User.findByIdAndUpdate(
      req.userId,
      { $inc: { senhaTentativas: 1 } },
      { new: true },
    ).select('+senhaTentativas');

    if (apos.senhaTentativas >= MAX_ERROS_SENHA) {
      const ate = new Date(Date.now() + BLOQUEIO_MIN * 60000);
      await User.updateOne({ _id: req.userId }, { senhaTentativas: 0, senhaBloqueadoAte: ate });
      return res.status(429).json({ message: msgBloqueio(ate) });
    }
    const restam = MAX_ERROS_SENHA - apos.senhaTentativas;
    return res.status(400).json({
      message: `Senha atual incorreta. ${restam === 1 ? 'Resta 1 tentativa' : `Restam ${restam} tentativas`}.`,
    });
  }

  // Tudo certo: novo hash + zera o controle de tentativas.
  await user.definirSenha(novaSenha);
  user.senhaTentativas = 0;
  user.senhaBloqueadoAte = null;
  await user.save();

  return res.json({ message: 'Senha alterada com sucesso.' });
}
