FROM node:18-slim AS deps                                                                                                                                                                
WORKDIR /app                                                                                                                                                                             
COPY package*.json ./                                                                                                                                                                    
RUN npm install                                                                                                                                                      
                    
FROM node:18-slim AS runtime                                                                                                                                                             
WORKDIR /app                                           
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src                                                                                                                                                                           
COPY package.json ./

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# No HEALTHCHECK. The ALB health check is what we lean on. ECS doesn't
# even read this directive for Fargate tasks the way our task def is
# configured, so adding it would be theater.

CMD ["node", "src/index.js"]
