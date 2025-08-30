import { defineEventHandler } from 'h3';

export default defineEventHandler(() => {
  return {
    status: 'success',
    message: 'Test endpoint is working!',
    timestamp: new Date().toISOString()
  };
});
