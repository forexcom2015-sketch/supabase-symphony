import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { adminListUsers, adminUpdateUserField } from '@/lib/admin.functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ShieldAlert } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/admin')({
  validateSearch: (s: Record<string, unknown>) => ({
    userId: typeof s.userId === 'string' ? s.userId : undefined,
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 max-w-xl mx-auto">
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <ShieldAlert className="size-5 text-destructive" />
          <CardTitle>Acesso restrito</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{error.message}</CardContent>
      </Card>
    </div>
  ),
  component: AdminPage,
});

function AdminPage() {
  const { userId } = Route.useSearch();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () => adminListUsers({ search: search || undefined }),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Painel Administrativo</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie perfis e plano dos usuários. Todas as alterações são auditadas.
        </p>
      </div>

      <div className="grid md:grid-cols-[360px_1fr] gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usuários</CardTitle>
            <Input
              placeholder="Buscar por nome ou usuário"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-2"
            />
          </CardHeader>
          <CardContent className="space-y-1 max-h-[70vh] overflow-auto">
            {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
            {(data as any[])?.map((u: any) => (
              <button
                key={u.id}
                onClick={() => navigate({ to: '/admin', search: { userId: u.id } })}
                className={`w-full text-left p-2 rounded hover:bg-muted text-sm ${
                  userId === u.id ? 'bg-muted' : ''
                }`}
              >
                <div className="font-medium truncate">{u.full_name || u.username}</div>
                <Badge variant="outline" className="mt-1 text-[10px]">
                  {u.plan_tier ?? 'free'}
                </Badge>
              </button>
            ))}
          </CardContent>
        </Card>

        <div>{userId ? <UserDetail userId={userId} /> : <EmptyDetail />}</div>
      </div>
    </div>
  );
}

function EmptyDetail() {
  return (
    <Card>
      <CardContent className="p-10 text-center text-sm text-muted-foreground">
        Selecione um usuário para editar.
      </CardContent>
    </Card>
  );
}

function UserDetail({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      for (const [field, value] of Object.entries(updates)) {
        await adminUpdateUserField(userId, field, value);
      }
    },
    onSuccess: () => {
      toast.success('Salvo com sucesso');
      setForm({});
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const get = (k: string) => form[k] ?? '';
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Editar usuário</CardTitle>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-4">
        <Field label="Nome completo">
          <Input value={get('full_name')} onChange={(e) => set('full_name', e.target.value)} />
        </Field>
        <Field label="Usuário">
          <Input value={get('username')} onChange={(e) => set('username', e.target.value)} />
        </Field>
        <Field label="Plano">
          <Select value={get('plan_tier') || 'free'} onValueChange={(v) => set('plan_tier', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="free">free</SelectItem>
              <SelectItem value="pro">pro</SelectItem>
              <SelectItem value="elite">elite</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="md:col-span-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setForm({})} disabled={mutation.isPending}>
            Reverter
          </Button>
          <Button
            onClick={() => {
              if (Object.keys(form).length === 0) return toast.info('Nenhuma alteração');
              mutation.mutate(form);
            }}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
