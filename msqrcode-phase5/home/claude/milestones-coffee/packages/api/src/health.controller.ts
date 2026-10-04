import { Controller, Get } from "@nestjs/common";
import { PrismaClient } from "@milestones/database";
import * as redis from "redis";

interface HealthCheckResponse {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: "healthy" | "unhealthy";
    redis: "healthy" | "unhealthy";
    api: "healthy" | "unhealthy";
  };
  metrics?: {
    memoryUsage: number;
    cpuUsage: number;
  };
}

@Controller("health")
export class HealthController {
  private prisma = new PrismaClient();
  private redisClient: redis.RedisClient | null = null;
  private startTime = Date.now();

  constructor() {
    this.initializeRedisClient();
  }

  private initializeRedisClient() {
    try {
      this.redisClient = redis.createClient({
        url: process.env.REDIS_URL || "redis://localhost:6379",
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) return new Error("Redis reconnection limit");
            return retries * 50;
          },
        },
      });

      this.redisClient.on("error", (err) => {
        console.error("Redis connection error:", err);
      });

      this.redisClient.connect().catch((err) => {
        console.error("Failed to connect to Redis:", err);
      });
    } catch (error) {
      console.error("Error initializing Redis:", error);
    }
  }

  @Get()
  async health(): Promise<HealthCheckResponse> {
    const startCheck = Date.now();
    const checks = {
      database: "unhealthy" as const,
      redis: "unhealthy" as const,
      api: "unhealthy" as const,
    };

    // Database check
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = "healthy";
    } catch (error) {
      console.error("Database health check failed:", error);
    }

    // Redis check
    try {
      if (this.redisClient && this.redisClient.isOpen) {
        await this.redisClient.ping();
        checks.redis = "healthy";
      }
    } catch (error) {
      console.error("Redis health check failed:", error);
    }

    // API check
    checks.api = "healthy"; // If we got here, API is responding

    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const checkDuration = Date.now() - startCheck;

    const isHealthy = checks.database === "healthy" && checks.api === "healthy";
    const isDegraded =
      checks.database === "healthy" ||
      checks.api === "healthy" ||
      checks.redis === "healthy";

    const status = isHealthy ? "ok" : isDegraded ? "degraded" : "error";

    const response: HealthCheckResponse = {
      status,
      timestamp: new Date().toISOString(),
      uptime,
      version: "1.0.0",
      checks,
      metrics: {
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        cpuUsage: Math.round(process.cpuUsage().user / 1000 / 1000),
      },
    };

    console.log(`Health check completed in ${checkDuration}ms:`, response);
    return response;
  }

  @Get("ready")
  async readiness() {
    // Stricter readiness check for Kubernetes
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        ready: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Readiness check failed:", error);
      return {
        ready: false,
        timestamp: new Date().toISOString(),
        error: "Database not available",
      };
    }
  }

  @Get("live")
  async liveness() {
    // Basic liveness check - just verify process is running
    return {
      alive: true,
      timestamp: new Date().toISOString(),
      pid: process.pid,
    };
  }
}
