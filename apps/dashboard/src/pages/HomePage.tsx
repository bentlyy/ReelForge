import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, Grid, Typography, Stack } from "@mui/material";
import { PageHeader } from "../components/PageHeader";
import { projectsApi, episodesApi, pipelineApi } from "../api/resources";
import { qk } from "../api/queryKeys";
import { LoadingState, ErrorState } from "../components/States";
import { StatusChip } from "../components/StatusChip";
import type { Episode, ActivityEvent } from "@reel-engine/shared";

export function HomePage() {
  const projects = useQuery({ queryKey: qk.projects, queryFn: () => projectsApi.list().then(r=>r.data) });
  const episodes = useQuery({ queryKey: qk.episodes(), queryFn: () => episodesApi.list().then(r=>r.data) });
  const history = useQuery({ queryKey: qk.history(), queryFn: () => pipelineApi.history().then(r=>r.data) });
  if (projects.isLoading || episodes.isLoading) return <LoadingState/>;
  if (projects.error || episodes.error) return <ErrorState message={(projects.error||episodes.error as any)?.message||"Error"} onRetry={()=>{projects.refetch();episodes.refetch();}}/>;
  const eps: Episode[] = episodes.data || [];
  const progress = eps.length ? Math.round((eps.filter((e: Episode)=>e.status==="COMPLETED").length/eps.length)*100) : 0;
  return <>
    <PageHeader title="Inicio" />
    <Grid container spacing={2}>
      <Grid size={{xs:12, md:4}}><Card><CardContent><Typography color="text.secondary">Proyectos</Typography><Typography variant="h4">{projects.data?.length ?? 0}</Typography></CardContent></Card></Grid>
      <Grid size={{xs:12, md:4}}><Card><CardContent><Typography color="text.secondary">Episodios</Typography><Typography variant="h4">{eps.length}</Typography></CardContent></Card></Grid>
      <Grid size={{xs:12, md:4}}><Card><CardContent><Typography color="text.secondary">Progreso global</Typography><Typography variant="h4">{progress}%</Typography></CardContent></Card></Grid>
      <Grid size={{xs:12}}><Card><CardContent><Typography variant="h6" gutterBottom>Actividad reciente</Typography>
        <Stack spacing={1}>{((history.data||[]) as ActivityEvent[]).slice(0,8).map((h: ActivityEvent) => <Stack key={h.id} direction="row" spacing={1} alignItems="center"><Typography variant="body2" sx={{flex:1}}>{h.message}</Typography><Typography variant="caption" color="text.secondary">{new Date(h.createdAt).toLocaleString()}</Typography></Stack>)}
        {!(history.data||[]).length && <Typography color="text.secondary">Sin actividad aún.</Typography>}
        </Stack>
      </CardContent></Card></Grid>
      <Grid size={{xs:12}}><Card><CardContent><Typography variant="h6" gutterBottom>Estado episodios</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">{eps.slice(0,12).map((e: Episode) => <Stack key={e.id} direction="row" spacing={1} alignItems="center" sx={{mr:2,mb:1}}><Typography variant="body2">{e.title}</Typography><StatusChip status={e.status}/></Stack>)}
        {!eps.length && <Typography color="text.secondary">Crea un proyecto y episodio para comenzar.</Typography>}</Stack>
      </CardContent></Card></Grid>
    </Grid>
  </>;
}
