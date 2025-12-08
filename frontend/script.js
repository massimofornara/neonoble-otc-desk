/ URL BACKEND RENDER – SEMPRE FISSO
const BACKEND_URL = "https://neonoble-otc-desk.onrender.com";

let currentQuote = {};

async function getQuote() {
  const amount = document.getElementById("amount").value;
  const receiveIn = document.getElementById("receiveIn").value;

  if (!amount || amount < 1) return alert("Inserisci quantità NENO");

  try {
    const res = await fetch(`${BACKEND_URL}/api/otc/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nenoAmount: Number(amount), receiveIn })
    });

    if (!res.ok) throw new Error(`Errore ${res.status}`);

    currentQuote = await res.json();

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

  } catch (e) {
    alert("Errore: " + e.message);
  }
}

async function executeTrade() {
  if (!currentQuote.quoteId) return alert("Prima fai una quotazione");

  const iban = document.getElementById("iban").value;
  const wallet = document.getElementById("wallet").value;

  try {
    const res = await fetch(`${BACKEND_URL}/api/otc/execute`, {
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
  } catch (e) {
    alert("Errore rete: " + e.message);
  }
}
