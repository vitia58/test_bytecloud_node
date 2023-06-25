FROM node:16.15.0

WORKDIR /testbytecloud

COPY "package.json" . 

RUN npm i 

COPY . . 

RUN npm run build

CMD ["npm", "run", "start:prod"]