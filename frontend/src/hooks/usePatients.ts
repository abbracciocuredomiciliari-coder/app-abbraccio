import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/api';

const PATIENTS_KEY = 'patients';

// Fetch all patients with optional pagination
export function usePatients(page = 1, limit = 50) {
  return useQuery({
    queryKey: [PATIENTS_KEY, { page, limit }],
    queryFn: async () => {
      const { data } = await api.get(`/patients?page=${page}&limit=${limit}`);
      return data;
    },
  });
}

// Fetch single patient
export function usePatient(id: string) {
  return useQuery({
    queryKey: [PATIENTS_KEY, id],
    queryFn: async () => {
      const { data } = await api.get(`/patients/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// Create patient
export function useCreatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patientData: any) => {
      const { data } = await api.post('/patients', patientData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PATIENTS_KEY] });
    },
  });
}

// Update patient
export function useUpdatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { data: response } = await api.patch(`/patients/${id}`, data);
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [PATIENTS_KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: [PATIENTS_KEY] });
    },
  });
}

// Delete patient
export function useDeletePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/patients/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PATIENTS_KEY] });
    },
  });
}
