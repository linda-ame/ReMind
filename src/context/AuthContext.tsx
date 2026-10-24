import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextValue {
  configured: boolean;
  ready: boolean;
  session: Session | null;
  user: User | null;
  /** From profiles.display_name (empty string if unset). */
  displayName: string;
  /** True after the user opens the password-reset link from email. */
  passwordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<{ needsEmailConfirm: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  updateEmail: (email: string) => Promise<void>;
  clearPasswordRecovery: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'Nepareizs e-pasts vai parole.';
  }
  if (lower.includes('user already registered')) {
    return 'Šis e-pasts jau ir reģistrēts. Ielogojieties.';
  }
  if (lower.includes('password')) {
    return 'Parolei jābūt vismaz 6 rakstzīmēm.';
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Pārāk daudz mēģinājumu. Uzgaidiet un mēģiniet vēlreiz.';
  }
  if (lower.includes('email')) {
    return 'Pārbaudiet e-pasta adresi.';
  }
  return message || 'Autentifikācijas kļūda.';
}

function recoveryRedirectUrl(): string {
  return `${window.location.origin}/`;
}

async function fetchDisplayName(userId: string): Promise<string> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(mapAuthError(error.message));
  const name = data?.display_name;
  return typeof name === 'string' ? name.trim() : '';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [ready, setReady] = useState(!configured);
  const [session, setSession] = useState<Session | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!configured) return;

    const supabase = getSupabase();
    let cancelled = false;

    const loadProfile = async (user: User | null) => {
      if (!user) {
        if (!cancelled) setDisplayName('');
        return;
      }
      try {
        const name = await fetchDisplayName(user.id);
        if (!cancelled) setDisplayName(name);
      } catch {
        if (!cancelled) setDisplayName('');
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      void loadProfile(data.session?.user ?? null);
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      }
      setSession(next);
      void loadProfile(next?.user ?? null);
      setReady(true);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [configured]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(mapAuthError(error.message));
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayNameInput?: string) => {
      const trimmedName = displayNameInput?.trim() ?? '';
      const { data, error } = await getSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: trimmedName
          ? { data: { display_name: trimmedName } }
          : undefined,
      });
      if (error) throw new Error(mapAuthError(error.message));

      if (data.user && trimmedName) {
        const { error: profileError } = await getSupabase()
          .from('profiles')
          .update({ display_name: trimmedName })
          .eq('id', data.user.id);
        if (!profileError) setDisplayName(trimmedName);
      }

      const needsEmailConfirm = !data.session;
      return { needsEmailConfirm };
    },
    [],
  );

  const signOut = useCallback(async () => {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw new Error(mapAuthError(error.message));
    setPasswordRecovery(false);
    setDisplayName('');
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await getSupabase().auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: recoveryRedirectUrl() },
    );
    if (error) throw new Error(mapAuthError(error.message));
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) throw new Error(mapAuthError(error.message));
    setPasswordRecovery(false);
  }, []);

  const updateDisplayName = useCallback(async (name: string) => {
    const trimmed = name.trim();
    const {
      data: { user },
      error: userError,
    } = await getSupabase().auth.getUser();
    if (userError) throw new Error(mapAuthError(userError.message));
    if (!user) throw new Error('Nav ielogots.');

    const { error } = await getSupabase()
      .from('profiles')
      .update({ display_name: trimmed || null })
      .eq('id', user.id);
    if (error) throw new Error(mapAuthError(error.message));

    await getSupabase().auth.updateUser({
      data: { display_name: trimmed || null },
    });

    setDisplayName(trimmed);
  }, []);

  const updateEmail = useCallback(async (email: string) => {
    const trimmed = email.trim();
    if (!trimmed) throw new Error('Ievadiet e-pasta adresi.');
    const { error } = await getSupabase().auth.updateUser({ email: trimmed });
    if (error) throw new Error(mapAuthError(error.message));
  }, []);

  const clearPasswordRecovery = useCallback(() => {
    setPasswordRecovery(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      ready,
      session,
      user: session?.user ?? null,
      displayName,
      passwordRecovery,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      updateDisplayName,
      updateEmail,
      clearPasswordRecovery,
    }),
    [
      configured,
      ready,
      session,
      displayName,
      passwordRecovery,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      updateDisplayName,
      updateEmail,
      clearPasswordRecovery,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
