const API_URL = "https://neonoble-otc-desk.onrender.com"; // BACKEND RENDER LIVE

let currentQuote = {};

async function getQuote() {
  const amount = document.getElementById("amount").value;
  const receiveIn = document.getElementById("receiveIn").value;

  if (!amount || amount < 1) {
    alert("Inserisci una quantità valida");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/otc/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nenoAmount: Number(amount), receiveIn })
    });

    if (!response.ok) throw new Error("Errore server");

    currentQuote = await response.json();

    document.getElementById("quote").innerHTML = `
      <h3>Quotazione</h3>
      <p><strong>${currentQuote.nenoAmount.toLocaleString()} NENO</strong></p>
      <p>Ricevi: <strong>
        ${receiveIn === "EUR" 
          ? currentQuote.totalEur.toLocaleString() + " €" 
          : currentQuote.cryptoAmount.toFixed(6) + " " + receiveIn
        }
      </strong></p>
    `;

    document.getElementById("payment").style.display = "block";
    document.getElementById("iban").style.display = receiveIn === "EUR" ? "block" : "none";
    document.getElementById("wallet").style.display = receiveIn !== "EUR" ? "block" : "none";
    document.getElementById("iban").value = currentQuote.defaultIban || "";

  } catch (err) {
    alert("Errore: " + err.message);
  }
}

async function executeTrade() {
  const iban = document.getElementById("iban").value;
  const wallet = document.getElementById("wallet").value;

  if (!currentQuote.quoteId) return alert("Prima fai una quotazione");

  const res = await fetch(`${API_URL}/api/otc/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...currentQuote,
      iban: iban || null,
      walletAddress: wallet || null
    })
  });

  const data = await res.json();
  alert(data.success ? "OFF-RAMP COMPLETO! Fondi inviati." : "Errore: " + data.error);
}
