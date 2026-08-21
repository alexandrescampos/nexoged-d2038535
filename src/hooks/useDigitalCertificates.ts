import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { certificateRepository, type CertificateScope } from "@/repository/certificateRepository";

export const CERTIFICATES_QUERY_KEY = ["digital-certificates"] as const;

export function useDigitalCertificates() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CERTIFICATES_QUERY_KEY,
    queryFn: () => certificateRepository.listAvailable(),
    staleTime: 60_000,
  });

  const upload = useMutation({
    mutationFn: (params: { scope: CertificateScope; file: File; password: string }) =>
      certificateRepository.upload(params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CERTIFICATES_QUERY_KEY }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => certificateRepository.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CERTIFICATES_QUERY_KEY }),
  });

  const certificates = query.data ?? [];

  return {
    certificates,
    userCertificate: certificates.find((c) => c.owner_type === "USUARIO") ?? null,
    orgCertificate: certificates.find((c) => c.owner_type === "ORGANIZACAO") ?? null,
    isLoading: query.isLoading,
    upload,
    remove,
  };
}

/** Dias restantes até o vencimento (negativo quando vencido). */
export function daysUntil(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
}
