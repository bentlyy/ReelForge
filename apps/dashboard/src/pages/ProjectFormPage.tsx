import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Paper, Stack, TextField, Button, MenuItem } from "@mui/material";
import { PageHeader } from "../components/PageHeader";
import { projectsApi } from "../api/resources";
import { qk } from "../api/queryKeys";
import { LoadingState, ErrorState } from "../components/States";

export function ProjectFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const isEdit = Boolean(id);
  const q = useQuery({ queryKey: qk.project(id||"_"), queryFn: () => projectsApi.get(id!).then(r=>r.data), enabled: isEdit });
  const [form, setForm] = useState({ name: "", description: "", platform: "youtube_shorts" });
  useEffect(()=>{ if(q.data) setForm({ name:q.data.name, description:q.data.description, platform:q.data.platform }); },[q.data]);
  const m = useMutation({
    mutationFn: (body: any) => isEdit ? projectsApi.update(id!, body) : projectsApi.create(body),
    onSuccess: () => { qc.invalidateQueries({queryKey:qk.projects}); nav("/projects"); }
  });
  if (isEdit && q.isLoading) return <LoadingState/>;
  if (isEdit && q.error) return <ErrorState message={(q.error as any).message}/>;
  return <>
    <PageHeader title={isEdit ? "Editar proyecto" : "Nuevo proyecto"} />
    <Paper sx={{p:2, maxWidth:720}}>
      <Stack spacing={2} component="form" onSubmit={(e)=>{e.preventDefault(); m.mutate(form);}}>
        <TextField label="Nombre" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required inputProps={{maxLength:120}}/>
        <TextField label="Descripción" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} multiline minRows={2} inputProps={{maxLength:2000}}/>
        <TextField select label="Plataforma" value={form.platform} onChange={e=>setForm({...form,platform:e.target.value})}>
          <MenuItem value="youtube_shorts">YouTube Shorts</MenuItem>
          <MenuItem value="instagram_reels">Instagram Reels</MenuItem>
          <MenuItem value="generic_vertical">Video vertical genérico</MenuItem>
        </TextField>
        {m.error && <ErrorState message={(m.error as any).message}/>}
        <Stack direction="row" spacing={1}><Button type="submit" variant="contained" disabled={m.isPending}>Guardar</Button><Button onClick={()=>nav(-1)}>Cancelar</Button></Stack>
      </Stack>
    </Paper>
  </>;
}
