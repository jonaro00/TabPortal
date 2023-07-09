const cont = document.querySelector(".tp-editor-container")
const editor = cont.querySelector(".tp-editor")
const editorTextArea = cont.querySelector("#tp-text-editor")
const editorEditBtn = cont.querySelector("#tp-edit")
const editorRenderBtn = cont.querySelector("#tp-render")
const editorSaveBtn = cont.querySelector("#tp-save")
const editorSaveNewBtn = cont.querySelector("#tp-save-new")
const editorBar = cont.querySelector(".tp-editor-bar")
const editorBarIcons = cont.querySelectorAll(".tp-editor-bar i")
const editorName = cont.querySelector("#tp-name");
const editorApiPassword = cont.querySelector("#tp-api-password");

function toggleEditor() {
    editor.classList.toggle("hidden");
    editorBarIcons.forEach((e) => {
        e.classList.toggle("fa-chevron-up");
        e.classList.toggle("fa-chevron-down");
    });
}
editorBar.onclick = toggleEditor;

editorEditBtn && (editorEditBtn.onclick = () => {
    window.location.assign('?edit=true')
});
editorRenderBtn && (editorRenderBtn.onclick = () => {
    render();
});

tabId = window.location.pathname.match(/\/tabs\/(\w+)/)?.[1];

editorSaveBtn && (editorSaveBtn.onclick = () => {
    if (editorSaveBtn.classList.contains("disabled")) return;
    fetch(
        `/api/tabs/${tabId}`,
        {
            method: "PUT",
            headers: new Headers({
                "Content-Type": "application/json",
                "X-Tp-Pass": editorApiPassword?.value || "",
            }),
            body: JSON.stringify({
                name: editorName?.value || "",
                tex: editorTextArea.value,
            }),
        },
    ).then(res => {
        if (res.ok) {
            edits_made = false;
            updateEditorState();
        }
    });
});

editorSaveNewBtn && (editorSaveNewBtn.onclick = () => {
    if (editorSaveNewBtn.classList.contains("disabled")) return;
    fetch(
        "/api/tabs",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Tp-Pass": editorApiPassword?.value || "",
            },
            body: JSON.stringify({
                name: editorName?.value || "",
                tex: editorTextArea.value,
            }),
        },
    ).then(res => {
        if (res.ok) {
            edits_made = false;
            updateEditorState();
        }
    });
});

function render() {
    let pos = at.tickPosition;
    at.tex(editorTextArea.value);
    at.tickPosition = pos;
    editorTextArea.blur();
    viewport.focus();
}

at.error.on((error) => {
    overlayErrorText.innerText = error.message;
    overlayError.style.display = "flex";
})

// Warn user when leaving unsaved changes.
let edits_made = false;
editorTextArea.oninput = () => {
    edits_made = true;
    updateEditorState();
}
editorName && (editorName.oninput = () => {
    edits_made = true;
    updateEditorState();
});
function updateEditorState() {
    if (tabId) editorSaveBtn.classList.toggle("disabled", !edits_made);
    editorSaveNewBtn.classList.toggle("disabled", !edits_made);
}
window.addEventListener("beforeunload", (e) => {
    if (!edits_made) return undefined;
    e.preventDefault();
    return e.returnValue = `Changes made will be lost.`;
});

// keyboard
document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) {
        return; // Do nothing if event already handled
    }
    switch(event.key) {
        case "Enter":
            if (event.ctrlKey) { // Ctrl+Enter renders the alphaTex
                render();
                event.preventDefault(); // Consume the event so it doesn't get handled twice
            }
            else if (document.activeElement == document.body) { // Enter focuses textarea
                if(editor.classList.contains("hidden")){
                    toggleEditor();
                }
                editorTextArea.focus();
                event.preventDefault();
            }
            break;
        case "s" | "S":
            if (event.ctrlKey) {
                if (event.shiftKey) {
                    // Ctrl+Shift+S
                    editorSaveNewBtn && editorSaveNewBtn.click();
                } else {
                    // Ctrl+S
                    editorSaveBtn && editorSaveBtn.click();
                }
                event.preventDefault(); // Consume the event so it doesn't get handled twice
            }
            break;
    }
}, true);

editorTextArea.value = editorTextArea.value || `\\title ""
\\artist ""
\\album ""

\\instrument 33
\\tuning g2 d2 a1 e1

\\tempo 120

.

\\clef F4
\\ks C

3.3 3.3 3.3 3.3 | 2.3 2.3 2.3 2.3`;

at.tex(editorTextArea.value);
