import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/api';

const STAFF_KEY = 'staff';

// Fetch all staff members
export function useStaff() {
  return useQuery({
    queryKey: [STAFF_KEY],
    queryFn: async () => {
      const { data } = await api.get('/staff');
      return data;
    },
    staleTime: 1000 * 60 * 10, // 10 minuti - staff cambia meno frequentemente
  });
}

// Fetch single staff member
export function useStaffMember(id: string) {
  return useQuery({
    queryKey: [STAFF_KEY, id],
    queryFn: async () => {
      const { data } = await api.get(`/staff/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// Create staff member
export function useCreateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (staffData: any) => {
      const { data } = await api.post('/staff', staffData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STAFF_KEY] });
    },
  });
}

// Update staff member
export function useUpdateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { data: response } = await api.patch(`/staff/${id}`, data);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [STAFF_KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: [STAFF_KEY] });
    },
  });
}

// Delete staff member
export function useDeleteStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/staff/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STAFF_KEY] });
    },
  });
}
