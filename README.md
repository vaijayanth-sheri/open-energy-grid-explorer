# Open Energy Grid Explorer

An interactive, synthetic visualization of a multi-layer urban electrical distribution network, mapped over Munich. 

This project goes beyond a simple map application by simulating a **physically meaningful, hierarchical electrical grid** with High Voltage (HV), Medium Voltage (MV), and Low Voltage (LV) layers. It models dynamic power flows, elastic generation balancing, and real-time state changes such as network switching.

## Features

- **Multi-Layer Architecture:**
  - **High Voltage (HV, 110 kV):** Generation (Solar/Gas), Transmission Lines, and HV/MV Substations.
  - **Medium Voltage (MV, 11 kV):** Distribution Feeders, RMUs (Ring Main Units), and MV/LV Transformers.
  - **Low Voltage (LV, 0.4 kV):** LV Feeders distributing power directly to consumers.
- **Dynamic Load Balancing:** Real-time system equilibrium where gas generation elastically responds to balance out fixed solar output and time-varying consumer demand.
- **Network Switching:** Interactive RMUs that can be toggled open or closed, dynamically affecting downstream power supply and load calculations.
- **Real-World Topology constraints:** Enforces realistic distribution logic (e.g., consumer demand aggregates upstream from LV to MV to HV layers).
- **Time-Series Metrics:** Rolling history buffer for real-time visualization of asset metrics (voltage, current, load, utilization percentage).

## Project Structure

- `/frontend` - The web-based user interface (Vite) displaying the interactive grid overlaid on an OSM (OpenStreetMap) tile layer.
- `/backend` - The FastAPI backend engine responsible for continuous simulation, metric updates, and topological graph calculations.
- Documentation files (PRD, System Architecture, etc.) detailing design constraints and project requirements.

## Getting Started

*(Note: Ensure you have Node.js and Python installed on your system)*

### Backend Setup
1. Navigate to the `backend/` directory.
2. Install the required Python dependencies.
3. Start the FastAPI server (typically runs on `http://localhost:8000`).

### Frontend Setup
1. Navigate to the `frontend/` directory.
2. Run `npm install` to install dependencies.
3. Run `npm run dev` to start the development server (runs on `http://localhost:5173`).

## Design Philosophy

This project strictly avoids using real-world sensitive infrastructure datasets, relying instead on a completely synthetic yet logically accurate mock data set. It is designed to prioritize **structural realism and correct hierarchy** over deep physics simulations.
