import { create } from 'zustand';
import type { Account, AuthProvider, AuthProviderId } from '@/auth';
import { AuthError, authProviders, createAuthProvider } from '@/auth';
import { deleteAccount, getAccount, saveAccount } from '@/storage';
import { useRiderStore } from './riderStore';

interface AccountState {
  account: Account | null;
  signingIn: AuthProviderId | null;
  lastError: AuthError['code'] | null;

  load: () => Promise<void>;
  signIn: (id: AuthProviderId) => Promise<Account>;
  signOut: () => Promise<void>;
  providers: () => AuthProvider[];
}

export const useAccountStore = create<AccountState>((set) => ({
  account: null,
  signingIn: null,
  lastError: null,

  load: async () => {
    set({ account: (await getAccount()) ?? null });
  },

  signIn: async (id) => {
    set({ signingIn: id, lastError: null });
    try {
      const account = await createAuthProvider(id).signIn();
      await saveAccount(account);
      set({ account, signingIn: null });

      // A named account is worth showing on the profile, but only if the rider
      // already consented to a profile existing; signing in is not consent.
      const rider = useRiderStore.getState();
      if (account.displayName && rider.profile?.consentGiven) {
        await rider.update({ displayName: account.displayName });
      }
      return account;
    } catch (error) {
      set({
        signingIn: null,
        lastError: error instanceof AuthError ? error.code : 'failed',
      });
      throw error;
    }
  },

  /**
   * Ends the local session. The rider's runs and profile stay on the device:
   * signing out is not a request to delete data, and conflating the two would
   * lose work.
   */
  signOut: async () => {
    await deleteAccount();
    set({ account: null, lastError: null });
  },

  providers: () => authProviders(),
}));
