const DEFAULT_ROW_COUNT = 5;
const DEFAULT_ITEMS = ["Mario", "Zelda", "Sonic", "Kirby", "Pikachu"];

const state = {
  title: "Untitled Tier List",
  rows: [],
  items: [],
  savedLists: [],
  activeSaveId: null,
};

const listTitleInput = document.getElementById("listTitleInput");
const itemNameInput = document.getElementById("itemNameInput");
const saveButton = document.getElementById("saveButton");
const newListButton = document.getElementById("newListButton");
const addRowButton = document.getElementById("addRowButton");
const addItemButton = document.getElementById("addItemButton");
const tierBoard = document.getElementById("tierBoard");
const pool = document.getElementById("pool");
const savedLists = document.getElementById("savedLists");
const statusMessage = document.getElementById("statusMessage");

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createRow() {
  return { id: uid("row") };
}

function createItem(name) {
  return { id: uid("item"), name, rowId: "pool" };
}

function createDefaultBoard() {
  state.title = "Untitled Tier List";
  state.rows = Array.from({ length: DEFAULT_ROW_COUNT }, () => createRow());
  state.items = DEFAULT_ITEMS.map((name) => createItem(name));
  state.activeSaveId = null;
}

function setStatus(message) {
  statusMessage.textContent = message;
}

function getBoardSnapshot() {
  return {
    id: state.activeSaveId ?? uid("save"),
    title: listTitleInput.value.trim() || "Untitled Tier List",
    rows: state.rows.map((row) => ({ ...row })),
    items: state.items.map((item) => ({ ...item })),
    savedAt: new Date().toISOString(),
  };
}

function render() {
  renderBoard();
  renderPool();
  renderSavedLists();
  syncFields();
}

function syncFields() {
  if (document.activeElement !== listTitleInput) {
    listTitleInput.value = state.title;
  }
}

function renderBoard() {
  tierBoard.innerHTML = "";

  state.rows.forEach((row) => {
    const rowElement = document.createElement("section");
    rowElement.className = "tier-row";

    const label = document.createElement("div");
    label.className = "tier-label";

    const dropzone = document.createElement("div");
    dropzone.className = "tier-dropzone dropzone";
    dropzone.dataset.rowId = row.id;

    const items = state.items.filter((item) => item.rowId === row.id);
    if (items.length > 0) {
      dropzone.classList.add("has-items");
    }
    items.forEach((item) => dropzone.appendChild(buildItemCard(item)));

    attachDropzoneEvents(dropzone, row.id);

    const actions = document.createElement("div");
    actions.className = "row-actions";
    const removeButton = document.createElement("button");
    removeButton.className = "row-remove";
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.title = "Delete row";
    removeButton.addEventListener("click", () => removeRow(row.id));
    actions.appendChild(removeButton);

    rowElement.append(label, dropzone, actions);
    tierBoard.appendChild(rowElement);
  });
}

function renderPool() {
  pool.innerHTML = "";

  const items = state.items.filter((item) => item.rowId === "pool");
  if (items.length > 0) {
    pool.classList.add("has-items");
  } else {
    pool.classList.remove("has-items");
  }

  items.forEach((item) => pool.appendChild(buildItemCard(item)));
  attachDropzoneEvents(pool, "pool");
}

function buildItemCard(item) {
  const card = document.createElement("article");
  card.className = "item-card";
  card.draggable = true;
  card.dataset.itemId = item.id;

  const name = document.createElement("span");
  name.className = "item-name";
  name.textContent = item.name;

  const removeButton = document.createElement("button");
  removeButton.className = "item-delete";
  removeButton.type = "button";
  removeButton.textContent = "×";
  removeButton.title = "Delete object";
  removeButton.addEventListener("click", (event) => {
    event.stopPropagation();
    removeItem(item.id);
  });

  card.append(name, removeButton);
  card.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", item.id);
    event.dataTransfer.effectAllowed = "move";
  });

  return card;
}

function attachDropzoneEvents(element, rowId) {
  element.dataset.rowId = rowId;

  if (element.dataset.dropBound === "true") {
    return;
  }

  element.dataset.dropBound = "true";

  element.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });

  element.addEventListener("dragenter", () => {
    element.classList.add("is-over");
  });

  element.addEventListener("dragleave", (event) => {
    if (!element.contains(event.relatedTarget)) {
      element.classList.remove("is-over");
    }
  });

  element.addEventListener("drop", (event) => {
    event.preventDefault();
    element.classList.remove("is-over");
    const itemId = event.dataTransfer.getData("text/plain");
    moveItem(itemId, element.dataset.rowId);
  });
}

function moveItem(itemId, rowId) {
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.rowId = rowId;
  render();
}

function addRow() {
  state.rows.push(createRow());
  setStatus("Row added.");
  render();
}

function removeRow(rowId) {
  if (state.rows.length === 1) {
    setStatus("Keep at least one row on the board.");
    return;
  }

  state.rows = state.rows.filter((row) => row.id !== rowId);
  state.items.forEach((item) => {
    if (item.rowId === rowId) {
      item.rowId = "pool";
    }
  });
  setStatus("Row removed. Any objects in it were returned to the pool.");
  render();
}

function addItem() {
  const name = itemNameInput.value.trim();
  if (!name) {
    setStatus("Enter an object name first.");
    return;
  }

  state.items.push(createItem(name));
  itemNameInput.value = "";
  setStatus("Object created.");
  render();
}

function removeItem(itemId) {
  state.items = state.items.filter((item) => item.id !== itemId);
  setStatus("Object removed.");
  render();
}

async function saveCurrentList() {
  state.title = listTitleInput.value.trim() || "Untitled Tier List";
  const snapshot = getBoardSnapshot();

  try {
    const response = await fetch("/api/lists", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(snapshot),
    });

    if (!response.ok) {
      throw new Error("Save failed");
    }

    const data = await response.json();
    state.savedLists = Array.isArray(data.lists) ? data.lists : [];
    state.activeSaveId = snapshot.id;
    setStatus("Tier list saved.");
    render();
  } catch (error) {
    setStatus("Could not save to Blob.");
  }
}

function loadList(saveId) {
  const snapshot = state.savedLists.find((entry) => entry.id === saveId);
  if (!snapshot) return;

  state.title = snapshot.title;
  state.rows = snapshot.rows.map((row) => ({ ...row }));
  state.items = snapshot.items.map((item) => ({ ...item }));
  state.activeSaveId = snapshot.id;
  setStatus(`Loaded "${snapshot.title}".`);
  render();
}

async function deleteList(saveId) {
  try {
    const response = await fetch(`/api/lists?id=${encodeURIComponent(saveId)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Delete failed");
    }

    const data = await response.json();
    state.savedLists = Array.isArray(data.lists) ? data.lists : [];
    if (state.activeSaveId === saveId) {
      state.activeSaveId = null;
    }
    setStatus("Saved tier list deleted.");
    render();
  } catch (error) {
    setStatus("Could not delete from Blob.");
  }
}

function renderSavedLists() {
  savedLists.innerHTML = "";

  if (state.savedLists.length === 0) {
    const empty = document.createElement("p");
    empty.className = "saved-empty";
    empty.textContent = "No saved tier lists yet.";
    savedLists.appendChild(empty);
    return;
  }

  state.savedLists.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "saved-card";

    const details = document.createElement("div");
    const name = document.createElement("p");
    name.className = "saved-name";
    name.textContent = entry.title;
    const time = document.createElement("p");
    time.className = "saved-time";
    time.textContent = new Date(entry.savedAt).toLocaleString();
    details.append(name, time);

    const actions = document.createElement("div");
    actions.className = "saved-actions";

    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.textContent = "Open";
    loadButton.addEventListener("click", () => loadList(entry.id));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteList(entry.id));

    actions.append(loadButton, deleteButton);
    card.append(details, actions);
    savedLists.appendChild(card);
  });
}

function resetBoard() {
  createDefaultBoard();
  setStatus("Started a fresh tier list.");
  render();
}

async function loadSavedLists() {
  try {
    const response = await fetch("/api/lists", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Load failed");
    }

    const data = await response.json();
    state.savedLists = Array.isArray(data.lists) ? data.lists : [];
  } catch (error) {
    state.savedLists = [];
    setStatus("Cloud save unavailable.");
  }
}

saveButton.addEventListener("click", saveCurrentList);
newListButton.addEventListener("click", resetBoard);
addRowButton.addEventListener("click", addRow);
addItemButton.addEventListener("click", addItem);

itemNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") addItem();
});

listTitleInput.addEventListener("input", () => {
  state.title = listTitleInput.value;
});

async function init() {
  createDefaultBoard();
  render();
  setStatus("Loading shared tier lists...");
  await loadSavedLists();

  if (state.savedLists.length > 0) {
    loadList(state.savedLists[0].id);
    return;
  }

  render();
  setStatus("Create rows and objects, then save to Blob.");
}

init();
