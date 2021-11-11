// load elements
const wrapper = document.querySelector(".at-wrap");
const main = wrapper.querySelector(".at-main");
const viewport = wrapper.querySelector('.at-viewport');

// initialize alphatab
const settings = {
    file: wrapper.getAttribute("data-file") || null,
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
    stretchForce: 0.75,
};
const api = new alphaTab.AlphaTabApi(main, settings);

// overlay logic
const overlay = wrapper.querySelector("#at-overlay-loading");
const overlayError = wrapper.querySelector("#at-overlay-error");
// const overlayContent = wrapper.querySelector(".at-overlay-content");
api.renderStarted.on(() => {
    overlay.style.display = "flex";
});
api.renderFinished.on(() => {
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
playPause.onclick = (e) => {
    if (e.target.classList.contains("disabled")) {
        return;
    }
    api.playPause();
};
reset.onclick = (e) => {
    if (e.target.classList.contains("disabled")) {
        return;
    }
    api.stop();
    viewport.scrollTo(0, 0);
};
api.playerReady.on(() => {
    playPause.classList.remove("disabled");
    reset.classList.remove("disabled");
});
api.playerStateChanged.on((e) => {
    const icon = playPause.querySelector("i.fas");
    if (e.state === alphaTab.synth.PlayerState.Playing) {
        icon.classList.remove("fa-play");
        icon.classList.add("fa-pause");
    } else {
        icon.classList.remove("fa-pause");
        icon.classList.add("fa-play");
    }
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
api.playerPositionChanged.on((e) => {
    // reduce number of UI updates to second changes.
    const currentSeconds = (e.currentTime / 1000) | 0;
    if (currentSeconds == previousTime) {
        return;
    }

    songPosition.innerText = formatDuration(e.currentTime) + " / " + formatDuration(e.endTime);
});

let muted = false;
const mute = wrapper.querySelector(".at-controls .at-mute");
const muteIcon = wrapper.querySelector(".at-controls .at-mute i");
mute.onclick = () => {
    muted = !muted;
    setMuted(muted);
    localStorage.setItem('muted', muted);
}
function setMuted(b){
    muteIcon.classList.toggle("fa-volume-mute", b);
    muteIcon.classList.toggle("fa-volume-up", !b);
    api.changeTrackMute(api.score.tracks, b);
}
const volume = wrapper.querySelector(".at-controls .at-volume input");
const maxVolume = 40;
volume.max = maxVolume;
volume.oninput = () => {
    api.masterVolume = parseInt(volume.value) / maxVolume;
    localStorage.setItem('volume', volume.value);
};


const speed = wrapper.querySelector(".at-controls .at-speed select");
speed.onchange = () => {
    const playSpeed = parseInt(speed.value) / 100
    api.playbackSpeed = playSpeed;
    localStorage.setItem('speed', speed.value);
};

const countIn = wrapper.querySelector('.at-controls .at-count-in');
countIn.onclick = () => {
    countIn.classList.toggle('active');
    const counting = countIn.classList.contains('active');
    api.countInVolume = counting ? 1 : 0;
    localStorage.setItem('countIn', counting);
};
const metronome = wrapper.querySelector(".at-controls .at-metronome");
metronome.onclick = () => {
    metronome.classList.toggle('active');
    const counting = metronome.classList.contains('active');
    api.metronomeVolume = counting ? 1 : 0;
    localStorage.setItem('metronome', counting);
};
const loop = wrapper.querySelector(".at-controls .at-loop");
loop.onclick = () => {
    loop.classList.toggle('active');
    const looping = loop.classList.contains('active');
    api.isLooping = looping;
    localStorage.setItem('loop', looping);
};

api.scoreLoaded.on((score) => {
    wrapper.querySelector(".at-song-title").innerText = score.title;
    wrapper.querySelector(".at-song-artist").innerText = score.artist;
    wrapper.querySelector(".at-song-album").innerText = score.album ? `(${score.album})` : '';
    // set Document title
    document.title = score.title || score.artist || score.album ? `${score.title} - ${score.artist} | ${score.album}` : "Tab Portal";
});

wrapper.querySelector(".at-controls .at-print").onclick = () => {
    api.print();
};

const showNotation = wrapper.querySelector(".at-controls .at-show-notation");
showNotation.onclick = () => {
    showNotation.classList.toggle("active");
    if(showNotation.classList.contains("active")){
        api.settings.display.staveProfile = 'default';
        api.settings.notation.rhythmMode = 'hidden';
    } else {
        api.settings.display.staveProfile = 'tab';
        api.settings.notation.rhythmMode = 'showwithbars';
    }
    localStorage.setItem('showNotation', api.settings.display.staveProfile);
    api.updateSettings();
    api.render();
};

const layout = wrapper.querySelector(".at-controls .at-layout");
layout.onclick = () => {
    layout.classList.toggle("active");
    api.settings.display.layoutMode = layout.classList.contains("active")
    ? alphaTab.LayoutMode.Page
    : alphaTab.LayoutMode.Horizontal;
    localStorage.setItem('layout', api.settings.display.layoutMode);
    api.updateSettings();
    api.render();
};

const zoom = wrapper.querySelector(".at-controls .at-zoom select");
zoom.onchange = () => {
    api.settings.display.scale = parseInt(zoom.value) / 100;
    localStorage.setItem('zoom', zoom.value);
    api.updateSettings();
    api.render();
};

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

// User settings
// defaults
atDefaultSettings = {
    'muted': false,
    'volume': Math.round(maxVolume * 0.4),
    'speed': 100,
    'countIn': 0,
    'metronome': 0,
    'loop': false,
    'showNotation': true,
    'layout': 'default',
    'zoom': 100,
}
// load
document.addEventListener('DOMContentLoaded', () => {
    muted = localStorage.getItem('muted') === 'true' ? true : atDefaultSettings.muted;
    setMuted(muted);
    volume.value = localStorage.getItem('volume') !== null ? localStorage.getItem('volume') : atDefaultSettings.volume;
    volume.oninput();
    speed.value = localStorage.getItem('speed') !== null ? localStorage.getItem('speed') : atDefaultSettings.speed;
    speed.onchange();
    localStorage.getItem('countIn') === 'true' && countIn.onclick();
    localStorage.getItem('metronome') === 'true' && metronome.onclick();
    localStorage.getItem('loop') === 'true' && loop.onclick();
    localStorage.getItem('showNotation') === 'tab' && showNotation.onclick();
    localStorage.getItem('layout') === '1' && layout.onclick();
    zoom.value = localStorage.getItem('zoom') !== null ? localStorage.getItem('zoom') : atDefaultSettings.zoom;
    zoom.onchange();
});
