import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import {
  PROVIDER_KINDS,
  type ProviderKind,
  type StageProviderConfig,
  type StageProviderConfigUpdate,
} from "@reel-engine/shared";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, LoadingState } from "../components/States";
import { projectsApi, providerConfigsApi } from "../api/resources";
import { qk } from "../api/queryKeys";

const PROVIDER_LABELS: Record<ProviderKind, string> = {
  manual: "Manual",
  stub: "Stub",
  external_api: "API externa",
  local_cli: "CLI local",
};

type EditState = {
  stageType: string;
  providerKind: ProviderKind;
  enabled: boolean;
  configRef: string;
  timeoutMs: number;
  maxAttempts: number;
};

function toEditState(cfg: StageProviderConfig): EditState {
  return {
    stageType: cfg.stageType,
    providerKind: cfg.providerKind,
    enabled: cfg.enabled,
    configRef: cfg.configRef ?? "",
    timeoutMs: cfg.timeoutMs,
    maxAttempts: cfg.maxAttempts,
  };
}

export function ProvidersPage() {
  const qc = useQueryClient();
  const [scope, setScope] = useState<string>("global");
  const [editing, setEditing] = useState<EditState | null>(null);
  const projectId = scope === "global" ? null : scope;

  const projects = useQuery({
    queryKey: qk.projects,
    queryFn: () => projectsApi.list().then((r) => r.data),
  });
  const q = useQuery({
    queryKey: qk.providerConfigs(projectId),
    queryFn: () => providerConfigsApi.list(projectId).then((r) => r.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["provider-configs"] });
  const save = useMutation({
    mutationFn: (state: EditState) => {
      const { stageType, configRef, ...rest } = state;
      const body: StageProviderConfigUpdate = {
        ...rest,
        configRef: configRef.trim() ? configRef.trim() : undefined,
      };
      return providerConfigsApi.upsert(stageType, body, projectId);
    },
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });
  const reset = useMutation({
    mutationFn: (stageType: string) => providerConfigsApi.remove(stageType, projectId),
    onSuccess: invalidate,
  });

  const closeEdit = () => {
    setEditing(null);
    save.reset();
  };

  if (q.isLoading) return <LoadingState />;
  if (q.error || !q.data)
    return <ErrorState message={(q.error as any)?.message || "No disponible"} onRetry={() => q.refetch()} />;

  const view = q.data;

  return (
    <>
      <PageHeader
        title="Proveedores"
        action={
          <TextField
            select
            size="small"
            label="Ámbito"
            value={scope}
            onChange={(e) => {
              closeEdit();
              setScope(e.target.value);
            }}
            sx={{ minWidth: 260 }}
          >
            <MenuItem value="global">Global (todos los proyectos)</MenuItem>
            {(projects.data || []).map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>
        }
      />
      <Alert severity="info" sx={{ mb: 2 }}>
        La configuración global aplica a todos los proyectos; cada proyecto puede sobrescribir
        etapas. Solo se guardan referencias a variables de entorno (<code>configRef</code>), nunca
        secretos.
      </Alert>
      <Paper sx={{ overflowX: "auto" }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Etapa</TableCell>
              <TableCell>Proveedor</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Timeout</TableCell>
              <TableCell>Intentos</TableCell>
              <TableCell>configRef</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {view.effective.map((cfg) => {
              const override = view.configs.find((c) => c.stageType === cfg.stageType);
              return (
                <TableRow key={cfg.stageType}>
                  <TableCell>{cfg.stageType}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>{PROVIDER_LABELS[cfg.providerKind]}</span>
                      {projectId && (
                        <Chip
                          size="small"
                          label={override ? "Override" : "Heredado"}
                          color={override ? "primary" : "default"}
                          variant={override ? "filled" : "outlined"}
                        />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={cfg.enabled ? "Activo" : "Desactivado"}
                      color={cfg.enabled ? "success" : "default"}
                    />
                  </TableCell>
                  <TableCell>{cfg.timeoutMs.toLocaleString()} ms</TableCell>
                  <TableCell>{cfg.maxAttempts}</TableCell>
                  <TableCell>{cfg.configRef || "—"}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => setEditing(toEditState(cfg))}>
                      Editar
                    </Button>
                    {override && (
                      <Button
                        size="small"
                        color="warning"
                        onClick={() => reset.mutate(cfg.stageType)}
                        disabled={reset.isPending}
                      >
                        Restablecer
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>
      {reset.error && (
        <Box sx={{ mt: 2 }}>
          <ErrorState message={(reset.error as any).message} />
        </Box>
      )}
      <Dialog open={Boolean(editing)} onClose={closeEdit} fullWidth maxWidth="sm">
        <DialogTitle>Configurar {editing?.stageType}</DialogTitle>
        {editing && (
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                select
                label="Proveedor"
                value={editing.providerKind}
                onChange={(e) =>
                  setEditing({ ...editing, providerKind: e.target.value as ProviderKind })
                }
              >
                {PROVIDER_KINDS.map((kind) => (
                  <MenuItem key={kind} value={kind}>
                    {PROVIDER_LABELS[kind]}
                  </MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={
                  <Switch
                    checked={editing.enabled}
                    onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
                  />
                }
                label="Habilitado (si se desactiva, el worker usa stub)"
              />
              <TextField
                label="configRef (variable de entorno)"
                value={editing.configRef}
                onChange={(e) => setEditing({ ...editing, configRef: e.target.value })}
                helperText="Solo el nombre (A-Z, 0-9, _). Nunca el valor secreto."
                inputProps={{ maxLength: 81 }}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Timeout (ms)"
                  type="number"
                  value={editing.timeoutMs}
                  onChange={(e) =>
                    setEditing({ ...editing, timeoutMs: Number(e.target.value) })
                  }
                  inputProps={{ min: 1000, max: 3_600_000, step: 1000 }}
                  fullWidth
                />
                <TextField
                  label="Intentos máximos"
                  type="number"
                  value={editing.maxAttempts}
                  onChange={(e) =>
                    setEditing({ ...editing, maxAttempts: Number(e.target.value) })
                  }
                  inputProps={{ min: 1, max: 10 }}
                  fullWidth
                />
              </Stack>
              {save.error && <ErrorState message={(save.error as any).message} />}
            </Stack>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={closeEdit}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => editing && save.mutate(editing)}
            disabled={save.isPending}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
