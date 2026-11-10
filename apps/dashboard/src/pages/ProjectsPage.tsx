import { useQuery } from "@tanstack/react-query";
import { Button, Paper, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { projectsApi } from "../api/resources";
import { qk } from "../api/queryKeys";
import { LoadingState, ErrorState, EmptyState } from "../components/States";

export function ProjectsPage() {
  const q = useQuery({ queryKey: qk.projects, queryFn: () => projectsApi.list().then(r=>r.data) });
  if (q.isLoading) return <LoadingState/>;
  if (q.error) return <ErrorState message={(q.error as any).message} onRetry={()=>q.refetch()}/>;
  return <>
    <PageHeader title="Proyectos" action={<Button component={Link} to="/projects/new" variant="contained">Nuevo proyecto</Button>} />
    {!q.data?.length ? <EmptyState title="No hay proyectos" action={<Button component={Link} to="/projects/new" variant="contained">Crear proyecto</Button>}/> :
    <Paper><Table><TableHead><TableRow><TableCell>Nombre</TableCell><TableCell>Plataforma</TableCell><TableCell>Actualizado</TableCell><TableCell></TableCell></TableRow></TableHead>
      <TableBody>{q.data.map(p => <TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell>{p.platform}</TableCell><TableCell>{new Date(p.updatedAt).toLocaleString()}</TableCell>
      <TableCell><Button component={Link} to={`/projects/${p.id}/edit`} size="small">Editar</Button><Button component={Link} to={`/episodes?projectId=${p.id}`} size="small">Episodios</Button></TableCell></TableRow>)}</TableBody></Table></Paper>}
  </>;
}
