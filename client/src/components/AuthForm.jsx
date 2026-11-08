/**
 * AuthForm — formulário reutilizável de e-mail + senha (e, no cadastro, Nome e Sobrenome).
 * Usado tanto na tela de Login quanto na de Registro (as diferenças entre elas são os textos,
 * o callback de submit e a prop `comNome`).
 *
 * Props:
 *  - titulo      {string}                     Título exibido no topo do card.
 *  - textoBotao  {string}                     Rótulo do botão de submit.
 *  - comNome     {boolean}                    Mostra os campos "Nome" e "Sobrenome" ANTES do
 *                                              e-mail (só no Cadastro). São obrigatórios: mínimo de
 *                                              2 caracteres, máximo de 50, espaços das pontas removidos.
 *  - onSubmit    {({email, senha, nome?, sobrenome?}) => Promise}
 *                                              Chamado ao enviar (nome/sobrenome só com `comNome`,
 *                                              já sem espaços nas pontas); deve lançar em caso de
 *                                              erro (a mensagem é exibida).
 *  - rodape      {ReactNode}                   Área abaixo do botão (link para a
 *                                              outra tela).
 *
 * Responsabilidades:
 *  - controlar os inputs (estado local `email`/`senha`);
 *  - impedir submit duplo enquanto a requisição roda (`enviando`);
 *  - capturar erros do `onSubmit` e mostrar a mensagem da API.
 *
 * Cores: tudo via tokens (`surface`, `border`, `fg`, `muted`, `accent`,
 * `negative`) — ver `src/index.css`.
 */
import { useState } from 'react';
import { NOME_MAX, validarNomeCampo } from '../lib/usuario.js';

// `text-base` (16px) evita o zoom automático do iOS ao focar o campo;
// `min-h-[44px]` garante área de toque confortável.
const INPUT =
  'mt-1 w-full min-h-[44px] rounded border border-border bg-bg px-3 py-2 text-base text-fg ' +
  'placeholder:text-muted focus:border-accent focus:outline-none';

export default function AuthForm({ titulo, textoBotao, onSubmit, rodape, comNome = false }) {
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');

    // Cadastro: valida nome e sobrenome (o servidor valida de novo) e envia já sem espaços nas pontas.
    const dados = { email, senha };
    if (comNome) {
      const n = validarNomeCampo(nome, 'Nome');
      const s = validarNomeCampo(sobrenome, 'Sobrenome');
      if (n.erro || s.erro) {
        setErro(n.erro || s.erro);
        return;
      }
      dados.nome = n.valor;
      dados.sobrenome = s.valor;
    }

    setEnviando(true);
    try {
      await onSubmit(dados);
    } catch (err) {
      setErro(err.response?.data?.message || 'Não foi possível concluir. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className={`w-full space-y-4 rounded-lg border border-border bg-surface p-6 ${comNome ? 'max-w-md' : 'max-w-sm'}`}
      >
        <h1 className="text-center text-xl font-semibold">{titulo}</h1>

        {/* Só no Cadastro: Nome e Sobrenome, lado a lado a partir de `sm`, antes do e-mail. */}
        {comNome && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-muted">
              Nome
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={NOME_MAX}
                autoComplete="given-name"
                className={INPUT}
                required
              />
            </label>
            <label className="block text-sm text-muted">
              Sobrenome
              <input
                value={sobrenome}
                onChange={(e) => setSobrenome(e.target.value)}
                maxLength={NOME_MAX}
                autoComplete="family-name"
                className={INPUT}
                required
              />
            </label>
          </div>
        )}

        <label className="block text-sm text-muted">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
            required
          />
        </label>

        <label className="block text-sm text-muted">
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className={INPUT}
            minLength={6}
            required
          />
        </label>

        {erro && <p className="text-sm text-negative">{erro}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="min-h-[44px] w-full rounded bg-accent py-2 font-medium text-bg hover:opacity-90 disabled:opacity-60"
        >
          {enviando ? 'Aguarde…' : textoBotao}
        </button>

        {rodape && <div className="text-center text-sm text-muted">{rodape}</div>}
      </form>
    </div>
  );
}
