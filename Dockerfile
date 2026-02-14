# 多阶段构建 - XTMC量化交易系统
FROM node:20-alpine AS build
WORKDIR /app

# 先复制依赖文件，利用Docker缓存
COPY package.json package-lock.json ./
RUN npm ci --no-audit

# 复制源码并构建
COPY . .
RUN npm run build

# 生产镜像 - nginx
FROM nginx:alpine
LABEL maintainer="xtmc13" description="XTMC量化交易系统"

# 复制构建产物和nginx配置
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
