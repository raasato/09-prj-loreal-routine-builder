/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineButton = document.getElementById("generateRoutine");
const chatWindow = document.getElementById("chatWindow");
const openWebSearchModalButton = document.getElementById("openWebSearchModal");
const webSearchModal = document.getElementById("webSearchModal");
const closeWebSearchModalButton = document.getElementById(
  "closeWebSearchModal",
);
const productDetailsModal = document.getElementById("productDetailsModal");
const closeProductDetailsModalButton = document.getElementById(
  "closeProductDetailsModal",
);
const productDetailsBrand = document.getElementById("productDetailsBrand");
const productDetailsName = document.getElementById("productDetailsName");
const productDetailsDescription = document.getElementById(
  "productDetailsDescription",
);
const webSearchForm = document.getElementById("webSearchForm");
const webSearchInput = document.getElementById("webSearchInput");
const webSearchMessages = document.getElementById("webSearchMessages");
const routineFollowUpForm = document.getElementById("routineFollowUpForm");
const routineFollowUpInput = document.getElementById("routineFollowUpInput");

const CHAT_SCOPE_REFUSAL =
  "I can only help with your generated routine and related beauty topics such as skincare, haircare, makeup, fragrance, and product usage.";

const CHAT_SYSTEM_PROMPT =
  "You are a beginner-friendly beauty advisor. You must only answer questions about the generated routine or related beauty topics like skincare, haircare, makeup, fragrance, ingredients, product order, and safe usage. If a question is unrelated, politely refuse in one short sentence.";

/* Set document direction based on the active language */
function applyDocumentDirection() {
  const rtlLanguages = ["ar", "he", "fa", "ur"];
  const language = (document.documentElement.lang || "en")
    .toLowerCase()
    .split("-")[0];

  const direction = rtlLanguages.includes(language) ? "rtl" : "ltr";
  document.documentElement.dir = direction;

  if (document.body) {
    document.body.dir = direction;
  }
}

/* Keep direction in sync if the language changes at runtime */
function watchDocumentLanguage() {
  const observer = new MutationObserver(() => {
    applyDocumentDirection();
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
}

/* Cloudflare Worker URL - replace with your own worker URL */
const CLOUDFLARE_WORKER_URL =
  "https://loreal-guide-worker.rawrobynne27.workers.dev/";

/* Escape HTML so API text is safe to render in the page */
function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* Ask a routine follow-up question using the conversation history */
async function askFollowUpQuestion(question) {
  if (!routineWasGenerated) {
    appendChatMessage(
      "assistant",
      "Generate a routine first, then ask follow-up questions below the routine.",
    );
    return;
  }

  appendChatMessage("user", question);

  if (!isAllowedBeautyQuestion(question)) {
    appendChatMessage("assistant", CHAT_SCOPE_REFUSAL);
    conversationHistory.push({ role: "user", content: question });
    conversationHistory.push({
      role: "assistant",
      content: CHAT_SCOPE_REFUSAL,
    });
    return;
  }

  conversationHistory.push({ role: "user", content: question });

  try {
    const response = await fetch(CLOUDFLARE_WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: conversationHistory,
      }),
    });

    if (!response.ok) {
      throw new Error("Follow-up question request failed");
    }

    const data = await response.json();
    const assistantReply = data.choices[0].message.content;

    appendChatMessage("assistant", assistantReply);
    conversationHistory.push({ role: "assistant", content: assistantReply });
  } catch (error) {
    appendChatMessage(
      "assistant",
      "I could not answer that right now. Please try your question again.",
    );
    console.error(error);
  }
}

/* Render a routine object as a readable morning/night layout */
function renderRoutineLayout(routine) {
  const morningSteps = Array.isArray(routine.morning) ? routine.morning : [];
  const nightSteps = Array.isArray(routine.night) ? routine.night : [];

  const morningHtml = morningSteps
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");

  const nightHtml = nightSteps
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");

  chatWindow.innerHTML = `
    <div class="routine-output">
      <h3>Morning Routine</h3>
      <ol>
        ${morningHtml || "<li>No morning steps provided.</li>"}
      </ol>

      <h3>Night Routine</h3>
      <ol>
        ${nightHtml || "<li>No night steps provided.</li>"}
      </ol>
    </div>
    <p class="follow-up-hint">Open the web search modal below for current L'Oréal product and routine questions.</p>
  `;
}

/* Build a plain text version of the routine for conversation context */
function buildRoutineText(routine) {
  const morningSteps = Array.isArray(routine.morning) ? routine.morning : [];
  const nightSteps = Array.isArray(routine.night) ? routine.night : [];

  const morningText = morningSteps
    .map((step, index) => `${index + 1}. ${step}`)
    .join("\n");

  const nightText = nightSteps
    .map((step, index) => `${index + 1}. ${step}`)
    .join("\n");

  return `Morning Routine:\n${morningText}\n\nNight Routine:\n${nightText}`;
}

/* Show a message in the chat conversation area */
function appendChatMessage(role, text) {
  const messageClass =
    role === "user"
      ? "chat-message user-message"
      : "chat-message assistant-message";
  const speaker = role === "user" ? "You" : "Advisor";
  const safeText = escapeHtml(text).replaceAll("\n", "<br>");

  chatWindow.insertAdjacentHTML(
    "beforeend",
    `<div class="${messageClass}"><strong>${speaker}:</strong> ${safeText}</div>`,
  );

  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Format citation links for display in the modal */
function renderCitationList(citations) {
  if (!Array.isArray(citations) || citations.length === 0) {
    return "";
  }

  const citationItems = citations
    .map((citation) => {
      const title = escapeHtml(citation.title || citation.url || "Source");
      const url = escapeHtml(citation.url || "#");
      const snippet = citation.snippet ? escapeHtml(citation.snippet) : "";

      return `
        <div class="citation-item">
          <a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a>
          ${snippet ? `<span class="snippet">${snippet}</span>` : ""}
        </div>
      `;
    })
    .join("");

  return `
    <div class="citation-group">
      <h4>Sources</h4>
      ${citationItems}
    </div>
  `;
}

/* Show a message inside the web search modal */
function appendWebSearchMessage(role, text, citations = []) {
  const messageClass =
    role === "user"
      ? "chat-message user-message"
      : "chat-message assistant-message";
  const speaker = role === "user" ? "You" : "Advisor";
  const safeText = escapeHtml(text).replaceAll("\n", "<br>");

  webSearchMessages.insertAdjacentHTML(
    "beforeend",
    `<div class="${messageClass}"><strong>${speaker}:</strong> ${safeText}${renderCitationList(citations)}</div>`,
  );

  webSearchMessages.scrollTop = webSearchMessages.scrollHeight;
  return webSearchMessages.lastElementChild;
}

/* Open the web search chatbot modal */
function openWebSearchModal() {
  webSearchMessages.innerHTML = "";
  appendWebSearchMessage(
    "assistant",
    "Ask about current L'Oréal products, ingredients, or routines. Answers include direct links to sources.",
  );
  webSearchModal.classList.add("is-open");
  webSearchModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  webSearchInput.value = "";
  webSearchInput.focus();
}

/* Close the web search chatbot modal */
function closeWebSearchModal() {
  webSearchModal.classList.remove("is-open");
  webSearchModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

/* Open product details modal with full description */
function openProductDetailsModal(product) {
  if (!product) return;

  productDetailsBrand.textContent = product.brand;
  productDetailsName.textContent = product.name;
  productDetailsDescription.textContent = product.description;

  productDetailsModal.classList.add("is-open");
  productDetailsModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

/* Close product details modal */
function closeProductDetailsModal() {
  productDetailsModal.classList.remove("is-open");
  productDetailsModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

/* Ask OpenAI web search for current L'Oréal information */
async function askWebSearchQuestion(question) {
  if (!isAllowedBeautyQuestion(question)) {
    appendWebSearchMessage("assistant", CHAT_SCOPE_REFUSAL);
    return;
  }

  appendWebSearchMessage("user", question);
  const loadingMessage = appendWebSearchMessage(
    "assistant",
    "Searching the web for current information...",
  );

  try {
    const response = await fetch(CLOUDFLARE_WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "web-search",
        query: `L'Oréal ${question}`,
      }),
    });

    if (!response.ok) {
      throw new Error("Web search request failed");
    }

    const data = await response.json();
    const assistantAnswer = data.answer || "I could not find a clear answer.";
    const citations = Array.isArray(data.citations) ? data.citations : [];

    if (loadingMessage) {
      loadingMessage.remove();
    }

    appendWebSearchMessage("assistant", assistantAnswer, citations);
  } catch (error) {
    if (loadingMessage) {
      loadingMessage.remove();
    }

    appendWebSearchMessage(
      "assistant",
      "I could not fetch current information right now. Please try again.",
    );
    console.error(error);
  }
}

/* Use basic keyword checks to keep follow-up questions in scope */
function isAllowedBeautyQuestion(question) {
  const allowedTopics =
    /routine|morning|night|step|skincare|skin care|haircare|hair care|makeup|fragrance|beauty|loreal|l'oreal|l’oreal|cleanser|moisturizer|serum|sunscreen|spf|retinol|vitamin c|acne|foundation|mascara|lipstick|shampoo|conditioner|hair|skin|face|ingredient|sensitive|dry|oily|combination|product/i;

  return allowedTopics.test(question);
}

/* Parse JSON safely, even if the model wraps it in ```json ... ``` */
function parseRoutineJson(responseText) {
  try {
    return JSON.parse(responseText);
  } catch {
    const codeBlockMatch = responseText.match(
      /```(?:json)?\s*([\s\S]*?)\s*```/i,
    );
    if (codeBlockMatch && codeBlockMatch[1]) {
      return JSON.parse(codeBlockMatch[1]);
    }

    const firstBrace = responseText.indexOf("{");
    const lastBrace = responseText.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const possibleJson = responseText.slice(firstBrace, lastBrace + 1);
      return JSON.parse(possibleJson);
    }

    throw new Error("Unable to parse routine JSON from model response.");
  }
}

/* Keep product data and selected product IDs in memory */
let allProducts = [];
let currentProducts = [];
const selectedProductIds = new Set();
let routineWasGenerated = false;
let conversationHistory = [
  {
    role: "system",
    content: CHAT_SYSTEM_PROMPT,
  },
];

/* Save selected product IDs to localStorage */
function saveSelectedProductsToStorage() {
  const productArray = Array.from(selectedProductIds);
  localStorage.setItem("selectedProducts", JSON.stringify(productArray));
}

/* Load selected product IDs from localStorage */
function loadSelectedProductsFromStorage() {
  const stored = localStorage.getItem("selectedProducts");
  if (stored) {
    const productArray = JSON.parse(stored);
    productArray.forEach((id) => selectedProductIds.add(id));
  }
}

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Initialize the app on page load */
async function initializeApp() {
  applyDocumentDirection();
  watchDocumentLanguage();

  /* Load all products and saved selections */
  allProducts = await loadProducts();
  loadSelectedProductsFromStorage();
  renderSelectedProducts();
  updateClearAllButtonVisibility();
}

/* Load saved selections and display them on page load */
initializeApp();

/* Create HTML for displaying product cards */
function displayProducts(products) {
  currentProducts = products;

  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card ${
      selectedProductIds.has(product.id) ? "selected" : ""
    }" data-product-id="${product.id}" role="button" tabindex="0" aria-pressed="${selectedProductIds.has(
      product.id,
    )}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
        <button type="button" class="learn-more-btn" data-product-id="${product.id}">
          Learn More
        </button>
      </div>
    </div>
  `,
    )
    .join("");
}

/* Show selected products under the grid */
function renderSelectedProducts() {
  const selectedProducts = allProducts.filter((product) =>
    selectedProductIds.has(product.id),
  );

  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `
      <p class="selected-placeholder">No products selected yet.</p>
    `;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
    <div class="selected-product-item" data-product-id="${product.id}">
      <div class="selected-product-header">
        <strong>${product.name}</strong>
        <button type="button" class="remove-selected-btn" aria-label="Remove ${product.name}">
          Remove
        </button>
      </div>
    </div>
  `,
    )
    .join("");
}

/* Ask OpenAI to generate a routine based on selected products */
async function generateAIRoutine() {
  const selectedProducts = allProducts.filter((product) =>
    selectedProductIds.has(product.id),
  );

  if (selectedProducts.length === 0) {
    chatWindow.innerHTML = "Please select at least one product first.";
    return;
  }

  chatWindow.innerHTML = "Building your AI routine...";
  generateRoutineButton.disabled = true;
  generateRoutineButton.textContent = "Generating...";

  const userMessage = `Create a step-by-step daily beauty routine using these selected products JSON:\n${JSON.stringify(
    selectedProducts,
    null,
    2,
  )}\n\nReturn strict JSON only in this format:\n{\n  "morning": ["step 1", "step 2"],\n  "night": ["step 1", "step 2"]\n}`;

  try {
    const response = await fetch(CLOUDFLARE_WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are a beginner-friendly beauty advisor. Use only the provided products. Always return valid JSON with two arrays: morning and night.",
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error("Routine generation failed");
    }

    const data = await response.json();
    const aiRoutineText = data.choices[0].message.content;
    const aiRoutine = parseRoutineJson(aiRoutineText);
    const routineContext = buildRoutineText(aiRoutine);

    conversationHistory = [
      {
        role: "system",
        content: CHAT_SYSTEM_PROMPT,
      },
      {
        role: "assistant",
        content: `Generated routine:\n${routineContext}`,
      },
    ];

    routineWasGenerated = true;

    renderRoutineLayout(aiRoutine);
    appendChatMessage(
      "assistant",
      "Your routine is ready. Open the web search modal for current L'Oréal questions and citations.",
    );
  } catch (error) {
    chatWindow.innerHTML =
      "Something went wrong while generating the routine. Please try again.";
    console.error(error);
  } finally {
    generateRoutineButton.disabled = false;
    generateRoutineButton.innerHTML =
      '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Routine';
  }
}

/* Add or remove a product from the selected set */
function toggleProductSelection(productId) {
  if (selectedProductIds.has(productId)) {
    selectedProductIds.delete(productId);
  } else {
    selectedProductIds.add(productId);
  }

  saveSelectedProductsToStorage();
  displayProducts(currentProducts);
  renderSelectedProducts();
  updateClearAllButtonVisibility();
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  if (allProducts.length === 0) {
    allProducts = await loadProducts();
  }

  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = allProducts.filter(
    (product) => product.category === selectedCategory,
  );

  displayProducts(filteredProducts);
});

/* Click a card to select or unselect a product */
productsContainer.addEventListener("click", (e) => {
  const learnMoreButton = e.target.closest(".learn-more-btn");
  if (learnMoreButton) {
    const productId = Number(learnMoreButton.dataset.productId);
    const product = allProducts.find((item) => item.id === productId);
    openProductDetailsModal(product);
    return;
  }

  const card = e.target.closest(".product-card");
  if (!card) return;

  const productId = Number(card.dataset.productId);
  toggleProductSelection(productId);
});

/* Keyboard support for selecting cards */
productsContainer.addEventListener("keydown", (e) => {
  if (e.target.closest(".learn-more-btn")) return;

  if (e.key !== "Enter" && e.key !== " ") return;

  const card = e.target.closest(".product-card");
  if (!card) return;

  e.preventDefault();
  const productId = Number(card.dataset.productId);
  toggleProductSelection(productId);
});

/* Remove products directly from the selected list */
selectedProductsList.addEventListener("click", (e) => {
  const removeButton = e.target.closest(".remove-selected-btn");
  if (!removeButton) return;

  const selectedItem = removeButton.closest(".selected-product-item");
  if (!selectedItem) return;

  const productId = Number(selectedItem.dataset.productId);
  selectedProductIds.delete(productId);
  saveSelectedProductsToStorage();
  displayProducts(currentProducts);
  renderSelectedProducts();
  updateClearAllButtonVisibility();
});

/* Clear all selected products */
function clearAllSelected() {
  selectedProductIds.clear();
  saveSelectedProductsToStorage();
  displayProducts(currentProducts);
  renderSelectedProducts();
  updateClearAllButtonVisibility();
}

/* Toggle visibility of Clear All button based on selection count */
function updateClearAllButtonVisibility() {
  const clearAllBtn = document.getElementById("clearAllBtn");
  if (selectedProductIds.size > 0) {
    clearAllBtn.style.display = "inline-block";
  } else {
    clearAllBtn.style.display = "none";
  }
}

/* Get reference to Clear All button */
const clearAllBtn = document.getElementById("clearAllBtn");
if (clearAllBtn) {
  clearAllBtn.addEventListener("click", clearAllSelected);
}

/* Web search modal event listeners */
if (openWebSearchModalButton) {
  openWebSearchModalButton.addEventListener("click", openWebSearchModal);
}

if (closeWebSearchModalButton) {
  closeWebSearchModalButton.addEventListener("click", closeWebSearchModal);
}

if (webSearchModal) {
  webSearchModal.addEventListener("click", (e) => {
    if (e.target === webSearchModal) {
      closeWebSearchModal();
    }
  });
}

if (closeProductDetailsModalButton) {
  closeProductDetailsModalButton.addEventListener(
    "click",
    closeProductDetailsModal,
  );
}

if (productDetailsModal) {
  productDetailsModal.addEventListener("click", (e) => {
    if (e.target === productDetailsModal) {
      closeProductDetailsModal();
    }
  });
}

if (webSearchForm) {
  webSearchForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const question = webSearchInput.value.trim();
    if (!question) return;

    webSearchInput.value = "";
    await askWebSearchQuestion(question);
  });

  if (routineFollowUpForm) {
    routineFollowUpForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const question = routineFollowUpInput.value.trim();
      if (!question) return;

      routineFollowUpInput.value = "";
      await askFollowUpQuestion(question);
    });
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && webSearchModal.classList.contains("is-open")) {
    closeWebSearchModal();
  }

  if (e.key === "Escape" && productDetailsModal.classList.contains("is-open")) {
    closeProductDetailsModal();
  }
});

/* Generate AI routine from selected product JSON */
generateRoutineButton.addEventListener("click", async () => {
  await generateAIRoutine();
});
