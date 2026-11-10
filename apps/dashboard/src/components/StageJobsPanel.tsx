import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { ActivityEvent, JobStatus, QueuedJob } from "@reel-engine/shared";
import { ErrorState, LoadingState } from "./States";
import { jobsApi } from "../api/resources";
import { qk } from "../api/queryKeys";

const JOB_COLORS: Record<
  JobStatus,
  "default" | "info" | "success" | "warning" | "error"
> = {
  PENDING: "warning",
  LEASED: "info",
  RUNNING: "info",
  SUCCEEDED: "success",
  FAILED: "error",
  CANCELLED: "default",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function JobRow({ job }: { job: QueuedJob }) {
  const [showDetails, setShowDetails] = useState(false);
  return (
    <Paper variant="outlined" sx={{ p: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Chip size="small" label={job.status} color={JOB_COLORS[job.status]} />
        <Typography variant="body2">
          Intento {job.attempt}/{job.maxAttempts}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          creado {formatDate(job.createdAt)} · actualizado {formatDate(job.updatedAt)}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={() => setShowDetails(!showDetails)}>
          {showDetails ? "Ocultar detalle" : "Detalle"}
        </Button>
      </Stack>
      {job.errorMessage && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {job.errorCode ? `${job.errorCode}: ` : ""}
          {job.errorMessage}
        </Alert>
      )}
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
        runAfter {formatDate(job.runAfter)} · lease {job.leaseOwner ?? "—"} · expira{" "}
        {formatDate(job.leaseExpiresAt)}
      </Typography>
      <Collapse in={showDetails}>
        <Box
          component="pre"
          sx={{
            p: 1,
            mt: 1,
            bgcolor: "action.hover",
            borderRadius: 1,
            fontSize: 11,
            overflow: "auto",
            maxHeight: 220,
          }}
        >
          {JSON.stringify({ payload: job.payload, result: job.result }, null, 2)}
        </Box>
      </Collapse>
    </Paper>
  );
}

export function StageJobsPanel({
  stageId,
  events,
}: {
  stageId: string;
  events: ActivityEvent[];
}) {
  const [open, setOpen] = useState(false);
  const jobs = useQuery({
    queryKey: qk.stageJobs(stageId),
    queryFn: () => jobsApi.listByStage(stageId).then((r) => r.data),
    enabled: open,
  });

  const stageEvents = events.filter(
    (e) => (e.metadata as Record<string, unknown>)?.stageId === stageId,
  );

  return (
    <Box sx={{ mt: 1 }}>
      <Button size="small" variant="text" onClick={() => setOpen(!open)}>
        {open
          ? `Ocultar cola y logs${jobs.data ? ` (${jobs.data.length})` : ""}`
          : "Ver cola y logs"}
      </Button>
      <Collapse in={open}>
        <Box sx={{ mt: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2">Jobs</Typography>
            <Button
              size="small"
              onClick={() => jobs.refetch()}
              disabled={jobs.isFetching}
            >
              Actualizar
            </Button>
          </Stack>
          {jobs.isLoading ? (
            <LoadingState />
          ) : jobs.error ? (
            <ErrorState
              message={(jobs.error as any).message}
              onRetry={() => jobs.refetch()}
            />
          ) : !jobs.data?.length ? (
            <Typography variant="body2" color="text.secondary">
              Sin jobs. Usa «Encolar» para registrar uno; si el worker está desactivado quedará
              PENDING.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {jobs.data.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </Stack>
          )}
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="subtitle2" gutterBottom>
            Logs de la etapa
          </Typography>
          {!stageEvents.length ? (
            <Typography variant="body2" color="text.secondary">
              Sin eventos de esta etapa.
            </Typography>
          ) : (
            <Stack spacing={0.75}>
              {stageEvents.map((event) => (
                <Box key={event.id}>
                  <Typography variant="body2">{event.message}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {event.eventType} · {formatDate(event.createdAt)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
