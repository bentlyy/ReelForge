import { useQuery } from "@tanstack/react-query";
import { Button, Paper, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { episodesApi } from "../api/resources";
import { qk } from "../api/queryKeys";
import { LoadingState, ErrorState, EmptyState } from "../components/States";
import { StatusChip } from "../components/StatusChip";

export function EpisodesPage() {
  const [sp] = useSearchParams();
  const projectId = sp.get("projectId") || undefined;
  const q = useQuery({ queryKey: qk.episodes(projectId), queryFn: () => episodesApi.list(projectId).then(r=>r.data) });
  if (q.isLoading) return <LoadingState/>;
  if (q.error) return <ErrorState message={(q.error as any).message} onRetry={()=>q.refetch()}/>;
  return <>
    <PageHeader title="Episodios" action={<Button component={Link} to={`/episodes/new${projectId?`?projectId=${projectId}`:""}`} variant="contained">Nuevo episodio</Button>} />
    {!q.data?.length ? <EmptyState title="No hay episodios" action={<Button component={Link} to="/episodes/new" variant="contained">Crear episodio</Button>}/> :
    <Paper><Table><TableHead><TableRow><TableCell>Título</TableCell><TableCell>Estado</TableCell><TableCell>Actualizado</TableCell><TableCell></TableCell></TableRow></TableHead>
      <TableBody>{q.data.map(e => <TableRow key={e.id}><TableCell>{e.title}</TableCell><TableCell><StatusChip status={e.status}/></TableCell><TableCell>{new Date(e.updatedAt).toLocaleString()}</TableCell>
      <TableCell><Button component={Link} to={`/episodes/${e.id}`} size="small">Ver</Button><Button component={Link} to={`/episodes/${e.id}/edit`} size="small">Editar</Button></TableCell></TableRow>)}</TableBody></Table></Paper>}
  </>;
}
