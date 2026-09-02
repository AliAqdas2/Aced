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
    isCreator: data?.data?.role === 'creator',
    isAdmin: data?.data?.role === 'admin',
  };
}
