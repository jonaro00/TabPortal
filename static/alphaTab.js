const MAX_VOLUME = 40;
const STEP_LENTGH = 100;

const Settings = {
    defaults: {
        muted: false,
        volume: Math.round(MAX_VOLUME * 0.4),
        speed: 1.0,
        countIn: 0,
        metronome: 0,
        loop: false,
        showNotation: true,
        layout: alphaTab.LayoutMode.Page,
        zoom: 1.0,
    },
    values: {},
    load() {
        this.values = {...this.defaults, ...JSON.parse(localStorage.getItem("tp-settings") || "{}")};
    },
    save() {
        localStorage.setItem("tp-settings", JSON.stringify(this.values));
    },
    getApiSettings() {
        return {
            core: {
                file: wrapper.getAttribute("data-file") || null,
            },
            player: {
                enablePlayer: true,
                soundFont: "https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2",
                scrollElement: viewport,
                scrollOffsetX: -6,
                scrollOffsetY: -10,
                slide: {
                    shiftSlideDurationRatio: 0.2,
                },
            },
            display: {
                stretchForce: 0.75,
                staveProfile: this.values.showNotation ? 'default' : 'tab',
                layoutMode: this.values.layout,
                scale: this.values.zoom / 100,
            },
            notation: {
                rhythmMode: this.values.showNotation ? 'hidden' : 'showwithbars',
            },
        }
    },
}
Settings.load();

// load elements
const wrapper = document.querySelector(".at-wrap");
const main = wrapper.querySelector(".at-main");
const viewport = wrapper.querySelector('.at-viewport');

// initialize alphatab
const at = new alphaTab.AlphaTabApi(main, Settings.getApiSettings());

// overlay logic
const overlay = wrapper.querySelector("#at-overlay-loading");
const overlayError = wrapper.querySelector("#at-overlay-error");
const overlayErrorText = wrapper.querySelector("#at-overlay-error-text");
// const overlayContent = wrapper.querySelector(".at-overlay-content");
at.renderStarted.on(() => {
    overlay.style.display = "flex";
});
at.renderFinished.on(() => {
    overlay.style.display = "none";
    overlayError.style.display = "none";
});


// // track selector
// function createTrackItem(track) {
//     const trackItem = document
//         .querySelector("#at-track-template")
//         .content.cloneNode(true).firstElementChild;
//     trackItem.querySelector(".at-track-name").innerText = track.name;
//     trackItem.track = track;
//     trackItem.onclick = (e) => {
//         e.stopPropagation();
//         api.renderTracks([track]);
//     };
//     return trackItem;
// }
// const trackList = wrapper.querySelector(".at-track-list");
// api.scoreLoaded.on((score) => {
//     // clear items
//     trackList.innerHTML = "";
//     // generate a track item for all tracks of the score
//     score.tracks.forEach((track) => {
//         trackList.appendChild(createTrackItem(track));
//     });
// });
// api.renderStarted.on(() => {
//     // collect tracks being rendered
//     const tracks = new Map();
//     api.tracks.forEach((t) => {
//         tracks.set(t.index, t);
//     });
//     // mark the item as active or not
//     const trackItems = trackList.querySelectorAll(".at-track");
//     trackItems.forEach((trackItem) => {
//         if (tracks.has(trackItem.track.index)) {
//             trackItem.classList.add("active");
//         } else {
//             trackItem.classList.remove("active");
//         }
//     });
// });

// main player controls
const playPause = wrapper.querySelector(".at-controls .at-player-play-pause");
const reset = wrapper.querySelector(".at-controls .at-player-reset");
const stepBackward = wrapper.querySelector(".at-controls .at-player-step-backward");
const stepForward = wrapper.querySelector(".at-controls .at-player-step-forward");
playPause.onclick = (e) => {
    if (e.target.classList.contains("disabled")) return;
    at.playPause();
};
reset.onclick = (e) => {
    if (e.target.classList.contains("disabled")) return;
    at.stop();
    viewport.scrollTo(0, 0);
};
stepBackward.onclick = (e) => {
    if (e.target.classList.contains("disabled")) return;
    at.tickPosition -= STEP_LENTGH;
};
stepForward.onclick = (e) => {
    if (e.target.classList.contains("disabled")) return;
    at.tickPosition += STEP_LENTGH;
};
at.playerReady.on(() => {
    playPause.classList.remove("disabled");
    reset.classList.remove("disabled");
    stepBackward.classList.remove("disabled");
    stepForward.classList.remove("disabled");
});
at.playerStateChanged.on((e) => {
    const icon = playPause.querySelector("i.fas");
    const playing = e.state === alphaTab.synth.PlayerState.Playing;
    icon.classList.toggle("fa-play", !playing);
    icon.classList.toggle("fa-pause", playing);
});

// song position
function formatDuration(milliseconds) {
    let seconds = milliseconds / 1000;
    const minutes = (seconds / 60) | 0;
    seconds = (seconds - minutes * 60) | 0;
    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0")
    );
}

const songPosition = wrapper.querySelector(".at-song-position");
let previousTime = -1;
at.playerPositionChanged.on((e) => {
    // reduce number of UI updates to second changes.
    const currentSeconds = (e.currentTime / 1000) | 0;
    if (currentSeconds == previousTime) {
        return;
    }

    songPosition.innerText = formatDuration(e.currentTime) + " / " + formatDuration(e.endTime);
});

const mute = wrapper.querySelector(".at-controls .at-mute");
const muteIcon = wrapper.querySelector(".at-controls .at-mute i");
mute.onclick = () => {
    Settings.values.muted = !Settings.values.muted;
    setMuted(Settings.values.muted);
    Settings.save();
};
function setMuted(b) {
    muteIcon.classList.toggle("fa-volume-mute", b);
    muteIcon.classList.toggle("fa-volume-up", !b);
    at.changeTrackMute(at.score.tracks, b);
}
const volume = wrapper.querySelector(".at-controls .at-volume input");
volume.max = MAX_VOLUME;
volume.oninput = () => { // when moving slider
    setVolume(parseInt(volume.value));
};
volume.onchange = () => { // when releasing slider
    Settings.values.volume = volume.value;
    Settings.save();
}
function setVolume(v) {
    at.masterVolume = v / MAX_VOLUME;
}


const speed = wrapper.querySelector(".at-controls .at-speed select");
speed.onchange = () => {
    setSpeed(parseFloat(speed.value));
    Settings.values.speed = speed.value;
    Settings.save();
};
function setSpeed(f) {
    at.playbackSpeed = f;
}

const countIn = wrapper.querySelector('.at-controls .at-count-in');
countIn.onclick = () => {
    countIn.classList.toggle('active');
    const counting = countIn.classList.contains('active');
    setCountIn(counting);
    Settings.values.countIn = counting;
    Settings.save();
};
function setCountIn(b) {
    at.countInVolume = b ? 1 : 0;
}
const metronome = wrapper.querySelector(".at-controls .at-metronome");
metronome.onclick = () => {
    metronome.classList.toggle('active');
    const counting = metronome.classList.contains('active');
    setMetronome(counting);
    Settings.values.metronome = counting;
    Settings.save();
};
function setMetronome(b) {
    at.metronomeVolume = b ? 1 : 0;
}
const loop = wrapper.querySelector(".at-controls .at-loop");
loop.onclick = () => {
    loop.classList.toggle('active');
    const looping = loop.classList.contains('active');
    setLoop(looping);
    Settings.values.loop = looping;
    Settings.save();
};
function setLoop(b) {
    at.isLooping = b;
}

at.scoreLoaded.on((score) => {
    wrapper.querySelector(".at-song-title").innerText = score.title;
    wrapper.querySelector(".at-song-artist").innerText = score.artist;
    wrapper.querySelector(".at-song-album").innerText = score.album ? `(${score.album})` : '';
    // set Document title
    document.title = score.title || score.artist || score.album ? `${score.title} - ${score.artist} | ${score.album}` : "Tab Portal";
});

wrapper.querySelector(".at-controls .at-print").onclick = () => {
    at.print();
};

const showNotation = wrapper.querySelector(".at-controls .at-show-notation");
showNotation.onclick = () => {
    showNotation.classList.toggle("active");
    if(showNotation.classList.contains("active")){
        at.settings.display.staveProfile = 'default';
        at.settings.notation.rhythmMode = 'hidden';
        Settings.values.showNotation = true;
    } else {
        at.settings.display.staveProfile = 'tab';
        at.settings.notation.rhythmMode = 'showwithbars';
        Settings.values.showNotation = false;
    }
    Settings.save();
    at.updateSettings();
    at.render();
};

const layout = wrapper.querySelector(".at-controls .at-layout");
layout.onclick = () => {
    layout.classList.toggle("active");
    at.settings.display.layoutMode = layout.classList.contains("active")
    ? alphaTab.LayoutMode.Page
    : alphaTab.LayoutMode.Horizontal;
    Settings.values.layout = at.settings.display.layoutMode;
    Settings.save();
    at.updateSettings();
    at.render();
};

const zoom = wrapper.querySelector(".at-controls .at-zoom select");
zoom.onchange = () => {
    setZoom(parseFloat(zoom.value));
    Settings.values.zoom = zoom.value;
    Settings.save();
};
function setZoom(f) {
    at.settings.display.scale = f;
    at.updateSettings();
    at.render();
}

viewport.onclick = () => {
    document.activeElement.blur();
}

// keyboard
document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) {
        return; // Do nothing if event already handled
    }
    let bodyFocused = document.activeElement == document.body;
    switch(event.key) {
        case " ":
            if (!bodyFocused && !event.ctrlKey) return;
            playPause.click();
            event.preventDefault(); // Consume the event so it doesn't get handled twice
            break;
        case "Backspace":
            if (!bodyFocused) return;
            reset.click()
            event.preventDefault();
            break;
        case "m":
            if (!bodyFocused) return;
            mute.click()
            event.preventDefault();
            break;
    }
}, true);


// load settings
document.addEventListener('DOMContentLoaded', () => {
    setMuted(Settings.values.muted);
    volume.value = Settings.values.volume;
    setVolume(Settings.values.volume);
    speed.value = Settings.values.speed;
    setSpeed(parseFloat(Settings.values.speed));

    Settings.values.countIn && countIn.classList.toggle("active");
    setCountIn(Settings.values.countIn);
    Settings.values.metronome && metronome.classList.toggle("active");
    setMetronome(Settings.values.metronome);
    Settings.values.loop && loop.classList.toggle("active");
    setLoop(Settings.values.loop);

    Settings.values.showNotation || showNotation.classList.toggle("active");
    Settings.values.layout === alphaTab.LayoutMode.Page || layout.classList.toggle("active");
    zoom.value = Settings.values.zoom;
    setZoom(parseFloat(Settings.values.zoom));
});
