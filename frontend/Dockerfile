FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

# Setting the environment variable to ensure it runs correctly with React Router if needed, and to avoid issues with some webpack configs
ENV CI=true

CMD ["npm", "start"]
