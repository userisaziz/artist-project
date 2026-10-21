import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as addressesApi from '../../api/addresses/addresses';
import { useAuth } from '../../context/auth/auth-provider';
import type { AddressInput } from '../../types/addresses/addresses';
import type { AddressBook } from '../../components/common/AddressPicker';

// Keyed by user id, so another account on the device never sees cached addresses.
export const addressKeys = { mine: (userId: string | undefined) => ['addresses', userId] as const };

const FIRST_LABEL = 'Home';
const NEXT_LABEL = 'Other';

export function useAddresses() {
  const { user } = useAuth();
  return useQuery({ queryKey: addressKeys.mine(user?.id), queryFn: addressesApi.listAddresses, enabled: !!user });
}

function useAddressWrite<TVars>(write: (vars: TVars) => Promise<unknown>) {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({ mutationFn: write, onSuccess: () => client.invalidateQueries({ queryKey: addressKeys.mine(user?.id) }) });
}

export const useAddAddress = () => useAddressWrite((body: AddressInput) => addressesApi.addAddress(body));
export const useUpdateAddress = () => useAddressWrite(({ id, body }: { id: string; body: Partial<AddressInput> }) => addressesApi.updateAddress(id, body));
export const useDeleteAddress = () => useAddressWrite((id: string) => addressesApi.deleteAddress(id));
const useMarkUsed = () => useAddressWrite((id: string) => addressesApi.markAddressUsed(id));

/** The address book booking review and checkout show. Remembering or marking is best effort after the booking or
 *  order already succeeded, so a failure there never undoes it; the list simply stays as it was. */
export function useAddressBook(): AddressBook {
  const addresses = useAddresses();
  const add = useAddAddress();
  const markUsed = useMarkUsed();
  const data = addresses.data;
  return useMemo(() => ({
    choices: (data ?? []).map(({ id, label, address }) => ({ id, label, address })),
    afterUse: (address: string, pickedId: string | null, remember: boolean) => {
      if (pickedId) markUsed.mutate(pickedId);
      else if (remember && address.trim()) add.mutate({ label: data?.length ? NEXT_LABEL : FIRST_LABEL, address: address.trim() });
    },
  }), [data, add, markUsed]);
}
