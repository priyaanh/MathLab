# The MathLab sync server as a container, for any host that runs Docker
# (Fly.io, Railway, a VPS, …). It has no dependencies, so this is tiny.
#
# Build:  docker build -t mathlab-sync ./server
# Run:    docker run -p 8787:8787 -v mathlab-data:/app/data mathlab-sync
#
# The volume at /app/data is where profiles.json lives (DATA_FILE defaults to
# <cwd>/data/profiles.json). Mount a real volume there so data survives restarts.
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY sync-server.mjs ./
# ALLOW_ORIGIN "*" is safe (the server only holds ciphertext); tighten if you like.
ENV PORT=8787 ALLOW_ORIGIN=*
EXPOSE 8787
CMD ["node", "sync-server.mjs"]
