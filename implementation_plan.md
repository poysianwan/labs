# System Boot & Initialization Plan

Now that the file hierarchy is completely restored, I will get the actual application running. This is a multi-service application (Postgres DB, Node.js Backend API, NodeJS Printer Bridge, and React Frontend), so we will orchestrate it elegantly using Docker Compose and standard Node commands.

## User Review Required

> [!IMPORTANT]  
> Are you running the frontend on this very machine, and do you want me to automatically spin it up in the background? The backend and database will run persistently in Docker, but the frontend development server will run locally.

## Proposed Changes

### Docker Configuration
- **Printer Bridge**: I will create the missing `Dockerfile` for `printer-bridge` so that Docker Compose can build it.
- **Docker Compose Tweaks**: I will slightly modify `docker-compose.yml` to remove `network_mode: host` on the print bridge. In Docker Desktop for Windows, host networking doesn't work correctly and can cause port mapping conflicts. Standard NAT networking allows outbound LAN traffic to local WiFi printers just fine anyway.

#### [NEW] printer-bridge/Dockerfile
A simple Node.js 20 alpine Dockerfile to install dependencies and run `npm start` for the thermal print bridge.

#### [MODIFY] docker-compose.yml
Remove `network_mode: host` to guarantee stable local port bindings on Windows.

### System Boot Steps
1. Re-run `npm install:all` to ensure the local `node_modules` caches are correctly populated for any local commands.
2. Spin up `docker-compose up -d --build` to automatically launch PostgreSQL, run the Database schema migrations, and host the APIs (Ports 3001 and 3002).
3. Start the `frontend` Vite server via background command on port `5173`.

## Open Questions

- We do not currently have a physical receipt printer configured. The system will fall back to a standard browser print if it cant find a thermal printer, which is normal for testing. Is this acceptable?
- Do you want me to also build the frontend for production, or just serve it in development mode?

## Verification Plan

### Automated Tests
- I will run `curl http://localhost:3001/health` or ping the backend to verify the database migrations executed correctly inside the Docker container.
- I will check the background status of the frontend Vue/Vite server.

### Manual Verification
- You will be asked to open your browser to `http://localhost:5173` and log into the POS system using the default PIN (`0000`).
