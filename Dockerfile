# 1) Start from Debian 12
FROM debian:12

# 2) Avoid interactive prompts during package install
ENV DEBIAN_FRONTEND=noninteractive

# 3) Update and install system deps (customize as needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    npm \
    && rm -rf /var/lib/apt/lists/*

# 4) Create a working directory inside the image
WORKDIR /app/IMSE-MS2

# 5) Copy only package files first (better layer caching)
COPY IMSE-MS2/package*.json ./

# 6) Install dependencies
RUN npm install

# 7) Now copy the rest of the app
COPY IMSE-MS2/. .

# 8) Expose ports
EXPOSE 3000
EXPOSE 8080

# 9) Default command
CMD ["npm", "start"]
