FROM node:24-slim
WORKDIR /app

# Set up locales
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV NODE_ENV=production
ENV PORT=3000

RUN log() { echo "[$(date +"%Y-%m-%d %H:%M:%S")] $1"; };

# add-apt-repository ppa:savoury1/ffmpeg7 && \


# Install the application dependencies
RUN \
  touch .env && \
  apt update && \
  apt install -y --no-install-recommends build-essential ca-certificates chromium ffmpeg git locales mediainfo pipx python3 wget && \
  \
  sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen && \
  \
  update-ca-certificates && \
  \
  wget -O /etc/apt/keyrings/gpg-pub-moritzbunkus.gpg https://mkvtoolnix.download/gpg-pub-moritzbunkus.gpg && \
  echo "deb [signed-by=/etc/apt/keyrings/gpg-pub-moritzbunkus.gpg] https://mkvtoolnix.download/debian/ bookworm main" > /etc/apt/sources.list.d/mkvtoolnix.download.list && \
  \
  apt update && \
  apt install -y --no-install-recommends mkvtoolnix

# Add Python dependencies
COPY requirements.txt ./

# Install audio-offset-finder
RUN \
  pipx install audio-offset-finder && \
  pipx ensurepath

# Install Node.js dependencies
COPY .yarn/patches .yarn/patches
COPY . .

RUN \
  npm install -g -y corepack@latest && \
  corepack enable yarn && \
  yarn install && \
  yarn add @lydell/node-pty@npm:node-pty@1.0.0

EXPOSE $PORT

CMD ["yarn", "tsx", "src/server.ts"]
