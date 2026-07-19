import { useQuery } from '@tanstack/react-query';
import type { UseQueryOptions, UseQueryResult, QueryKey } from '@tanstack/react-query';
import { customFetch } from './custom-fetch';
import type { Course } from './generated/api.schemas';

export interface CoursesResponse {
  data: Course[];
}

export const getListCoursesByUniversityUrl = (universityId: string) =>
  `/api/v1/taxonomy/courses?universityId=${encodeURIComponent(universityId)}`;

export const getListCoursesByUniversityQueryKey = (universityId: string) =>
  [`/api/v1/taxonomy/courses`, { universityId }] as const;

export const listCoursesByUniversity = async (
  universityId: string,
  options?: RequestInit,
): Promise<CoursesResponse> =>
  customFetch<CoursesResponse>(getListCoursesByUniversityUrl(universityId), {
    ...options,
    method: 'GET',
  });

function withQueryKey<TData, TError>(
  query: UseQueryResult<TData, TError>,
  queryKey: QueryKey,
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  return Object.assign(query, { queryKey });
}

type PartialQueryOptions<TData, TError> = Omit<
  UseQueryOptions<Awaited<ReturnType<typeof listCoursesByUniversity>>, TError, TData>,
  'queryKey' | 'queryFn'
> & {
  queryKey?: QueryKey;
};

export function useListCoursesByUniversity<
  TData = Awaited<ReturnType<typeof listCoursesByUniversity>>,
  TError = unknown,
>(
  universityId: string,
  options?: { query?: PartialQueryOptions<TData, TError> },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const { query: queryOptions } = options ?? {};
  const queryKey: QueryKey = queryOptions?.queryKey ?? getListCoursesByUniversityQueryKey(universityId);
  const queryFn = ({ signal }: { signal?: AbortSignal }) =>
    listCoursesByUniversity(universityId, { signal });

  const { queryKey: _qk, ...restQueryOptions } = queryOptions ?? {};

  const query = useQuery({
    queryKey,
    queryFn,
    enabled: Boolean(universityId),
    ...restQueryOptions,
  } as UseQueryOptions<Awaited<ReturnType<typeof listCoursesByUniversity>>, TError, TData>);

  return withQueryKey(query as UseQueryResult<TData, TError>, queryKey);
}
