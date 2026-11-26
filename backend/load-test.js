import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 50,
  duration: '10s',
};

export default function () {
  const randomTxnId = `txn_load_${Math.random().toString(36).substring(7)}`;
  
  const url = 'http://localhost:5000/api/pay';
  const payload = JSON.stringify({
    tenantId: "load_test_company",
    amount: 100,
    transactionId: randomTxnId,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  let res = http.post(url, payload, params);

  check(res, {
    'is status 200': (r) => r.status === 200,
  });

  sleep(0.1);
}