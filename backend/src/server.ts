import app from './app';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`[LedgerGuard] API Gateway server listening on port ${PORT}`);
  console.log(`[LedgerGuard] Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default server;
