import React, { useContext } from "react";
import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, AppBar, Typography, IconButton, Divider } from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import FolderIcon from "@mui/icons-material/Folder";
import MovieIcon from "@mui/icons-material/Movie";
import Brightness6Icon from "@mui/icons-material/Brightness6";
import { Link, useLocation } from "react-router-dom";
import { ColorModeContext } from "../theme";

const W = 240;
const items = [
  { to: "/", label: "Inicio", icon: <DashboardIcon /> },
  { to: "/projects", label: "Proyectos", icon: <FolderIcon /> },
  { to: "/episodes", label: "Episodios", icon: <MovieIcon /> },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const cm = useContext(ColorModeContext);
  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Reel Engine</Typography>
          <IconButton color="inherit" onClick={cm.toggle} aria-label="toggle theme"><Brightness6Icon /></IconButton>
        </Toolbar>
      </AppBar>
      <Drawer variant="permanent" sx={{ width: W, [`& .MuiDrawer-paper`]: { width: W, boxSizing: "border-box" } }}>
        <Toolbar />
        <Divider />
        <List>
          {items.map((it) => (
            <ListItemButton key={it.to} component={Link} to={it.to} selected={loc.pathname === it.to || (it.to !== "/" && loc.pathname.startsWith(it.to))}>
              <ListItemIcon>{it.icon}</ListItemIcon>
              <ListItemText primary={it.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 } }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
