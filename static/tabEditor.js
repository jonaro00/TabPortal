const cont = document.querySelector(".tp-editor-container")
const editor = cont.querySelector(".tp-editor")
const editorTextArea = cont.querySelector("#tp-text-editor")
const editorEditBtn = cont.querySelector("#tp-edit")
const editorRenderBtn = cont.querySelector("#tp-render")
const editorBar = cont.querySelector(".tp-editor-bar")
const editorBarIcons = cont.querySelectorAll(".tp-editor-bar i")

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

function render() {
    let pos = api.tickPosition;
    api.tex(editorTextArea.value);
    api.tickPosition = pos;
    editorTextArea.blur();
    viewport.focus();
}

api.error.on(() => {
    overlayError.style.display = "flex";
})

// Warn user when leaving unsaved changes.
let edits_made = false;
editorTextArea.oninput = () => {
    edits_made = true;
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
            else if (document.activeElement == document.body){ // Enter focuses textarea
                if(editor.classList.contains("hidden")){
                    toggleEditor();
                }
                editorTextArea.focus();
                event.preventDefault();
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

api.tex(editorTextArea.value);
