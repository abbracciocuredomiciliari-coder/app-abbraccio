import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/api';

const WORKPLANS_KEY = 'workplans';

// Fetch work plans with filters
export function useWorkPlans(filters?: {
  patient?: string;
  staff?: string;
  type?: string;
  status?: string;
  from?: string;
  to?: string;
}) {
  return useQuery({
    queryKey: [WORKPLANS_KEY, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.patient) params.append('patient', filters.patient);
      if (filters?.staff) params.append('staff', filters.staff);
      if (filters?.type) params.append('type', filters.type);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.from) params.append('from', filters.from);
      if (filters?.to) params.append('to', filters.to);

      const { data } = await api.get(`/workplan?${params.toString()}`);
      return data;
    },
    staleTime: 1000 * 60 * 2, // 2 minuti - work plans cambiano frequentemente
  });
}

// Fetch single work plan
export function useWorkPlan(id: string) {
  return useQuery({
    queryKey: [WORKPLANS_KEY, id],
    queryFn: async () => {
      const { data } = await api.get(`/workplan/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// Create work plan
export function useCreateWorkPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workPlanData: any) => {
      const { data } = await api.post('/workplan', workPlanData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WORKPLANS_KEY] });
    },
  });
}

// Update work plan
export function useUpdateWorkPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { data: response } = await api.patch(`/workplan/${id}`, data);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [WORKPLANS_KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: [WORKPLANS_KEY] });
    },
  });
}

// Delete work plan
export function useDeleteWorkPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/workplan/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WORKPLANS_KEY] });
    },
  });
}

// Assign work plan to operator
export function useAssignWorkPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, operatorId }: { id: string; operatorId: string }) => {
      const { data } = await api.post(`/workplan/${id}/assign`, { operatorId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WORKPLANS_KEY] });
    },
  });
}
