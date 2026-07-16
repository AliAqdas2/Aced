import { useGetMe, getGetMeQueryKey } from '@workspace/api-client-react';

export function useAuth() {
  const { data, isLoading, error } = useGetMe({
    query: {
      retry: false,
      queryKey: getGetMeQueryKey(),
    }
  });

  const isAuthenticated = !!data && !error;
  
  return {
    user: data?.data,
    isAuthenticated,
    isLoading,
    isCreator: data?.data?.role === 'creator',
    isAdmin: data?.data?.role === 'admin',
  };
}
