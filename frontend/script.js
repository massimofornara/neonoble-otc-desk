const API_URL = "https://neonoble-otc-desk.onrender.com"; // ← TUO BACKEND RENDER LIVE

let currentQuote = {};

async function getQuote() {
  const amount = document.getElementById("amount").value;
  const receiveIn = document.getElementById("receiveIn").value;

  if (!amount || amount <= 0) {
    alert("Inserisci una quantità valida");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/otc/quote`, {
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
      <p>su ${receiveIn === "EUR" ? "IBAN Unicredit" : "wallet crypto"}</p>
    `;

    document.getElementById("payment").style.display = "block";
    document.getElementById("iban").style.display = receiveIn === "EUR" ? "block" : "none";
    document.getElementById("wallet").style.display = receiveIn !== "EUR" ? "block" : "none";
    document.getElementById("iban").value = currentQuote.defaultIban || "";

  } catch (err) {
    alert("Errore: " + err.message);
    console.error(err);
  }
}

async function executeTrade() {
  const iban = document.getElementById("iban").value;
  const wallet = document.getElementById("wallet").value;

  if (!currentQuote.quoteId) {
    alert("Prima fai una quotazione");
    return;
  }

  try {
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

    if (data.success) {
      alert(`OFF-RAMP COMPLETO!\n${data.message}`);
    } else {
      alert("Errore: " + data.error);
    }
  } catch (err) {
    alert("Errore di rete: " + err.message);
  }
}

