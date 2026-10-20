import { useMutation } from '@tanstack/react-query';
import * as authApi from '../../api/auth/auth';

// Auth request hooks: screens read isPending/error from here instead of hand-rolling async state.

/** POST /auth/otp/request — text a login code to a staff phone (E.164). */
export function useRequestOtp() {
  return useMutation({ mutationFn: authApi.requestOtp });
}
