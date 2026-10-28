import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import type { Screen } from '../navigation/types';

interface AuthScreenProps {
  onNavigate: (screen: Screen) => void;
  onHome: () => void;
}

type Mode = 'login' | 'register' | 'forgot' | 'new_password';
type AccountSection = 'name' | 'email' | 'password';

function AccountFold({
  label,
  value,
  open,
  controlsId,
  disabled,
  onToggle,
  children,
}: {
  label: string;
  value: string;
  open: boolean;
  controlsId: string;
  disabled: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`account-fold${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="account-fold-summary"
        aria-expanded={open}
        aria-controls={open ? controlsId : undefined}
        disabled={disabled}
        onClick={onToggle}
      >
        <span className="account-fold-label">{label}</span>
        <span className="account-fold-value">{value}</span>
        <span className="account-fold-chevron" aria-hidden="true" />
      </button>
      {open ? (
        <div id={controlsId} className="account-fold-body">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function AuthScreen({ onHome }: AuthScreenProps) {
  const {
    configured,
    user,
    displayName,
    passwordRecovery,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    updatePassword,
    updateDisplayName,
    updateEmail,
  } = useAuth();
  const openedAsGuestRef = useRef(!user);
  const [mode, setMode] = useState<Mode>(
    passwordRecovery ? 'new_password' : 'login',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [regName, setRegName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Account panel (logged-in)
  const [nameDraft, setNameDraft] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [accountBusy, setAccountBusy] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountInfo, setAccountInfo] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<AccountSection | null>(null);

  useEffect(() => {
    if (passwordRecovery) setMode('new_password');
  }, [passwordRecovery]);

  useEffect(() => {
    // After login/register from this screen — not during password recovery.
    if (
      user &&
      openedAsGuestRef.current &&
      !passwordRecovery &&
      mode !== 'new_password'
    ) {
      onHome();
    }
  }, [user, onHome, passwordRecovery, mode]);

  useEffect(() => {
    if (!user) return;
    setNameDraft(displayName);
    setEmailDraft(user.email ?? '');
  }, [user, displayName]);

  useEffect(() => {
    if (!openSection) return;
    const fieldId =
      openSection === 'name'
        ? 'account-name'
        : openSection === 'email'
          ? 'account-email'
          : 'account-password';
    document.getElementById(fieldId)?.focus();
  }, [openSection]);

  const toggleSection = (section: AccountSection) => {
    setOpenSection((current) => (current === section ? null : section));
    setAccountError(null);
    setAccountInfo(null);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setPassword('');
    setPasswordConfirm('');
    setError(null);
    setInfo(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (mode === 'forgot') {
      if (!email.trim()) {
        setError('Ievadiet e-pasta adresi.');
        return;
      }
      setBusy(true);
      try {
        await requestPasswordReset(email);
        setInfo(
          'Ja konts ar šo e-pastu eksistē, nosūtījām saiti paroles maiņai. Pārbaudiet pastkasti (un spam).',
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Neizdevās.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === 'new_password') {
      if (!password) {
        setError('Ievadiet jauno paroli.');
        return;
      }
      if (password.length < 6) {
        setError('Parolei jābūt vismaz 6 rakstzīmēm.');
        return;
      }
      if (password !== passwordConfirm) {
        setError('Paroles nesakrīt. Ievadiet to pašu paroli abos laukos.');
        return;
      }
      setBusy(true);
      try {
        await updatePassword(password);
        setInfo('Parole nomainīta. Tagad esat ielogoti.');
        window.setTimeout(() => onHome(), 800);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Neizdevās.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!email.trim() || !password) {
      setError('Ievadiet e-pastu un paroli.');
      return;
    }
    if (password.length < 6) {
      setError('Parolei jābūt vismaz 6 rakstzīmēm.');
      return;
    }
    if (mode === 'register' && password !== passwordConfirm) {
      setError('Paroles nesakrīt. Ievadiet to pašu paroli abos laukos.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
        setInfo('Ielogots. Progress tiek sinhronizēts…');
      } else {
        const { needsEmailConfirm } = await signUp(email, password, regName);
        if (needsEmailConfirm) {
          setInfo(
            'Konts izveidots. Pārbaudiet e-pastu un apstipriniet reģistrāciju, tad ielogojieties.',
          );
        } else {
          setInfo('Konts izveidots. Progress tiek sinhronizēts…');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neizdevās.');
    } finally {
      setBusy(false);
    }
  };

  const runAccountAction = async (
    key: string,
    action: () => Promise<void>,
    success: string,
  ) => {
    setAccountError(null);
    setAccountInfo(null);
    setAccountBusy(key);
    try {
      await action();
      setAccountInfo(success);
      setOpenSection(null);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Neizdevās.');
    } finally {
      setAccountBusy(null);
    }
  };

  const saveName = () =>
    void runAccountAction(
      'name',
      () => updateDisplayName(nameDraft),
      nameDraft.trim()
        ? 'Vārds saglabāts.'
        : 'Vārds noņemts.',
    );

  const saveEmail = () => {
    if (!emailDraft.trim()) {
      setAccountError('Ievadiet e-pasta adresi.');
      return;
    }
    if (emailDraft.trim() === (user?.email ?? '')) {
      setAccountError('Jaunais e-pasts sakrīt ar pašreizējo.');
      return;
    }
    void runAccountAction(
      'email',
      () => updateEmail(emailDraft),
      'Nosūtījām apstiprinājuma saiti uz jauno e-pastu. Pārbaudiet pastkasti.',
    );
  };

  const savePassword = () => {
    if (!newPassword) {
      setAccountError('Ievadiet jauno paroli.');
      return;
    }
    if (newPassword.length < 6) {
      setAccountError('Parolei jābūt vismaz 6 rakstzīmēm.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setAccountError('Paroles nesakrīt. Ievadiet to pašu paroli abos laukos.');
      return;
    }
    void runAccountAction(
      'password',
      async () => {
        await updatePassword(newPassword);
        setNewPassword('');
        setNewPasswordConfirm('');
      },
      'Parole nomainīta.',
    );
  };

  const handleSignOut = () =>
    void runAccountAction(
      'signout',
      async () => {
        await signOut();
        onHome();
      },
      'Izrakstīts.',
    );

  if (!configured) {
    return (
      <Layout onHome={onHome}>
        <p className="lead account-copy">Konts šobrīd nav pieejams.</p>
        <p className="muted account-copy">
          Izstrādātājam jāpievieno Supabase atslēgas (
          <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code>
          ).
        </p>
        <p className="muted account-copy">
          Bez konta progress joprojām saglabājas šajā ierīcē.
        </p>
      </Layout>
    );
  }

  if (
    user &&
    !openedAsGuestRef.current &&
    !passwordRecovery &&
    mode !== 'new_password'
  ) {
    const busyNow = accountBusy !== null;
    return (
      <Layout onHome={onHome}>
        <div className="account-panel stack">
          <p className="lead account-copy">Konts</p>
          <p className="muted account-copy">
            Progress tiek saglabāts mākonī un ir pieejams citā ierīcē.
          </p>

          <div className="account-folds">
            <AccountFold
              label="Vārds"
              value={displayName.trim() || 'Nav norādīts'}
              open={openSection === 'name'}
              controlsId="account-name-panel"
              disabled={busyNow}
              onToggle={() => toggleSection('name')}
            >
              {!displayName ? (
                <p className="muted account-copy account-hint">
                  Vārds palīdz atpazīt kontu. Varat to iestatīt tagad.
                </p>
              ) : null}
              <input
                id="account-name"
                className="text-input"
                type="text"
                autoComplete="name"
                aria-label="Vārds"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                disabled={busyNow}
                maxLength={80}
              />
              <Button variant="secondary" disabled={busyNow} onClick={saveName}>
                {accountBusy === 'name' ? 'Gaidiet…' : 'Saglabāt vārdu'}
              </Button>
            </AccountFold>

            <AccountFold
              label="E-pasts"
              value={user.email || 'Nav norādīts'}
              open={openSection === 'email'}
              controlsId="account-email-panel"
              disabled={busyNow}
              onToggle={() => toggleSection('email')}
            >
              <label className="settings-label account-copy" htmlFor="account-email">
                Jaunais e-pasts
              </label>
              <input
                id="account-email"
                className="text-input"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                disabled={busyNow}
              />
              <Button variant="secondary" disabled={busyNow} onClick={saveEmail}>
                {accountBusy === 'email' ? 'Gaidiet…' : 'Nomainīt e-pastu'}
              </Button>
            </AccountFold>

            <AccountFold
              label="Parole"
              value="••••••••"
              open={openSection === 'password'}
              controlsId="account-password-panel"
              disabled={busyNow}
              onToggle={() => toggleSection('password')}
            >
              <label
                className="settings-label account-copy"
                htmlFor="account-password"
              >
                Jaunā parole
              </label>
              <input
                id="account-password"
                className="text-input"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={busyNow}
                minLength={6}
              />
              <label
                className="settings-label account-copy"
                htmlFor="account-password-confirm"
              >
                Atkārtojiet paroli
              </label>
              <input
                id="account-password-confirm"
                className="text-input"
                type="password"
                autoComplete="new-password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                disabled={busyNow}
                minLength={6}
              />
              <Button
                variant="secondary"
                disabled={busyNow}
                onClick={savePassword}
              >
                {accountBusy === 'password' ? 'Gaidiet…' : 'Nomainīt paroli'}
              </Button>
            </AccountFold>
          </div>

          {accountError ? (
            <p className="auth-error" role="alert">
              {accountError}
            </p>
          ) : null}
          {accountInfo ? (
            <p className="auth-info" role="status">
              {accountInfo}
            </p>
          ) : null}

          <Button
            variant="danger"
            disabled={busyNow}
            onClick={handleSignOut}
          >
            {accountBusy === 'signout' ? 'Izrakstās…' : 'Izrakstīties'}
          </Button>

          <Button variant="neutral" disabled={busyNow} onClick={onHome}>
            Uz sākumu
          </Button>
        </div>
      </Layout>
    );
  }

  const showModeTabs = mode === 'login' || mode === 'register';

  return (
    <Layout onHome={onHome}>
      {mode === 'forgot' ? (
        <p className="muted settings-hint account-copy">
          Ievadiet e-pastu — nosūtīsim saiti, lai iestatītu jaunu paroli.
        </p>
      ) : mode === 'new_password' ? (
        <p className="muted settings-hint account-copy">
          Izvēlieties jaunu paroli savam kontam.
        </p>
      ) : (
        <p className="muted settings-hint account-copy">
          Ar kontu progress saglabājas mākonī un ir pieejams citā ierīcē. Bez
          konta viss paliek tikai šajā ierīcē.
        </p>
      )}

      {showModeTabs ? (
        <div className="btn-row auth-mode-row" role="tablist" aria-label="Režīms">
          <Button
            variant={mode === 'login' ? 'primary' : 'secondary'}
            onClick={() => switchMode('login')}
          >
            Ielogoties
          </Button>
          <Button
            variant={mode === 'register' ? 'primary' : 'secondary'}
            onClick={() => switchMode('register')}
          >
            Reģistrēties
          </Button>
        </div>
      ) : null}

      <form className="auth-form stack" onSubmit={(e) => void submit(e)}>
        {mode === 'register' ? (
          <>
            <label className="settings-label account-copy" htmlFor="auth-name">
              Vārds (nav obligāti)
            </label>
            <input
              id="auth-name"
              className="text-input"
              type="text"
              autoComplete="name"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              disabled={busy}
              maxLength={80}
            />
          </>
        ) : null}

        {mode !== 'new_password' ? (
          <>
            <label className="settings-label account-copy" htmlFor="auth-email">
              E-pasts
            </label>
            <input
              id="auth-email"
              className="text-input"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              required
            />
          </>
        ) : null}

        {mode !== 'forgot' ? (
          <>
            <label
              className="settings-label account-copy"
              htmlFor="auth-password"
            >
              {mode === 'new_password' ? 'Jaunā parole' : 'Parole'}
            </label>
            <input
              id="auth-password"
              className="text-input"
              type="password"
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              minLength={6}
              required
            />
          </>
        ) : null}

        {mode === 'register' || mode === 'new_password' ? (
          <>
            <label
              className="settings-label account-copy"
              htmlFor="auth-password-confirm"
            >
              Atkārtojiet paroli
            </label>
            <input
              id="auth-password-confirm"
              className="text-input"
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              disabled={busy}
              minLength={6}
              required
            />
          </>
        ) : null}

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="auth-info" role="status">
            {info}
          </p>
        ) : null}

        <Button type="submit" variant="primary" disabled={busy}>
          {busy
            ? 'Gaidiet…'
            : mode === 'login'
              ? 'Ielogoties'
              : mode === 'register'
                ? 'Izveidot kontu'
                : mode === 'forgot'
                  ? 'Nosūtīt saiti'
                  : 'Saglabāt jauno paroli'}
        </Button>

        {mode === 'login' ? (
          <button
            type="button"
            className="auth-forgot-link"
            onClick={() => switchMode('forgot')}
            disabled={busy}
          >
            Aizmirsu paroli?
          </button>
        ) : null}

        {mode === 'forgot' || mode === 'new_password' ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => switchMode('login')}
          >
            Atpakaļ uz ielogoties
          </Button>
        ) : null}
      </form>
    </Layout>
  );
}
