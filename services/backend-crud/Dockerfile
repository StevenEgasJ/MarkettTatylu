FROM node:18-alpine
WORKDIR /app
# Copy package files from service directory to ensure correct package.json is used
COPY package*.json ./
RUN npm install --production
# Copy the service source (use the build context root for this service)
COPY . ./
EXPOSE 3001
CMD ["npm", "start"]
