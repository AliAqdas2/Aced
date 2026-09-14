import { useGetMe, getGetMeQueryKey } from '@workspace/api-client-react';

export function useAuth() {
  const { data, isLoading, isError } = useGetMe({
    query: {
      retry: false,
      queryKey: getGetMeQueryKey(),
    }
  });

  const isAuthenticated = !isError && !!data?.data;
  const role = data?.data?.role;
  const isAdmin = role === 'admin' || role === 'super_admin';

  return {
    user: data?.data,
    isAuthenticated,
    isLoading,
    /** Every signed-in account can learn (book, buy, library). Tutoring is additive. */
    isLearner: isAuthenticated,
    /** Admins/super_admins also have full creator capabilities. */
    isCreator: role === 'creator' || isAdmin,
    isAdmin,
  };
}
