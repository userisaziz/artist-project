import { useMutation } from '@tanstack/react-query';
import * as authApi from '../../api/auth/auth';
import * as accountApi from '../../api/account/account';
import { useAuth } from '../../context/auth/auth-provider';

// Auth request hooks: screens read isPending/error from here instead of hand-rolling async state.

/** POST /auth/otp/request — text a login code to a staff phone (E.164). */
export function useRequestOtp() {
  return useMutation({ mutationFn: authApi.requestOtp });
}

/** DELETE /users/me, then sign out on this device: the server has already ended every session. */
export function useDeleteAccount() {
  const { signOut } = useAuth();
  return useMutation({ mutationFn: accountApi.deleteAccount, onSuccess: () => signOut() });
}
