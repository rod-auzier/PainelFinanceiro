/**
 * Tela de Perfil (rota `/perfil`, dentro do <Layout>).
 *
 * Duas seções, em cards sólidos do tema:
 *
 *  1. DADOS — editar Nome e Sobrenome (PATCH /api/auth/perfil); o e-mail aparece só para leitura.
 *     Regras (as mesmas do cadastro e do backend): 2 a 50 caracteres, sem espaços nas pontas.
 *     Ao salvar, o usuário do AuthContext é atualizado e o nome na sidebar muda NA HORA. Usuários
 *     antigos (sem nome) entram aqui com os campos vazios e podem preenchê-los pela 1ª vez.
 *
 *  2. ALTERAR SENHA — "Senha atual", "Nova senha" e "Confirmar nova senha", cada uma com botão
 *     Mostrar/Ocultar (<CampoSenha>) (PATCH /api/auth/senha). Regras conferidas aqui antes de
 *     enviar (e de novo no servidor): nova senha com ao menos 8 caracteres, diferente da atual e
 *     confirmação igual. Erros do servidor aparecem como vieram ("Senha atual incorreta…", e o
 *     aviso de bloqueio após 5 erros seguidos). Os campos são limpos depois do sucesso.
 *
 * Mensagens: sucesso em verde (`positive`), erro em vermelho (`negative`). Botões em amarelo de
 * destaque (`accent`). Não recebe props — usa o AuthContext.
 */
import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import CampoSenha from '../components/CampoSenha.jsx';
import { NOME_MAX, validarNomeCampo } from '../lib/usuario.js';

const INPUT =
  'mt-1 w-full min-h-[44px] rounded border border-border bg-bg px-3 py-2 text-base text-fg ' +
  'placeholder:text-muted focus:border-accent focus:outline-none';
const CARD = 'rounded border border-border bg-surface p-4 sm:p-5';
const BOTAO =
  'min-h-[44px] rounded bg-accent px-5 font-medium text-bg hover:opacity-90 disabled:opacity-60';

/** Mensagem de erro do servidor (ou uma padrão). */
const mensagemDeErro = (err, padrao) => err.response?.data?.message || padrao;

export default function Perfil() {
  const { user, atualizarUsuario } = useAuth();

  // ---------- Seção "Dados" ----------
  const [nome, setNome] = useState(user?.nome ?? '');
  const [sobrenome, setSobrenome] = useState(user?.sobrenome ?? '');
  const [salvandoDados, setSalvandoDados] = useState(false);
  const [erroDados, setErroDados] = useState('');
  const [okDados, setOkDados] = useState(false);

  // Se o usuário chegar/mudar depois da montagem (ex.: recarregou a página), preenche os campos.
  useEffect(() => {
    setNome(user?.nome ?? '');
    setSobrenome(user?.sobrenome ?? '');
  }, [user?.nome, user?.sobrenome]);

  async function salvarDados(e) {
    e.preventDefault();
    setOkDados(false);
    const n = validarNomeCampo(nome, 'Nome');
    const s = validarNomeCampo(sobrenome, 'Sobrenome');
    if (n.erro || s.erro) {
      setErroDados(n.erro || s.erro);
      return;
    }
    setErroDados('');
    setSalvandoDados(true);
    try {
      const { data } = await api.patch('/auth/perfil', { nome: n.valor, sobrenome: s.valor });
      atualizarUsuario(data.user); // a sidebar (e o menu do celular) mudam na hora
      setNome(n.valor);
      setSobrenome(s.valor);
      setOkDados(true);
    } catch (err) {
      setErroDados(mensagemDeErro(err, 'Não foi possível salvar os dados.'));
    } finally {
      setSalvandoDados(false);
    }
  }

  // ---------- Seção "Alterar senha" ----------
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState('');
  const [okSenha, setOkSenha] = useState(false);

  async function alterarSenha(e) {
    e.preventDefault();
    setOkSenha(false);

    // Mesmas regras do servidor, para responder já, sem ida à rede.
    if (!senhaAtual) return setErroSenha('Informe a senha atual.');
    if (novaSenha.length < 8) return setErroSenha('A nova senha deve ter ao menos 8 caracteres.');
    if (novaSenha === senhaAtual) return setErroSenha('A nova senha deve ser diferente da atual.');
    if (confirmacao !== novaSenha) return setErroSenha('A confirmação não é igual à nova senha.');

    setErroSenha('');
    setSalvandoSenha(true);
    try {
      await api.patch('/auth/senha', { senhaAtual, novaSenha, confirmacao });
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmacao('');
      setOkSenha(true);
    } catch (err) {
      setErroSenha(mensagemDeErro(err, 'Não foi possível alterar a senha.'));
    } finally {
      setSalvandoSenha(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Perfil</h1>

      {/* Dois cards lado a lado em telas largas; empilhados no celular/tablet. */}
      <div className="grid items-start gap-6 xl:grid-cols-2">
        {/* ---------- Dados ---------- */}
        <form onSubmit={salvarDados} className={`${CARD} space-y-4`} aria-label="Dados do perfil">
          <h2 className="text-sm font-medium text-muted">Dados</h2>

          {!user?.nome && (
            <p className="text-sm text-muted">
              Você ainda não informou seu nome. Preencha abaixo para ele aparecer no menu.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-muted">
              Nome
              <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={NOME_MAX} autoComplete="given-name" className={INPUT} />
            </label>
            <label className="block text-sm text-muted">
              Sobrenome
              <input value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} maxLength={NOME_MAX} autoComplete="family-name" className={INPUT} />
            </label>
          </div>

          {/* E-mail: só exibição (não editável). */}
          <label className="block text-sm text-muted">
            E-mail
            <input value={user?.email ?? ''} readOnly aria-readonly="true" className={`${INPUT} cursor-not-allowed text-muted`} />
          </label>

          {erroDados && <p role="alert" className="text-sm text-negative">{erroDados}</p>}
          {okDados && !erroDados && <p role="status" className="text-sm text-positive">Dados salvos.</p>}

          <button disabled={salvandoDados} className={BOTAO}>
            {salvandoDados ? 'Salvando…' : 'Salvar'}
          </button>
        </form>

        {/* ---------- Alterar senha ---------- */}
        <form onSubmit={alterarSenha} className={`${CARD} space-y-4`} aria-label="Alterar senha">
          <h2 className="text-sm font-medium text-muted">Alterar senha</h2>

          <CampoSenha rotulo="Senha atual" value={senhaAtual} onChange={setSenhaAtual} autoComplete="current-password" />
          <CampoSenha rotulo="Nova senha" value={novaSenha} onChange={setNovaSenha} autoComplete="new-password" />
          <CampoSenha rotulo="Confirmar nova senha" value={confirmacao} onChange={setConfirmacao} autoComplete="new-password" />
          <p className="text-xs text-muted">A nova senha deve ter ao menos 8 caracteres e ser diferente da atual.</p>

          {erroSenha && <p role="alert" className="text-sm text-negative">{erroSenha}</p>}
          {okSenha && !erroSenha && <p role="status" className="text-sm text-positive">Senha alterada com sucesso.</p>}

          <button disabled={salvandoSenha} className={BOTAO}>
            {salvandoSenha ? 'Alterando…' : 'Alterar senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
