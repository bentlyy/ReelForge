import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  ASSET_KINDS,
  type Asset,
  type AssetKind,
  type CreateAssetInput,
  type PipelineStage,
} from "@reel-engine/shared";
import { ErrorState, LoadingState } from "./States";
import { assetsApi } from "../api/resources";
import { qk } from "../api/queryKeys";

const KIND_LABELS: Record<AssetKind, string> = {
  image: "Imagen",
  audio: "Audio",
  subtitle: "Subtítulos",
  video: "Video",
  manifest: "Manifest",
  other: "Otro",
};

type FormState = {
  stageId: string;
  kind: AssetKind;
  relativePath: string;
  mimeType: string;
};

function formatSize(bytes: number | null) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function AssetsPanel({
  episodeId,
  stages,
}: {
  episodeId: string;
  stages: PipelineStage[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    stageId: "",
    kind: "other",
    relativePath: "",
    mimeType: "",
  });

  const assets = useQuery({
    queryKey: qk.assets(episodeId),
    queryFn: () => assetsApi.list(episodeId).then((r) => r.data),
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.assets(episodeId) });
    qc.invalidateQueries({ queryKey: qk.history(episodeId) });
  };
  const create = useMutation({
    mutationFn: (body: CreateAssetInput) => assetsApi.create(episodeId, body),
    onSuccess: () => {
      setOpen(false);
      invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (assetId: string) => assetsApi.remove(episodeId, assetId),
    onSuccess: invalidate,
  });

  const openDialog = () => {
    setForm({
      stageId: "",
      kind: "other",
      relativePath: `episodes/${episodeId}/`,
      mimeType: "",
    });
    create.reset();
    setOpen(true);
  };

  const submit = () => {
    const body: CreateAssetInput = {
      kind: form.kind,
      relativePath: form.relativePath.trim(),
      ...(form.stageId ? { stageId: form.stageId } : {}),
      ...(form.mimeType.trim() ? { mimeType: form.mimeType.trim() } : {}),
    };
    create.mutate(body);
  };

  const stageLabel = (stageId: string | null) =>
    stages.find((s) => s.id === stageId)?.stageType ?? "—";

  return (
    <Paper sx={{ p: 2, mt: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Assets</Typography>
        <Button size="small" variant="contained" onClick={openDialog}>
          Importar asset
        </Button>
      </Stack>
      <Divider sx={{ my: 1.5 }} />
      {assets.isLoading ? (
        <LoadingState />
      ) : assets.error ? (
        <ErrorState
          message={(assets.error as any).message}
          onRetry={() => assets.refetch()}
        />
      ) : !assets.data?.length ? (
        <Typography color="text.secondary">
          Sin assets. Coloca archivos bajo <code>storage/episodes/{episodeId}/</code> y regístralos
          aquí.
        </Typography>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tipo</TableCell>
                <TableCell>Etapa</TableCell>
                <TableCell>Ruta</TableCell>
                <TableCell>Tamaño</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assets.data.map((asset: Asset) => (
                <TableRow key={asset.id}>
                  <TableCell>{KIND_LABELS[asset.kind as AssetKind] ?? asset.kind}</TableCell>
                  <TableCell>{stageLabel(asset.stageId)}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>
                    {asset.relativePath}
                  </TableCell>
                  <TableCell>{formatSize(asset.sizeBytes)}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      color="error"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm(`¿Eliminar ${asset.relativePath}?`)) {
                          remove.mutate(asset.id);
                        }
                      }}
                    >
                      Eliminar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
      {remove.error && (
        <Box sx={{ mt: 1 }}>
          <ErrorState message={(remove.error as any).message} />
        </Box>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Importar asset</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              Coloca el archivo bajo <code>storage/episodes/{episodeId}/…</code> y registra aquí su
              ruta relativa. No se sube contenido desde el navegador.
            </Alert>
            <TextField
              select
              label="Etapa (opcional)"
              value={form.stageId}
              onChange={(e) => setForm({ ...form, stageId: e.target.value })}
            >
              <MenuItem value="">Sin etapa (nivel episodio)</MenuItem>
              {stages.map((stage) => (
                <MenuItem key={stage.id} value={stage.id}>
                  {stage.stageType}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Tipo"
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as AssetKind })}
            >
              {ASSET_KINDS.map((kind) => (
                <MenuItem key={kind} value={kind}>
                  {KIND_LABELS[kind]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Ruta relativa a storage/"
              value={form.relativePath}
              onChange={(e) => setForm({ ...form, relativePath: e.target.value })}
              required
              placeholder={`episodes/${episodeId}/script/archivo.txt`}
              helperText="Usa / y rutas relativas; el archivo debe existir."
            />
            <TextField
              label="MIME type (opcional)"
              value={form.mimeType}
              onChange={(e) => setForm({ ...form, mimeType: e.target.value })}
              placeholder="image/png"
              helperText="Si se omite, se infiere por la extensión."
            />
            {create.error && <ErrorState message={(create.error as any).message} />}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={submit}
            disabled={create.isPending || !form.relativePath.trim()}
          >
            Importar
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
