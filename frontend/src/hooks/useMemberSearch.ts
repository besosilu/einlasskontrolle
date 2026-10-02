import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { membersApi } from '@/api/members';
import type { Member } from '@/types';

export function useMemberSearch() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: suggestions = [], isFetching } = useQuery<Member[]>({
    queryKey: ['member-search', debouncedQuery],
    queryFn: () => membersApi.search(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 10_000,
  });

  return { query, setQuery, suggestions, isFetching };
}
