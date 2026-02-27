# ---- 第 1 阶段：安装依赖 ----
FROM node:20-alpine AS deps

# 添加编译工具链，针对 SQLite
RUN apk add --no-cache python3 make g++ openssl

# 启用 corepack 并激活 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 仅复制依赖清单，提高构建缓存利用率
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma

# 安装所有依赖（含 devDependencies）
RUN pnpm install --frozen-lockfile

# ---- 第 2 阶段：构建项目 ----
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++ openssl
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
# 复制全部源代码
COPY . .

# 确保生成 prisma client
RUN npx prisma generate

ENV DOCKER_ENV=true

# 生成生产构建
RUN pnpm run build

# ---- 第 3 阶段：生成运行时镜像 ----
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DOCKER_ENV=true

# --- 数据库持久化配置 ---
ENV DATABASE_URL="file:/app/data/lunatv.db"
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data
VOLUME ["/app/data"]

# 从构建器中复制 standalone 输出
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# 从构建器中复制 public 和 static 目录
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# 从构建器中复制 scripts 和启动配置
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/start.js ./start.js
# 从构建器复制 prisma 架构与引擎
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# 切换到非特权用户
USER nextjs

EXPOSE 3000

# 启动时执行 prisma 数据库迁移，随后启动应用
CMD ["sh", "-c", "npx prisma db push && node start.js"]