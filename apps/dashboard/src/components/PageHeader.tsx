import { Stack, Typography, Button } from "@mui/material";
export function PageHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return <Stack direction={{xs:"column",sm:"row"}} justifyContent="space-between" alignItems={{sm:"center"}} spacing={2} sx={{ mb: 2 }}>
    <Typography variant="h4">{title}</Typography>{action}
  </Stack>;
}
