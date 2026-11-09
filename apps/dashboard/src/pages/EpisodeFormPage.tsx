import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Paper, Stack, TextField, Button, MenuItem } from "@mui/material";
import { PageHeader } from "../components/PageHeader";
import { episodesApi, projectsApi } from "../api/resources";
import { qk } from "../api/queryKeys";
import { LoadingState, ErrorState } from "../components/States";

export function EpisodeFormPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const isEdit = Boolean(id);
  const projects = useQuery({ queryKey: qk.projects, queryFn: () => projectsApi.list().then(r=>r.data) });
  const q = useQuery({ queryKey: qk.episode(id||"_"), queryFn: () => episodesApi.get(id!).then(r=>r.data), enabled: isEdit });
  const [form, setForm] = useState({ projectId: sp.get("projectId")||"", title: "", synopsis: "" });
  useEffect(()=>{ if(q.data) setForm({ projectId:q.data.projectId, title:q.data.title, synopsis:q.data.synopsis }); },[q.data]);
  const m = useMutation({
    mutationFn: (body: any) => isEdit ? episodesApi.update(id!, { title: body.title, synopsis: body.synopsis }) : episodesApi.create(body),
    onSuccess: (r:any) => { qc.invalidateQueries({queryKey:["episodes"]}); nav(`/episodes/${r.data.id}`); }
  });
  if ((isEdit && q.isLoading) || projects.isLoading) return <LoadingState/>;
  return <>
    <PageHeader title={isEdit ? "Editar episodio" : "Nuevo episodio"} />
    <Paper sx={{p:2, maxWidth:720}}>
      <Stack spacing={2} component="form" onSubmit={(e)=>{e.preventDefault(); m.mutate(form);}}>
        {!isEdit && <TextField select label="Proyecto" value={form.projectId} onChange={e=>setForm({...form,projectId:e.target.value})} required>
          {(projects.data||[]).map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
        </TextField>}
        <TextField label="Título" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required inputProps={{maxLength:160}}/>
        <TextField label="Sinopsis" value={form.synopsis} onChange={e=>setForm({...form,synopsis:e.target.value})} multiline minRows={3} inputProps={{maxLength:5000}}/>
        {m.error && <ErrorState message={(m.error as any).message}/>}
        <Stack direction="row" spacing={1}><Button type="submit" variant="contained" disabled={m.isPending || (!isEdit && !form.projectId)}>Guardar</Button><Button onClick={()=>nav(-1)}>Cancelar</Button></Stack>
      </Stack>
    </Paper>
  </>;
}
