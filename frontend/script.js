const API_URL = "https://neonoble-otc-desk.onrender.com";

let currentQuote = {};

async function getQuote() {
  const amount = document.getElementById("amount").value;
  const receiveIn = document.getElementById("receiveIn").value;
  if (!amount || amount < 1) return alert("Quantità NENO");

  const res = await fetch(`${API_URL}/api/otc/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nenoAmount: Number(amount), receiveIn })
  });

  currentQuote = await res.json();

  document.getElementById("quote").innerHTML = `
    <h3>Quotazione</h3>
    <p><strong>${currentQuote.nenoAmount.toLocaleString()} NENO</strong></p>
    <p>Ricevi: <strong>${receiveIn==="EUR"?currentQuote.totalEur.toLocaleString()+" €":currentQuote.cryptoAmount.toFixed(6)+" "+receiveIn}</strong></p>
  `;

  document.getElementById("payment").style.display = "block";
  document.getElementById("iban").style.display = receiveIn === "EUR" ? "block" : "none";
  document.getElementById("wallet").style.display = receiveIn !== "EUR" ? "block" : "none";
  document.getElementById("iban").value = "IT22B0200822800000103317304";
}

async function executeOffRamp() {
  if (!currentQuote.quoteId) return alert("Prima quotazione");

  const res = await fetch(`${API_URL}/api/otc/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(currentQuote)
  });

  const data = await res.json();
  alert(data.success ? "OFF-RAMP COMPLETO! 10.000.000 € inviati su Unicredit" : data.error);
}
