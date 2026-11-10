import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Paper, Stack, Typography, Button, LinearProgress, Divider, Box, Grid } from "@mui/material";
import { PageHeader } from "../components/PageHeader";
import { episodesApi, pipelineApi } from "../api/resources";
import { qk } from "../api/queryKeys";
import { LoadingState, ErrorState } from "../components/States";
import { StatusChip } from "../components/StatusChip";
import { AssetsPanel } from "../components/AssetsPanel";
import { StageJobsPanel } from "../components/StageJobsPanel";
import type { ActivityEvent, PipelineStage } from "@reel-engine/shared";

function StageRow({ stage, events, onAction }: { stage: PipelineStage; events: ActivityEvent[]; onAction: (id:string,action:string)=>void }) {
  return (
    <Paper variant="outlined" sx={{p:1.5}}>
      <Stack direction={{xs:"column",sm:"row"}} spacing={1} alignItems={{sm:"center"}} justifyContent="space-between">
        <Box><Typography variant="subtitle1">{stage.stageOrder}. {stage.stageType}</Typography>
          <Typography variant="body2" color="text.secondary">{stage.note || "Sin nota"}</Typography></Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <StatusChip status={stage.status}/>
          {(stage.status==="PENDING"||stage.status==="FAILED"||stage.status==="CANCELLED") && <Button size="small" variant="contained" onClick={()=>onAction(stage.id,"start")}>Ejecutar stub</Button>}
          {(stage.status==="PENDING"||stage.status==="FAILED") && <Button size="small" variant="outlined" onClick={()=>onAction(stage.id,"enqueue")}>Encolar</Button>}
          {stage.status==="RUNNING" && <Button size="small" onClick={()=>onAction(stage.id,"complete")}>Completar</Button>}
          {stage.status==="WAITING_APPROVAL" && <>
            <Button size="small" color="success" variant="contained" onClick={()=>onAction(stage.id,"approve")}>Aprobar</Button>
            <Button size="small" color="error" onClick={()=>onAction(stage.id,"reject")}>Rechazar</Button>
          </>}
          {["PENDING","RUNNING","WAITING_APPROVAL","FAILED"].includes(stage.status) && <Button size="small" onClick={()=>onAction(stage.id,"cancel")}>Cancelar</Button>}
          {["FAILED","CANCELLED"].includes(stage.status) && <Button size="small" onClick={()=>onAction(stage.id,"retry")}>Reintentar</Button>}
        </Stack>
      </Stack>
      <StageJobsPanel stageId={stage.id} events={events} />
    </Paper>
  );
}

export function EpisodeDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const ep = useQuery({ queryKey: qk.episode(id!), queryFn: () => episodesApi.get(id!).then(r=>r.data) });
  const hist = useQuery({ queryKey: qk.history(id), queryFn: () => pipelineApi.history(id).then(r=>r.data) });
  const act = useMutation({
    mutationFn: ({stageId, action}:{stageId:string;action:string}): Promise<unknown> =>
      action==="enqueue" ? pipelineApi.enqueue(stageId)
      : action==="start" ? pipelineApi.runStub(stageId)
      : pipelineApi.action(stageId, action),
    onSuccess: () => { qc.invalidateQueries({queryKey:qk.episode(id!)}); qc.invalidateQueries({queryKey:qk.history(id)}); qc.invalidateQueries({queryKey:["episodes"]}); qc.invalidateQueries({queryKey:["stage-jobs"]}); }
  });
  if (ep.isLoading) return <LoadingState/>;
  if (ep.error || !ep.data) return <ErrorState message={(ep.error as any)?.message||"No encontrado"}/>;
  const stages = ep.data.stages || [];
  const done = stages.filter((s: PipelineStage)=>s.status==="COMPLETED").length;
  const pct = stages.length ? Math.round(done/stages.length*100) : 0;
  return <>
    <PageHeader title={ep.data.title} />
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 8 }}>
        <Paper sx={{p:2, mb:2}}><Stack direction="row" spacing={2} alignItems="center"><Typography variant="subtitle1">Estado episodio:</Typography><StatusChip status={ep.data.status}/><Box sx={{flex:1}}><LinearProgress variant="determinate" value={pct}/></Box><Typography variant="body2">{pct}%</Typography></Stack></Paper>
        <Stack spacing={1}>{stages.map((s: PipelineStage) => <StageRow key={s.id} stage={s} events={hist.data || []} onAction={(stageId,action)=>act.mutate({stageId,action})}/>)}</Stack>
        {act.error && <Box sx={{mt:1}}><ErrorState message={(act.error as any).message}/></Box>}
        <AssetsPanel episodeId={id!} stages={stages} />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <Paper sx={{p:2}}><Typography variant="h6" gutterBottom>Historial</Typography><Divider sx={{mb:1}}/>
          <Stack spacing={1}>{(hist.data||[]).map((h: any) => <Box key={h.id}><Typography variant="body2">{h.message}</Typography><Typography variant="caption" color="text.secondary">{new Date(h.createdAt).toLocaleString()}</Typography></Box>)}
          {!(hist.data||[]).length && <Typography color="text.secondary">Sin eventos.</Typography>}</Stack>
        </Paper>
      </Grid>
    </Grid>
  </>;
}
