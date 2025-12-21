import fs from "fs-extra";
import path from "path";
import prompts from "prompts";
import yaml from "js-yaml";

interface PackageJson {
  name: string;
  dependencies?: Record<string, string>;
}

interface DockerService {
  name: string;
  needsTunnel?: boolean;
}

export async function dockerize(env: "dev" | "prod" = "prod") {
  const cwd = process.cwd();
  const packageJsonPath = path.join(cwd, "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    throw new Error("package.json not found. Are you in a Pod project?");
  }

  const packageJson: PackageJson = await fs.readJSON(packageJsonPath);
  const projectName = packageJson.name;

  const detectedServices = detectServices(packageJson);
  const selectedServices = await selectServices(detectedServices);

  await restructureProject(cwd, projectName);
  await createDockerfile(cwd, projectName);

  if (env === "prod") {
    await setupProduction(cwd, projectName, selectedServices);
  } else {
    await setupDevelopment(cwd, projectName, selectedServices);
  }

  printNextSteps(projectName, env, selectedServices);
}

function detectServices(packageJson: PackageJson): DockerService[] {
  const deps = packageJson.dependencies || {};
  const services: DockerService[] = [];

  if (deps.pg || deps.postgres) services.push({ name: "postgres" });
  if (deps.mysql || deps.mysql2) services.push({ name: "mysql" });
  if (deps.redis || deps.ioredis) services.push({ name: "redis" });
  if (deps.mongodb || deps.mongoose) services.push({ name: "mongodb" });

  return services;
}

async function selectServices(
  detected: DockerService[]
): Promise<DockerService[]> {
  if (detected.length === 0) return [];

  const response = await prompts({
    type: "multiselect",
    name: "services",
    message: "Select services to include:",
    choices: detected.map((s) => ({
      title: s.name,
      value: s.name,
      selected: true,
    })),
  });

  if (!response.services) return [];
  return detected.filter((s) => response.services.includes(s.name));
}

async function restructureProject(cwd: string, projectName: string) {
  const nestedDir = path.join(cwd, projectName);

  if (fs.existsSync(nestedDir)) {
    console.log("⚠️  Project already restructured, skipping...");
    return;
  }

  await fs.ensureDir(nestedDir);

  const items = await fs.readdir(cwd);
  const toMove = items.filter((item) => item !== projectName);

  for (const item of toMove) {
    const src = path.join(cwd, item);
    const dest = path.join(nestedDir, item);
    await fs.move(src, dest, { overwrite: true });
  }

  const envSrc = path.join(nestedDir, ".env");
  const envDest = path.join(cwd, ".env");

  if (fs.existsSync(envSrc)) {
    await fs.move(envSrc, envDest, { overwrite: true });
  }
}

async function createDockerfile(cwd: string, projectName: string) {
  const dockerfilePath = path.join(cwd, projectName, "Dockerfile");

  const dockerfile = `FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN if [ -f "tsconfig.json" ]; then npm run build || true; fi

EXPOSE 3000
CMD ["npm", "start"]
`;

  await fs.writeFile(dockerfilePath, dockerfile);
}

async function setupProduction(
  cwd: string,
  projectName: string,
  services: DockerService[]
) {
  const compose: any = {
    services: {
      traefik: {
        image: "traefik:v2.10",
        command: [
          "--api.insecure=true",
          "--providers.docker=true",
          "--providers.docker.exposedbydefault=false",
          "--entrypoints.web.address=:80",
          "--entrypoints.websecure.address=:443",
          "--certificatesresolvers.myresolver.acme.tlschallenge=true",
          "--certificatesresolvers.myresolver.acme.email=admin@example.com",
          "--certificatesresolvers.myresolver.acme.storage=/letsencrypt/acme.json",
        ],
        ports: ["80:80", "443:443", "8080:8080"],
        volumes: [
          "/var/run/docker.sock:/var/run/docker.sock:ro",
          "./letsencrypt:/letsencrypt",
        ],
        networks: ["web"],
      },
      [projectName]: {
        build: ".",
        labels: [
          "traefik.enable=true",
          "traefik.http.routers.app.rule=Host(`localhost`)",
          "traefik.http.routers.app.entrypoints=websecure",
          "traefik.http.routers.app.tls.certresolver=myresolver",
          "traefik.http.services.app.loadbalancer.server.port=3000",
        ],
        env_file: [".env"],
        depends_on: [],
        networks: ["web"],
      },
    },
    networks: {
      web: {
        driver: "bridge",
      },
    },
    volumes: {},
  };

  for (const service of services) {
    const config = getServiceConfig(service.name);
    compose.services[service.name] = config.service;
    if (config.volume) {
      compose.volumes[config.volume.name] = {};
    }
    compose.services[projectName].depends_on.push(service.name);
  }

  const composePath = path.join(cwd, "docker-compose.yml");
  await fs.writeFile(
    composePath,
    yaml.dump(compose, { indent: 2, lineWidth: -1 })
  );
  await createEnvTemplate(cwd, services, "prod");
}

async function setupDevelopment(
  cwd: string,
  projectName: string,
  services: DockerService[]
) {
  const existingCompose = path.join(cwd, "docker-compose.yml");

  let existingServices: DockerService[] = [];

  if (fs.existsSync(existingCompose)) {
    const content = await fs.readFile(existingCompose, "utf8");
    const existing: any = yaml.load(content);
    if (existing.services) {
      existingServices = Object.keys(existing.services)
        .filter((s) => ["postgres", "mysql", "redis", "mongodb"].includes(s))
        .map((name) => ({ name }));
    }
  }

  const servicesToTunnel: DockerService[] = [];

  if (existingServices.length > 0) {
    const { tunnel } = await prompts({
      type: "confirm",
      name: "tunnel",
      message: "Tunnel to remote database services?",
      initial: false,
    });

    if (tunnel) {
      const { selected } = await prompts({
        type: "multiselect",
        name: "selected",
        message: "Select services to tunnel:",
        choices: existingServices.map((s) => ({
          title: s.name,
          value: s.name,
        })),
      });

      if (selected) {
        servicesToTunnel.push(
          ...existingServices
            .filter((s) => selected.includes(s.name))
            .map((s) => ({ ...s, needsTunnel: true }))
        );
      }
    }
  }

  for (const service of servicesToTunnel) {
    await createTunnelService(cwd, service.name);
  }

  const compose: any = {
    services: {
      [projectName]: {
        build: ".",
        ports: ["3000:3000"],
        env_file: [".env"],
        volumes: [".:/app", "/app/node_modules"],
        command: "npm run dev",
        depends_on: [],
      },
    },
    networks: {
      default: {
        driver: "bridge",
      },
    },
  };

  for (const service of servicesToTunnel) {
    const tunnelName = `${service.name}-tunnel`;
    compose.services[tunnelName] = {
      build: `./${tunnelName}`,
      environment: [
        `REMOTE_HOST=\${${service.name.toUpperCase()}_REMOTE_HOST}`,
        `REMOTE_PORT=\${${service.name.toUpperCase()}_REMOTE_PORT:-${getDefaultPort(
          service.name
        )}}`,
        `LOCAL_PORT=${getDefaultPort(service.name)}`,
      ],
      volumes: [`./${service.name}.pem:/ssh/${service.name}.pem:ro`],
    };
    compose.services[projectName].depends_on.push(tunnelName);
  }

  const devComposePath = path.join(cwd, "docker-compose.dev.yml");
  await fs.writeFile(
    devComposePath,
    yaml.dump(compose, { indent: 2, lineWidth: -1 })
  );
  await createEnvTemplate(cwd, services, "dev");
}

async function createTunnelService(projectDir: string, serviceName: string) {
  const tunnelDir = path.join(projectDir, `${serviceName}-tunnel`);
  await fs.ensureDir(tunnelDir);

  const dockerfile = `FROM alpine:latest

RUN apk add --no-cache openssh-client

COPY tunnel.sh /tunnel.sh
RUN chmod +x /tunnel.sh

CMD ["/tunnel.sh"]
`;

  const tunnelScript = `#!/bin/sh

SSH_KEY="/ssh/${serviceName}.pem"
REMOTE_HOST=\${REMOTE_HOST}
REMOTE_PORT=\${REMOTE_PORT:-${getDefaultPort(serviceName)}}
LOCAL_PORT=\${LOCAL_PORT:-${getDefaultPort(serviceName)}}

chmod 600 $SSH_KEY

echo "Starting SSH tunnel for ${serviceName}..."
echo "Remote: $REMOTE_HOST:$REMOTE_PORT -> Local: $LOCAL_PORT"

ssh -i $SSH_KEY \\
    -N -L 0.0.0.0:$LOCAL_PORT:localhost:$REMOTE_PORT \\
    -o StrictHostKeyChecking=no \\
    -o ServerAliveInterval=60 \\
    $REMOTE_HOST
`;

  await fs.writeFile(path.join(tunnelDir, "Dockerfile"), dockerfile);
  await fs.writeFile(path.join(tunnelDir, "tunnel.sh"), tunnelScript);
}

async function createEnvTemplate(
  projectDir: string,
  services: DockerService[],
  env: "dev" | "prod"
) {
  const envPath = path.join(projectDir, ".env.example");

  let content = `NODE_ENV=${
    env === "prod" ? "production" : "development"
  }\nPORT=3000\n`;

  if (services.length > 0) {
    content += `\n`;
    for (const service of services) {
      const vars = getEnvVars(service.name);
      content += vars.join("\n") + "\n\n";
    }
  }

  await fs.writeFile(envPath, content);
}

function getServiceConfig(serviceName: string) {
  const configs: Record<string, any> = {
    postgres: {
      service: {
        image: "postgres:15-alpine",
        environment: [
          "POSTGRES_USER=${DB_USER}",
          "POSTGRES_PASSWORD=${DB_PASSWORD}",
          "POSTGRES_DB=${DB_NAME}",
        ],
        volumes: ["postgres_data:/var/lib/postgresql/data"],
        networks: ["web"],
      },
      volume: { name: "postgres_data" },
    },
    mysql: {
      service: {
        image: "mysql:8",
        environment: [
          "MYSQL_ROOT_PASSWORD=${DB_ROOT_PASSWORD}",
          "MYSQL_DATABASE=${DB_NAME}",
          "MYSQL_USER=${DB_USER}",
          "MYSQL_PASSWORD=${DB_PASSWORD}",
        ],
        volumes: ["mysql_data:/var/lib/mysql"],
        networks: ["web"],
      },
      volume: { name: "mysql_data" },
    },
    redis: {
      service: {
        image: "redis:7-alpine",
        volumes: ["redis_data:/data"],
        networks: ["web"],
      },
      volume: { name: "redis_data" },
    },
    mongodb: {
      service: {
        image: "mongo:6",
        environment: [
          "MONGO_INITDB_ROOT_USERNAME=${DB_USER}",
          "MONGO_INITDB_ROOT_PASSWORD=${DB_PASSWORD}",
        ],
        volumes: ["mongo_data:/data/db"],
        networks: ["web"],
      },
      volume: { name: "mongo_data" },
    },
  };

  return configs[serviceName];
}

function getEnvVars(serviceName: string): string[] {
  const vars: Record<string, string[]> = {
    postgres: [
      "DB_HOST=postgres",
      "DB_PORT=5432",
      "DB_USER=myuser",
      "DB_PASSWORD=mypassword",
      "DB_NAME=mydb",
    ],
    mysql: [
      "DB_HOST=mysql",
      "DB_PORT=3306",
      "DB_USER=myuser",
      "DB_PASSWORD=mypassword",
      "DB_NAME=mydb",
      "DB_ROOT_PASSWORD=rootpassword",
    ],
    redis: ["REDIS_HOST=redis", "REDIS_PORT=6379"],
    mongodb: [
      "MONGO_HOST=mongodb",
      "MONGO_PORT=27017",
      "MONGO_USER=myuser",
      "MONGO_PASSWORD=mypassword",
    ],
  };

  return vars[serviceName] || [];
}

function getDefaultPort(service: string): number {
  const ports: Record<string, number> = {
    postgres: 5432,
    mysql: 3306,
    redis: 6379,
    mongodb: 27017,
  };
  return ports[service] || 3000;
}

function printNextSteps(
  projectName: string,
  env: string,
  services: DockerService[]
) {
  console.log(`\n✅ Done! Next steps:\n`);

  if (env === "prod") {
    console.log(`  # Edit .env with your settings`);
    console.log(`  docker-compose up -d`);
    console.log(`  # Access at https://localhost\n`);
  } else {
    console.log(`  # Edit .env with your settings`);
    if (services.some((s) => s.needsTunnel)) {
      console.log(`  # Add SSH keys: {service}.pem`);
    }
    console.log(`  docker-compose -f docker-compose.dev.yml up -d\n`);
  }
}
