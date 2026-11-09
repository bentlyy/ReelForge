import { Alert, Box, Button, CircularProgress, Typography } from "@mui/material";
export function LoadingState({ label="Cargando..." }: { label?: string }) {
  return <Box sx={{ display:"flex", gap:2, alignItems:"center", p:2 }}><CircularProgress size={22}/><Typography>{label}</Typography></Box>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <Alert severity="error" action={onRetry ? <Button color="inherit" onClick={onRetry}>Reintentar</Button> : null}>{message}</Alert>;
}
export function EmptyState({ title, action }: { title: string; action?: React.ReactNode }) {
  return <Box sx={{ p:4, textAlign:"center", opacity:0.85 }}><Typography variant="h6" gutterBottom>{title}</Typography>{action}</Box>;
}
