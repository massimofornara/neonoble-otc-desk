const API_URL = "https://neonoble-otc-desk.onrender.com";  // ← URL Render live

let quote = {};

async function getQuote() {
  const amount = document.getElementById('amount').value;
  const receiveIn = document.getElementById('receiveIn').value;
  if (!amount || amount < 1) return alert("Inserisci quantità");

  const res = await fetch(`${API_URL}/api/otc/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nenoAmount: Number(amount), receiveIn })
  });
  quote = await res.json();

  document.getElementById('quote').innerHTML = `
    <h3>Ricevi:</h3>
    <p>${receiveIn === 'EUR' ? quote.totalEur.toLocaleString() + ' €' : quote.cryptoAmount + ' ' + receiveIn}</p>
    <p>su ${receiveIn === 'EUR' ? 'IBAN Unicredit' : 'wallet'}</p>`;
  document.getElementById('payment').style.display = 'block';
  document.getElementById('iban').style.display = receiveIn === 'EUR' ? 'block' : 'none';
  document.getElementById('wallet').style.display = receiveIn !== 'EUR' ? 'block' : 'none';
  document.getElementById('iban').value = quote.defaultIban || '';
}

async function executeTrade() {
  const iban = document.getElementById('iban').value;
  const wallet = document.getElementById('wallet').value;

  const res = await fetch(`${API_URL}/api/otc/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...quote, iban, walletAddress: wallet })
  });
  const data = await res.json();
  alert(data.success ? "OFF-RAMP COMPLETO! Fondi inviati." : data.error);
}
