# Use a lightweight Node.js base image
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of your application code
COPY . .

# Hugging Face Spaces expects the app to listen on port 7860.
# We also set NODE_ENV to production.
ENV NODE_ENV=production
ENV PORT=7860

# Expose the port (documentation purposes, the actual port is set by the platform)
EXPOSE 7860

# Start the application
CMD ["node", "src/server.js"]