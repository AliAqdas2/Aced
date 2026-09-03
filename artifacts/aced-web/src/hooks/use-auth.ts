import { useGetMe, getGetMeQueryKey } from '@workspace/api-client-react';

export function useAuth() {
  const { data, isLoading } = useGetMe({
    query: {
      retry: false,
      queryKey: getGetMeQueryKey(),
    }
  });

  const isAuthenticated = !!data?.data;

  return {
    user: data?.data,
    isAuthenticated,
    isLoading,
    /** Every signed-in account can learn (book, buy, library). Tutoring is additive. */
    isLearner: isAuthenticated,
    isCreator: data?.data?.role === 'creator',
    isAdmin: data?.data?.role === 'admin',
  };
}
