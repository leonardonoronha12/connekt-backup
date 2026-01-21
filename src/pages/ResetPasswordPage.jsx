import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

function translateResetErrorMessage(message) {
  const msg = String(message || '').trim()
  if (!msg) return msg
  const map = {
    'New password should be different from the old password.': 'A nova senha deve ser diferente da senha atual.',
    'Password should be at least 6 characters.': 'A senha deve ter pelo menos 6 caracteres.',
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
    'Password is too weak': 'Senha muito fraca.',
    'Invalid refresh token': 'Link de redefinição expirado. Solicite um novo.',
    'JWT expired': 'Link de redefinição expirado. Solicite um novo.',
  }
  if (map[msg]) return map[msg]
  if (msg.toLowerCase().includes('new password') && msg.toLowerCase().includes('old password')) {
    return 'A nova senha deve ser diferente da senha atual.'
  }
  return msg
}

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        const sess = data?.session || null;
        setHasSession(!!sess);
        const emailFromSession = sess?.user?.email || '';
        if (emailFromSession) {
          setEmail(emailFromSession);
          setLoading(false);
          return;
        }
        let stored = '';
        try { stored = localStorage.getItem('password_reset_email') || ''; } catch (_) {}
        setEmail(stored);
      } catch (e) {
        let stored = '';
        try { stored = localStorage.getItem('password_reset_email') || ''; } catch (_) {}
        if (active) setEmail(stored);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const canSubmit = useMemo(() => {
    const p = String(password || '');
    const c = String(confirm || '');
    return hasSession && !saving && p.length >= 6 && p === c;
  }, [password, confirm, hasSession, saving]);

  const goToLogin = () => {
    window.history.replaceState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!hasSession) {
      setError('Abra o link enviado no seu e-mail para redefinir sua senha.');
      return;
    }
    if (String(password || '').length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(translateResetErrorMessage(updateError.message) || 'Erro ao redefinir senha.');
        return;
      }
      setSuccess('Senha redefinida com sucesso.');
      try { await supabase.auth.signOut(); } catch (_) {}
      setTimeout(() => goToLogin(), 900);
    } catch (err) {
      setError(err?.message || 'Erro ao redefinir senha.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={goToLogin}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-10 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="font-semibold">Voltar</span>
        </button>

        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-gray-800 mb-2">Redefinir senha</h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              {email ? (
                <>
                  Defina uma nova senha para <span className="font-medium text-gray-700">{email}</span>.
                </>
              ) : (
                'Defina sua nova senha.'
              )}
            </p>
          </div>

          {!hasSession ? (
            <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm text-center">
              Abra o link enviado no seu e-mail para continuar.
            </div>
          ) : null}

          {error ? (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm text-center">
              {success}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-3 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all"
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                disabled={saving}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nova senha</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full h-12 px-3 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all"
                placeholder="Repita a senha"
                autoComplete="new-password"
                disabled={saving}
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Salvando...
                </div>
              ) : (
                'Redefinir senha'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

