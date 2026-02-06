FROM node:18-alpine
# Copy entire repository so local file: dependencies resolve correctly
COPY . /app
WORKDIR /app/services/backend-business
# Install only production dependencies for the service
RUN npm install --production
# Ensure code is present (already copied) and expose port
EXPOSE 3002
CMD ["npm", "start"]
