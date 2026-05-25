import { Client, Account, Databases } from 'appwrite';

const client = new Client()
  .setEndpoint('https://sgp.cloud.appwrite.io/v1')
  .setProject('6a1416eb001f50cdb902');

export const account = new Account(client);
export const databases = new Databases(client);
export { client };
